import { Eye, KeyRound, Lock, ShieldCheck, Ticket } from "lucide-react";
import type { Metadata } from "next";
import { Card, CardHeader, PageHeader } from "@/components/ui/Card";
import { requireUser } from "@/lib/auth";
import { listAudit, listHelpers } from "@/lib/data";
import { TeamPanel } from "./TeamPanel";
import { fmtDateTime } from "@/lib/format";
import { PasswordForm } from "./PasswordForm";

export const metadata: Metadata = { title: "Seguridad" };

const ENTITY_LABEL: Record<string, string> = {
  account_password: "Contraseña de cuenta",
  license_key: "Clave de licencia",
  license_password: "Contraseña de licencia (cuenta)",
  client: "Cliente",
  account: "Cuenta",
  subscription: "Suscripción",
  license: "Licencia",
  member: "Ayudante",
};

const ACTION_LABEL: Record<string, string> = {
  reveal: "Consultó",
  create: "Creó",
  update: "Editó",
  trash: "Envió a la papelera",
  restore: "Restauró",
  purge: "Borró definitivamente",
  renew: "Renovó",
  reward: "Otorgó premio a",
  remind: "Envió recordatorio de",
  import: "Importó",
};

export default async function SeguridadPage() {
  const [{ user, isOwner, ownerEmail }, audit, helpers] = await Promise.all([requireUser(), listAudit(80), listHelpers()]);
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
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Rol</p>
                <p className="mt-1 text-slate-800">{isOwner ? "Dueño de la cuenta" : `Ayudante${ownerEmail ? ` de ${ownerEmail}` : ""} · sin acceso a contraseñas ni borrado`}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Lista de acceso</p>
                <p className="mt-1 text-slate-800">
                  {allowed.length ? `Solo ${allowed.length} correo${allowed.length > 1 ? "s" : ""} permitido${allowed.length > 1 ? "s" : ""}` : "No configurada (ALLOWED_EMAILS)"}
                </p>
              </div>
            </div>
          </Card>
          {isOwner && (
            <Card>
              <CardHeader title="Equipo" description="Ayudantes con acceso limitado" />
              <TeamPanel helpers={helpers} />
            </Card>
          )}
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
            <CardHeader title="Historial" description="Consultas de secretos y cambios en clientes, cuentas, suscripciones y licencias" />
            {audit.length === 0 ? (
              <p className="px-5 py-6 text-sm text-slate-500">Todavía no se ha revelado ningún secreto.</p>
            ) : (
              <ul className="divide-y divide-navy-100 text-sm">
                {audit.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-slate-800">
                      {a.entity.startsWith("license") ? <Ticket size={14} className="shrink-0 text-navy-600" /> : <KeyRound size={14} className="shrink-0 text-navy-600" />}
                      <span className="text-slate-500">{ACTION_LABEL[a.action] ?? a.action}</span>
                      <span>{ENTITY_LABEL[a.entity] ?? a.entity}</span>
                      {a.detail ? (
                        <span className="truncate font-medium text-navy-900">{a.detail}</span>
                      ) : (
                        <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-500">{a.entity_id?.slice(0, 8)}</code>
                      )}
                    </span>
                    <span className="shrink-0 text-right text-xs text-slate-500">
                      {fmtDateTime(a.created_at)}
                      {a.actor_email && <div className="text-slate-400">{a.actor_email}</div>}
                    </span>
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
