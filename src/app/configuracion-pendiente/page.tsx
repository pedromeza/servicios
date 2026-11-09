import { Logo } from "@/components/Logo";

const REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "ENCRYPTION_KEY",
  "ALLOWED_EMAILS",
  "CRON_SECRET",
];

export const dynamic = "force-dynamic";

export default function ConfiguracionPendiente() {
  const missing = REQUIRED.filter((k) => !process.env[k]);
  return (
    <main className="flex min-h-screen items-center justify-center bg-navy-50 p-6">
      <div className="w-full max-w-lg rounded-2xl border border-navy-100 bg-white p-8 shadow-card">
        <Logo variant="dark" className="mb-6" />
        <h1 className="text-xl font-semibold text-navy-900">Falta configurar la aplicación</h1>
        <p className="mt-2 text-sm text-slate-600">
          El servidor no tiene todas las variables de entorno. En Vercel ve a <strong>Settings → Environment Variables</strong>, agrega las
          siguientes y después haz <strong>Redeploy</strong>.
        </p>
        <ul className="mt-4 space-y-1.5">
          {REQUIRED.map((k) => {
            const ok = !missing.includes(k);
            return (
              <li key={k} className="flex items-center gap-2 font-mono text-xs">
                <span className={`inline-block h-2 w-2 rounded-full ${ok ? "bg-emerald-500" : "bg-red-500"}`} />
                <span className={ok ? "text-slate-500" : "text-navy-900"}>{k}</span>
                {!ok && <span className="font-sans text-red-600">falta</span>}
              </li>
            );
          })}
        </ul>
        <p className="mt-6 text-xs text-slate-400">Los valores y de dónde sale cada uno están en el README del repositorio.</p>
      </div>
    </main>
  );
}
