import type { Metadata } from "next";
import { Logo } from "@/components/Logo";
import { ResetForm } from "./ResetForm";

export const metadata: Metadata = { title: "Nueva contraseña" };

export default function RestablecerPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-navy-50 p-6">
      <div className="w-full max-w-sm">
        <Logo variant="dark" className="mb-8" />
        <div className="rounded-2xl border border-navy-100 bg-white p-8 shadow-card">
          <h1 className="text-xl font-semibold text-navy-900">Define tu nueva contraseña</h1>
          <p className="mb-6 mt-1 text-sm text-slate-500">Llegaste aquí desde el enlace de recuperación de tu correo.</p>
          <ResetForm />
        </div>
      </div>
    </main>
  );
}
