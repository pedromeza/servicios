import { AlertTriangle, ArrowUpRight, CalendarClock, KeyRound, RefreshCw, Ticket, TrendingUp } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader, EmptyState, Table, Td, Th } from "@/components/ui/Card";
import { dashboardData } from "@/lib/data";
import { daysUntil, fmtDate, fmtMoney } from "@/lib/format";
import { renewalTone } from "@/lib/renewal";
import { SUB_PLANS } from "@/lib/types";

function Stat({ icon, label, value, sub, accent }: { icon: ReactNode; label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <Card className={accent ? "border-brand/40 bg-gradient-to-br from-white to-brand-light/60" : ""}>
      <div className="flex items-start justify-between p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-navy-900">{value}</p>
          {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
        </div>
        <div className={`rounded-xl p-2.5 ${accent ? "bg-brand text-white" : "bg-navy-100 text-navy-700"}`}>{icon}</div>
      </div>
    </Card>
  );
}

export default async function DashboardPage() {
  const d = await dashboardData();
  const fecha = new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
  const hoy = fecha.charAt(0).toUpperCase() + fecha.slice(1);

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-navy-900">Panel</h1>
        <p className="mt-1 text-sm text-slate-500">{hoy}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={<RefreshCw size={20} />} label="Suscripciones activas" value={String(d.activeSubs)} />
        <Stat
          icon={<CalendarClock size={20} />}
          label="Renuevan en 30 días"
          value={String(d.renewingSoon)}
          sub={d.overdue ? `${d.overdue} vencida${d.overdue > 1 ? "s" : ""} sin atender` : "Nada vencido"}
          accent={d.renewingSoon > 0 || d.overdue > 0}
        />
        <Stat icon={<Ticket size={20} />} label="Licencias disponibles" value={String(d.availableLicenses)} sub={`${d.usedLicenses} ya utilizadas`} />
        <Stat
          icon={<TrendingUp size={20} />}
          label="Ganancia acumulada"
          value={fmtMoney(d.profit)}
          sub={`Ventas ${fmtMoney(d.revenue)} · Costo ${fmtMoney(d.cost)}`}
        />
      </div>

      <div className="mt-6 grid min-w-0 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Próximas renovaciones"
            description="Suscripciones activas que vencen en los próximos 60 días"
            action={
              <Link href="/suscripciones" className="inline-flex items-center gap-1 text-sm font-medium text-navy-700 hover:text-brand">
                Ver todas <ArrowUpRight size={14} />
              </Link>
            }
          />
          {d.upcoming.length === 0 ? (
            <EmptyState icon={<CalendarClock size={24} />} title="Sin renovaciones cercanas" description="Cuando una suscripción esté por vencer aparecerá aquí." />
          ) : (
            <Table>
              <thead className="border-b border-navy-100">
                <tr>
                  <Th>Cliente</Th>
                  <Th>Cuenta</Th>
                  <Th>Programas</Th>
                  <Th>Renueva</Th>
                  <Th className="text-right">Precio</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-100">
                {d.upcoming.map((s) => {
                  const days = daysUntil(s.renews_at);
                  const t = renewalTone(days);
                  return (
                    <tr key={s.id} className="hover:bg-navy-50/60">
                      <Td className="font-medium text-navy-900">{s.client_name ?? "—"}</Td>
                      <Td>
                        <div className="text-slate-800">{s.account_label}</div>
                        <div className="text-xs text-slate-400">{s.account_provider}</div>
                      </Td>
                      <Td>
                        <div className="text-slate-800">{s.products.join(", ")}</div>
                        <div className="text-xs text-slate-400">{SUB_PLANS[s.plan]}</div>
                      </Td>
                      <Td>
                        <div className="flex flex-col gap-1">
                          <span className="text-slate-800">{fmtDate(s.renews_at)}</span>
                          <Badge tone={t.tone}>
                            {days !== null && days <= 7 && <AlertTriangle size={11} />}
                            {t.label}
                          </Badge>
                        </div>
                      </Td>
                      <Td className="text-right font-medium text-navy-900">{fmtMoney(s.price, s.currency)}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Licencias por producto" />
            <div className="divide-y divide-navy-100">
              {d.licensesByProduct.length === 0 && <p className="px-5 py-6 text-sm text-slate-500">Aún no registras licencias.</p>}
              {d.licensesByProduct.map((l) => (
                <div key={l.product} className="flex items-center justify-between px-5 py-3 text-sm">
                  <span className="text-slate-800">{l.product}</span>
                  <div className="flex gap-1.5">
                    <Badge tone="success">{l.available} disp.</Badge>
                    <Badge tone="neutral">{l.used} usadas</Badge>
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <CardHeader title="Cuentas por proveedor" />
            <div className="divide-y divide-navy-100">
              {d.accountsByProvider.length === 0 && <p className="px-5 py-6 text-sm text-slate-500">Aún no registras cuentas.</p>}
              {d.accountsByProvider.map((p) => (
                <div key={p.provider} className="flex items-center justify-between px-5 py-3 text-sm">
                  <span className="flex items-center gap-2 text-slate-800">
                    <KeyRound size={14} className="text-navy-600" /> {p.provider}
                  </span>
                  <span className="font-semibold text-navy-900">{p.count}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
