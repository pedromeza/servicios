/**
 * Núcleo de las migraciones: lo usan tanto `scripts/migrate.mjs` (build / CLI)
 * como el botón "Aplicar migraciones ahora" de la app.
 *
 * - Lleva el registro en public.schema_migrations (se crea sola).
 * - La primera vez detecta qué migraciones ya se aplicaron a mano y las registra sin repetirlas.
 * - Cada archivo corre en una transacción; si falla, se revierte y se detiene.
 * - Usa un candado para que dos ejecuciones simultáneas no choquen.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const LOCK_KEY = 7_283_119; // cualquier entero fijo: identifica el candado de migraciones

/** Cómo reconocer, la primera vez, una migración que ya se ejecutó a mano en el SQL Editor. */
const BASELINE_CHECKS = {
  "0001_init.sql": `select to_regclass('public.clients') is not null`,
  "0002_subscription_email.sql": `select exists (select 1 from information_schema.columns where table_schema='public' and table_name='subscriptions' and column_name='email_enc')`,
  "0003_account_term.sql": `select exists (select 1 from information_schema.columns where table_schema='public' and table_name='accounts' and column_name='term_years')`,
  "0004_subscription_promo.sql": `select exists (select 1 from information_schema.columns where table_schema='public' and table_name='subscriptions' and column_name='promo_months')`,
  "0005_license_kind_term_seats.sql": `select to_regclass('public.license_seats') is not null`,
  "0006_loyalty.sql": `select to_regclass('public.rewards') is not null`,
  "0007_reminders.sql": `select to_regclass('public.settings') is not null`,
  "0008_subscription_trash.sql": `select exists (select 1 from information_schema.columns where table_schema='public' and table_name='subscriptions' and column_name='deleted_at')`,
};

/**
 * Cadenas de conexión candidatas, en orden:
 * 1. DATABASE_URL tal cual.
 * 2. Si hay SUPABASE_DB_PASSWORD: el Session pooler de Supabase armado con el ref del proyecto
 *    (de NEXT_PUBLIC_SUPABASE_URL) y la región (SUPABASE_DB_REGION, por defecto us-east-2),
 *    probando los dos clústeres posibles (aws-0 y aws-1).
 * @param {Record<string, string | undefined>} env
 * @returns {string[]}
 */
export function candidateUrls(env) {
  const urls = [];
  if (env.DATABASE_URL) urls.push(env.DATABASE_URL);
  const password = env.SUPABASE_DB_PASSWORD;
  const ref = env.NEXT_PUBLIC_SUPABASE_URL?.match(/^https?:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1];
  if (password && ref) {
    const region = (env.SUPABASE_DB_REGION || "us-east-2").trim();
    for (const cluster of ["aws-0", "aws-1"]) {
      urls.push(`postgresql://postgres.${ref}:${encodeURIComponent(password)}@${cluster}-${region}.pooler.supabase.com:5432/postgres`);
    }
  }
  return urls;
}

/** Descripción corta de cómo está configurada la conexión, para mostrar en pantalla. */
export function connectionSummary(env) {
  if (env.DATABASE_URL) return "DATABASE_URL está configurada.";
  if (env.SUPABASE_DB_PASSWORD) return `Conexión con SUPABASE_DB_PASSWORD (región ${env.SUPABASE_DB_REGION || "us-east-2"}).`;
  return "Sin conexión a la base de datos: define SUPABASE_DB_PASSWORD (o DATABASE_URL) en Vercel.";
}

/**
 * @typedef {{ ok: boolean, lines: string[], applied: string[], error?: string }} MigrateResult
 */

/**
 * Aplica las migraciones pendientes. Acepta una o varias cadenas de conexión y usa la primera que conecte.
 * @param {{ url?: string, urls?: string[], dir: string, ssl?: boolean }} opts
 * @returns {Promise<MigrateResult>}
 */
