import type { Metadata } from "next";
import { Logo, LogoMark } from "@/components/Logo";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Iniciar sesión" };

const ERRORS: Record<string, string> = {
  "no-autorizado": "Tu correo no está en la lista de acceso permitido.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  const code = Array.isArray(error) ? error[0] : error;

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-navy-900 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -right-32 -top-32 h-[480px] w-[480px] rounded-full bg-navy-700/50 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -left-20 h-[420px] w-[420px] rounded-full bg-brand/20 blur-3xl" />
        <Logo className="relative" />
        <div className="relative">
          <LogoMark size={160} className="mb-8 text-white/90" />
          <h1 className="text-4xl font-bold leading-tight tracking-tight">
            Tus cuentas, suscripciones y licencias,
            <br />
            <span className="text-brand">en un solo lugar.</span>
          </h1>
          <p className="mt-4 max-w-md text-navy-200">
            Datos sensibles cifrados con AES-256, acceso restringido y avisos de renovación automáticos.
          </p>
        </div>
        <p className="relative text-xs text-navy-200/70">© {new Date().getFullYear()} PGPM MEX · Soluciones digitales</p>
      </section>

      <section className="flex items-center justify-center bg-navy-50 p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo variant="dark" />
          </div>
          <div className="rounded-2xl border border-navy-100 bg-white p-8 shadow-card">
            <h2 className="text-xl font-semibold text-navy-900">Iniciar sesión</h2>
            <p className="mb-6 mt-1 text-sm text-slate-500">Acceso exclusivo para el administrador.</p>
            <LoginForm initialError={code ? ERRORS[code] ?? "No se pudo iniciar sesión." : undefined} />
          </div>
        </div>
      </section>
    </main>
  );
}
