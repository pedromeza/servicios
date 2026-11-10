import { AlertTriangle } from "lucide-react";

/** Banner que aparece en todas las páginas cuando la base de datos va atrasada respecto al código. */
export function SchemaNotice({ pending }: { pending: string[] }) {
  if (pending.length === 0) return null;
  return (
    <div role="alert" className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <div className="flex items-start gap-2">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" />
        <div className="min-w-0">
          <p className="font-semibold">Base de datos desactualizada: faltan {pending.length} migraci{pending.length === 1 ? "ón" : "ones"}.</p>
          <p className="mt-1">
            Algunas secciones no guardarán hasta aplicarlas. Si configuraste <code className="rounded bg-amber-100 px-1">DATABASE_URL</code> en Vercel, revisa el
            log del último despliegue (líneas <code className="rounded bg-amber-100 px-1">[migrate]</code>) o vuelve a desplegar. También puedes pegar cada
            archivo en Supabase → SQL Editor, en este orden:
          </p>
          <ul className="mt-1 list-inside list-disc font-mono text-xs">
            {pending.map((p) => (
              <li key={p} className="break-all">
                supabase/migrations/{p}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
