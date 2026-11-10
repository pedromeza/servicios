import { Eye, KeyRound, Lock, ShieldCheck, Ticket } from "lucide-react";
import type { Metadata } from "next";
import { Card, CardHeader, PageHeader } from "@/components/ui/Card";
import { requireUser } from "@/lib/auth";
import { listAudit } from "@/lib/data";
import { fmtDateTime } from "@/lib/format";
import { PasswordForm } from "./PasswordForm";

export const metadata: Metadata = { title: "Seguridad" };

const ENTITY_LABEL: Record<string, string> = {
  account_password: "Contraseña de cuenta",
  license_key: "Clave de licencia",
  license_password: "Contraseña de licencia (cuenta)",
};

export default async function SeguridadPage() {
  const [{ user }, audit] = await Promise.all([requireUser(), listAudit(60)]);
  const allowed = (process.env.ALLOWED_EMAILS ?? "").split(",").map((s) => s.trim()).filter(Boolean);

  return (
    <>
      <PageHeader title="Seguridad" description="Cómo se protegen tus datos y quién los ha consultado" />
      <div className="grid min-w-0 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          <Card>
            <CardHeader title="Tu acceso" />
            <div className="space-y-3 px-5 py-4 text-sm">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sesión iniciada como</p>
                <p className="mt-1 break-all text-slate-800">{user.email}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Lista de acceso</p>
                <p className="mt-1 text-slate-800">
                  {allowed.length ? `Solo ${allowed.length} correo${allowed.length > 1 ? "s" : ""} permitido${allowed.length > 1 ? "s" : ""}` : "No configurada (ALLOWED_EMAILS)"}
                </p>
              </div>
            </div>
          </Card>
          <Card>
            <CardHeader title="Cambiar contraseña" />
            <div className="px-5 py-4">
              <PasswordForm />
            </div>
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Protecciones activas" />
            <ul className="divide-y divide-navy-100 text-sm">
              {[
                { icon: Lock, t: "Cifrado AES-256-GCM en reposo", d: "Correos, contraseñas, claves de licencia, contactos y notas se cifran antes de guardarse. La llave vive solo en el servidor." },
                { icon: Eye, t: "Secretos solo bajo demanda", d: "Contraseñas y claves nunca se envían al navegador en las listas; se descifran una por una al pulsar mostrar o copiar." },
                { icon: ShieldCheck, t: "Aislamiento por usuario (RLS)", d: "La base de datos solo devuelve filas del usuario autenticado. Sin sesión válida no hay acceso, ni con la URL correcta." },
                { icon: KeyRound, t: "Registro cerrado", d: "No existe página de registro. Los usuarios se crean a mano en Supabase y, opcionalmente, se limitan por correo." },
              ].map(({ icon: Icon, t, d }) => (
                <li key={t} className="flex gap-3 px-5 py-3">
                  <Icon size={18} className="mt-0.5 shrink-0 text-brand" />
                  <div>
                    <p className="font-medium text-navy-900">{t}</p>
                    <p className="text-slate-500">{d}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Bitácora de consultas" description="Cada vez que se revela o copia un secreto queda registrado" />
            {audit.length === 0 ? (
              <p className="px-5 py-6 text-sm text-slate-500">Todavía no se ha revelado ningún secreto.</p>
            ) : (
              <ul className="divide-y divide-navy-100 text-sm">
                {audit.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                    <span className="flex items-center gap-2 text-slate-800">
                      {a.entity === "license_key" || a.entity === "license_password" ? <Ticket size={14} className="text-navy-600" /> : <KeyRound size={14} className="text-navy-600" />}
                      {ENTITY_LABEL[a.entity] ?? a.entity}
                      <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-500">{a.entity_id?.slice(0, 8)}</code>
                    </span>
                    <span className="whitespace-nowrap text-xs text-slate-500">{fmtDateTime(a.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