export async function applyMigrations({ url, urls, dir, ssl = true }) {
  /** @type {string[]} */
  const lines = [];
  /** @type {string[]} */
  const applied = [];
  const log = (/** @type {string} */ m) => lines.push(m);

  const candidates = urls ?? (url ? [url] : []);
  if (candidates.length === 0) {
    log("No hay conexión configurada: define SUPABASE_DB_PASSWORD (o DATABASE_URL).");
    return { ok: false, lines, applied, error: "sin conexión" };
  }

  /** @type {pg.Client | null} */
  let client = null;
  /** @type {string[]} */
  const failures = [];
  for (const candidate of candidates) {
    const c = new pg.Client({ connectionString: candidate, ssl: ssl ? { rejectUnauthorized: false } : false, connectionTimeoutMillis: 15_000 });
    try {
      await c.connect();
      client = c;
      break;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const host = candidate.match(/@([^/:]+)/)?.[1] ?? "?";
      failures.push(`${host}: ${msg}`);
    }
  }
  if (!client) {
    log(`No se pudo conectar a la base de datos: ${failures.join(" | ")}`);
    if (/password authentication failed/i.test(failures.join(" "))) {
      log("La contraseña de la base de datos no coincide. Restablécela en Supabase → Project Settings → Database y actualiza SUPABASE_DB_PASSWORD en Vercel.");
    } else if (/Tenant or user not found/i.test(failures.join(" "))) {
      log("Supabase no reconoce el proyecto en esa región. Revisa SUPABASE_DB_REGION (la región aparece en la tarjeta del proyecto en Supabase, p. ej. us-east-2).");
    } else {
      log("Revisa SUPABASE_DB_PASSWORD y SUPABASE_DB_REGION, o pon DATABASE_URL con la URI del Session pooler de Supabase.");
    }
    return { ok: false, lines, applied, error: failures.join(" | ") };
  }

  try {
    await client.query("select pg_advisory_lock($1)", [LOCK_KEY]);

    const files = (await readdir(dir)).filter((f) => /^\d+_.+\.sql$/.test(f)).sort();

    const { rows: existsRows } = await client.query(`select to_regclass('public.schema_migrations') is not null as present`);
    const trackingExists = existsRows[0].present === true;

    await client.query(`
      create table if not exists public.schema_migrations (
        name       text primary key,
        applied_at timestamptz not null default now()
      );
      alter table public.schema_migrations enable row level security;
      revoke all on public.schema_migrations from anon, authenticated;
    `);

    if (!trackingExists) {
      for (const f of files) {
        const check = /** @type {Record<string, string>} */ (BASELINE_CHECKS)[f];
        if (!check) continue;
        const { rows } = await client.query(check);
        if (Object.values(rows[0])[0] === true) {
          await client.query("insert into public.schema_migrations(name) values ($1) on conflict do nothing", [f]);
          log(`${f}: ya estaba aplicada, registrada`);
        }
      }
    }

    const { rows: doneRows } = await client.query("select name from public.schema_migrations");
    const done = new Set(doneRows.map((r) => r.name));
    const pending = files.filter((f) => !done.has(f));

    if (pending.length === 0) log("Base de datos al día; nada pendiente.");

    for (const f of pending) {
      const sql = await readFile(path.join(dir, f), "utf8");
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query("insert into public.schema_migrations(name) values ($1)", [f]);
        await client.query("commit");
        applied.push(f);
        log(`${f}: aplicada`);
      } catch (err) {
        await client.query("rollback");
        const msg = err instanceof Error ? err.message : String(err);
        log(`${f} falló y se revirtió: ${msg}`);
        return { ok: false, lines, applied, error: msg };
      }
    }
    // Pide a PostgREST (la API de Supabase) que recargue el esquema para ver las tablas y columnas nuevas de inmediato.
    await client.query("notify pgrst, 'reload schema'").catch(() => {});
    return { ok: true, lines, applied };
  } finally {
    await client.query("select pg_advisory_unlock($1)", [LOCK_KEY]).catch(() => {});
    await client.end().catch(() => {});
  }
}
