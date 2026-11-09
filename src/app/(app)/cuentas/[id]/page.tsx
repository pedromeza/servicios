import { ArrowLeft, ShieldCheck, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader, Table, Td, Th } from "@/components/ui/Card";
import { SecretField } from "@/components/ui/SecretField";
import { getAccount } from "@/lib/data";
import { daysUntil, fmtDate, fmtMoney } from "@/lib/format";
import { renewalTone } from "@/lib/renewal";
import { SUB_PLANS, SUB_STATUS } from "@/lib/types";

export const metadata: Metadata = { title: "Detalle de cuenta" };

export default async function CuentaDetallePage({ params }: PageProps<"/cuentas/[id]">) {
  const { id } = await params;
  const data = await getAccount(id);
  if (!data) notFound();
  const { account: a, children, subscriptions } = data;

  return (
    <>
      <Link href="/cuentas" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-navy-900">
        <ArrowLeft size={14} /> Cuentas
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-navy-900">{a.label}</h1>
            {a.role === "admin" ? (
              <Badge tone="navy">
                <ShieldCheck size={11} /> Administrador
              </Badge>
            ) : (
              <Badge>Usuario</Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {a.provider}
            {a.client_name ? ` · asignada a ${a.client_name}` : " · cuenta propia"}
            {a.parent_label ? ` · depende de ${a.parent_label}` : ""}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader title="Acceso" description="Datos cifrados; revelar queda en bitácora" />
          <dl className="space-y-4 px-5 py-4 text-sm">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Correo / usuario</dt>
              <dd className="mt-1 break-all text-slate-800">{a.username}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Contraseña</dt>
              <dd className="mt-1">{a.has_password ? <SecretField entity="account_password" id={a.id} /> : <span className="text-slate-400">No guardada</span>}</dd>
            </div>
            {a.notes && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Notas</dt>
                <dd className="mt-1 whitespace-pre-wrap text-slate-700">{a.notes}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Registrada</dt>
              <dd className="mt-1 text-slate-700">{fmtDate(a.created_at.slice(0, 10))}</dd>
            </div>
          </dl>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Suscripciones de esta cuenta" description={`${subscriptions.length} registrada${subscriptions.length === 1 ? "" : "s"}`} />
            {subscriptions.length === 0 ? (
              <p className="px-5 py-6 text-sm text-slate-500">Esta cuenta no tiene suscripciones. Agrégalas desde la sección Suscripciones.</p>
            ) : (
              <Table>
                <thead className="border-b border-navy-100">
                  <tr>
                    <Th>Programas</Th>
                    <Th>Cliente</Th>
                    <Th>Renueva</Th>
                    <Th>Estado</Th>
                    <Th className="text-right">Precio</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-100">
                  {subscriptions.map((s) => {
                    const t = renewalTone(daysUntil(s.renews_at));
                    return (
                      <tr key={s.id}>
                        <Td>
                          <div className="text-slate-800">{s.products.join(", ")}</div>
                          <div className="text-xs text-slate-400">
                            {SUB_PLANS[s.plan]} · {s.seats} puesto{s.seats === 1 ? "" : "s"}
                          </div>
                        </Td>
                        <Td>{s.client_name ?? "—"}</Td>
                        <Td>
                          <div>{fmtDate(s.renews_at)}</div>
                          {s.status === "active" && <Badge tone={t.tone}>{t.label}</Badge>}
                        </Td>
                        <Td>
                          <Badge tone={s.status === "active" ? "success" : s.status === "expired" ? "danger" : "neutral"}>{SUB_STATUS[s.status]}</Badge>
                        </Td>
                        <Td className="text-right font-medium text-navy-900">{fmtMoney(s.price, s.currency)}</Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            )}
          </Card>

          {a.role === "admin" && (
            <Card>
              <CardHeader title="Cuentas de usuario que dependen de esta" description={`${children.length} vinculada${children.length === 1 ? "" : "s"}`} />
              {children.length === 0 ? (
                <p className="px-5 py-6 text-sm text-slate-500">Ninguna cuenta de usuario apunta a esta administradora todavía.</p>
              ) : (
                <ul className="divide-y divide-navy-100">
                  {children.map((c) => (
                    <li key={c.id} className="flex items-center justify-between px-5 py-3 text-sm">
                      <div className="flex items-center gap-3">
                        <Users size={16} className="text-navy-600" />
                        <div>
                          <Link href={`/cuentas/${c.id}`} className="font-medium text-navy-900 hover:text-brand">
                            {c.label}
                          </Link>
                          <div className="text-xs text-slate-400">{c.username}</div>
                        </div>
                      </div>
                      <span className="text-slate-500">{c.client_name ?? "Propia"}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
