"use client";

import { AlertTriangle, CheckCircle2, DatabaseZap, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { runMigrationsNow, type MigrateState } from "@/lib/actions";
import { Button } from "@/components/ui/Button";

/** Banner que aparece en todas las páginas cuando la base de datos va atrasada respecto al código. */
export function SchemaNotice({ pending, hasDatabaseUrl }: { pending: string[]; hasDatabaseUrl: boolean }) {
  const [result, setResult] = useState<MigrateState>(null);
  const [running, start] = useTransition();
  if (pending.length === 0) return null;

  return (
    <div role="alert" className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <div className="flex items-start gap-2">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Base de datos desactualizada: faltan {pending.length} migraci{pending.length === 1 ? "ón" : "ones"}.</p>
          <ul className="mt-1 list-inside list-disc font-mono text-xs">
            {pending.map((p) => (
              <li key={p} className="break-all">
                {p}
              </li>
            ))}
          </ul>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button size="sm" disabled={running} onClick={() => start(async () => setResult(await runMigrationsNow()))}>
              {running ? <Loader2 size={14} className="animate-spin" /> : <DatabaseZap size={14} />}
              {running ? "Aplicando…" : "Aplicar migraciones ahora"}
            </Button>
            <span className="text-xs">
              {hasDatabaseUrl ? "DATABASE_URL está configurada." : "DATABASE_URL no está configurada en este despliegue."}
            </span>
          </div>

          {result && (
            <div className={`mt-3 rounded-lg border px-3 py-2 text-xs ${result.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>
              <p className="mb-1 flex items-center gap-1 font-semibold">
                {result.ok ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                {result.ok ? "Listo. Recarga la página si el aviso sigue visible." : "No se pudieron aplicar."}
              </p>
              <ul className="space-y-0.5 font-mono">
                {result.lines.map((l, i) => (
                  <li key={i} className="break-words">
                    {l}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="mt-3 text-xs text-amber-800">
            Alternativa manual: pega cada archivo de <code className="rounded bg-amber-100 px-1">supabase/migrations/</code> en Supabase → SQL Editor, en el orden de arriba.
          </p>
        </div>
      </div>
    </div>
  );
}
