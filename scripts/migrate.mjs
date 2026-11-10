#!/usr/bin/env node
/**
 * Aplica las migraciones SQL de supabase/migrations/ que todavía no se han ejecutado.
 *
 * - Lleva el registro en la tabla public.schema_migrations (se crea sola).
 * - La primera vez detecta qué migraciones ya aplicaste a mano y las marca sin volver a correrlas.
 * - Cada archivo corre dentro de una transacción; si falla, nada de ese archivo queda a medias.
 * - Usa un candado para que dos despliegues simultáneos no choquen.
 *
 * Se ejecuta en cada build de Vercel (ver package.json) y también a mano: `npm run migrate`.
 * Necesita DATABASE_URL (Supabase > Connect > Session pooler). Si no está definida, avisa y no hace nada,
 * para que el build local o un preview sin base de datos no se rompan.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const here = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(here, "..", "supabase", "migrations");
const LOCK_KEY = 7_283_119; // cualquier entero fijo: identifica el candado de migraciones

/**
 * Cómo reconocer, la primera vez, una migración que ya se ejecutó a mano en el SQL Editor.
 * Solo se consulta cuando la tabla schema_migrations todavía no existe.
 */
const BASELINE_CHECKS = {
  "0001_init.sql": `select to_regclass('public.clients') is not null`,
  "0002_subscription_email.sql": `select exists (select 1 from information_schema.columns where table_schema='public' and table_name='subscriptions' and column_name='email_enc')`,
  "0003_account_term.sql": `select exists (select 1 from information_schema.columns where table_schema='public' and table_name='accounts' and column_name='term_years')`,
  "0004_subscription_promo.sql": `select exists (select 1 from information_schema.columns where table_schema='public' and table_name='subscriptions' and column_name='promo_months')`,
  "0005_license_kind_term_seats.sql": `select to_regclass('public.license_seats') is not null`,
};

const url = process.env.DATABASE_URL;
if (!url) {
  console.warn("[migrate] DATABASE_URL no está definida; no se aplican migraciones. Hazlo a mano en Supabase > SQL Editor o define la variable.");
  process.exit(0);
}

// Supabase exige TLS; para un Postgres local sin TLS exporta PGSSLMODE=disable.
const ssl = process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: false };
const client = new pg.Client({ connectionString: url, ssl });
await client.connect();

try {
  await client.query("select pg_advisory_lock($1)", [LOCK_KEY]);

  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => /^\d+_.+\.sql$/.test(f)).sort();

  const { rows: existsRows } = await client.query(`select to_regclass('public.schema_migrations') is not null as present`);
  const trackingExists = existsRows[0].present;

  await client.query(`
    create table if not exists public.schema_migrations (
      name       text primary key,
      applied_at timestamptz not null default now()
    );
    alter table public.schema_migrations enable row level security;
    revoke all on public.schema_migrations from anon, authenticated;
  `);

  if (!trackingExists) {
    // Primera ejecución: marcar lo que ya estaba aplicado a mano para no repetirlo.
    for (const f of files) {
      const check = BASELINE_CHECKS[f];
      if (!check) continue;
      const { rows } = await client.query(check);
      const applied = Object.values(rows[0])[0] === true;
      if (applied) {
        await client.query("insert into public.schema_migrations(name) values ($1) on conflict do nothing", [f]);
        console.log(`[migrate] ${f}: ya estaba aplicada, registrada`);
      }
    }
  }

  const { rows: doneRows } = await client.query("select name from public.schema_migrations");
  const done = new Set(doneRows.map((r) => r.name));
  const pending = files.filter((f) => !done.has(f));

  if (pending.length === 0) {
    console.log("[migrate] Base de datos al día; nada pendiente.");
  }

  for (const f of pending) {
    const sql = await readFile(path.join(MIGRATIONS_DIR, f), "utf8");
    console.log(`[migrate] Aplicando ${f}…`);
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query("insert into public.schema_migrations(name) values ($1)", [f]);
      await client.query("commit");
      console.log(`[migrate] ${f}: lista`);
    } catch (err) {
      await client.query("rollback");
      console.error(`[migrate] ${f} falló y se revirtió:`, err.message);
      process.exitCode = 1;
      break; // las siguientes suelen depender de esta
    }
  }
} finally {
  await client.query("select pg_advisory_unlock($1)", [LOCK_KEY]).catch(() => {});
  await client.end();
}
