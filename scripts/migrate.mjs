#!/usr/bin/env node
/**
 * Aplica las migraciones SQL de supabase/migrations/ que todavía no se han ejecutado.
 * Se ejecuta en cada build de Vercel (ver package.json) y también a mano: `npm run migrate`.
 *
 * Necesita DATABASE_URL (Supabase > Connect > Session pooler). Si no está definida o no conecta,
 * avisa y deja continuar el build: la app muestra dentro qué migraciones faltan y un botón para aplicarlas.
 * Un error en el SQL de una migración sí detiene el build.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyMigrations } from "./migrate-core.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const url = process.env.DATABASE_URL;
if (!url) {
  console.warn("[migrate] DATABASE_URL no está definida; no se aplican migraciones. Hazlo desde el aviso de la app, a mano en Supabase > SQL Editor, o define la variable.");
  process.exit(0);
}

const result = await applyMigrations({
  url,
  dir: path.resolve(here, "..", "supabase", "migrations"),
  ssl: process.env.PGSSLMODE !== "disable", // para un Postgres local sin TLS: PGSSLMODE=disable
});
for (const line of result.lines) console.log(`[migrate] ${line}`);
if (!result.ok) {
  const connectionFailed = result.applied.length === 0 && result.lines[0]?.startsWith("No se pudo conectar");
  if (connectionFailed) {
    console.warn("[migrate] El despliegue continúa sin migrar.");
    process.exit(0);
  }
  process.exit(1);
}
