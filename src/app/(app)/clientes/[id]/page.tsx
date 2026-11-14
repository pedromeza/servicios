import { ArrowLeft, BellRing, Check, Gift, KeyRound, MessageCircle, RefreshCw, Ticket } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader, Table, Td, Th } from "@/components/ui/Card";
import { getClient } from "@/lib/data";
import { daysUntil, fmtDate, fmtDateTime, fmtMoney } from "@/lib/format";
import { LOYALTY } from "@/lib/loyalty";
import { daysPhrase, fillTemplate, whatsappLink, type ReminderVars } from "@/lib/reminders";
import { renewalTone } from "@/lib/renewal";
import { LICENSE_TERMS, SUB_PLANS, SUB_STATUS } from "@/lib/types";

export const metadata: Metadata = { title: "Detalle de cliente" };

export default async function ClienteDetallePage({ params }: PageProps<"/clientes/[id]">) {
  const { id } = await params;
  const data = await getClient(id);
  if (!data) notFound();
  const { client: c, subscriptions, licenses, card, reminders, renewalEvents, money, settings, phone } = data;
  const waFor = (s: (typeof subscriptions)[number]) => {
    if (!phone) return null;
    const vars: ReminderVars = {
      cliente: c.name,
      programas: s.products.join(", ") || "tu programa",
      fecha_compra: fmtDate(s.purchased_at),
      fecha_renovacion: fmtDate(s.renews_at),
      dias: daysPhrase(daysUntil(s.renews_at) ?? 0),
      precio: fmtMoney(s.price, s.currency),
      plataforma: c.platform ?? "nuestra tienda",
      whatsapp: settings.whatsapp || "nuestro WhatsApp",
    };
    return whatsappLink(phone, fillTemplate(settings.whatsapp_body, vars));
  };

  const active = subscriptions.filter((s) => s.status === "active");
  const next = active
    .filter((s) => s.renews_at)
    .map((s) => s.renews_at as string)
    .sort()[0];
  const nextDays = daysUntil(next ?? null);
  const sold = subscriptions.reduce((n, s) => n + s.price, 0);
  const renewals = subscriptions.reduce((n, s) => n + s.renewals, 0);

  return (
    <>
      <Link href="/clientes" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-navy-900">
        <ArrowLeft size={14} /> Clientes
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-bold tracking-tight text-navy-900">{c.name}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {c.platform ?? "Sin plataforma"}
            {c.platform_ref ? ` · ${c.platform_ref}` : ""}
            {c.contact ? ` · ${c.contact}` : ""}
            {` · cliente desde ${fmtDate(c.created_at.slice(0, 10))}`}
          </p>
          {c.notes && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{c.notes}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {phone ? (
            <a
              href={whatsappLink(phone, `Hola ${c.name}, te saludamos de PGPM MEX.`)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#25D366] px-3 text-sm font-medium text-white hover:bg-[#1ebe5d]"
            >
              <MessageCircle size={15} /> WhatsApp
            </a>
          ) : (
            <span className="text-xs text-slate-400" title="Agrega un teléfono en el contacto del cliente">
              Sin teléfono para WhatsApp
            </span>
          )}
          <Link href={`/renovaciones`} className="inline-flex items-center gap-1 text-sm font-medium text-navy-700 hover:text-brand">
            <BellRing size={14} /> Ir a Renovaciones
          </Link>
        </div>
      </div>

      <div className="mb-6 grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="Suscripciones" value={String(subscriptions.length)} sub={`${active.length} activa${active.length === 1 ? "" : "s"}`} icon={<RefreshCw size={18} />} />
        <Stat
          label="Próxima renovación"
          value={next ? fmtDate(next) : "—"}
          sub={next ? renewalTone(nextDays).label : "Sin fechas"}
          icon={<BellRing size={18} />}
          accent={nextDays !== null && nextDays <= 30}
        />
        <Stat
          label="Cobrado en renovaciones"
          value={fmtMoney(money.renewals_collected)}
          sub={`${renewals} renovaci${renewals === 1 ? "ón" : "ones"} · ventas ${fmtMoney(sold)}`}
          icon={<Check size={18} />}
        />
        <Stat
          label="Por cobrar al renovar"
          value={fmtMoney(money.upcoming_year)}
          sub={money.upcoming_30 > 0 ? `${fmtMoney(money.upcoming_30)} en los próximos 30 días` : money.overdue > 0 ? `${fmtMoney(money.overdue)} vencido sin renovar` : "Nada próximo"}
          icon={<RefreshCw size={18} />}
          accent={money.upcoming_30 > 0}
        />
        <Stat
          label="Lealtad"
          value={card ? `${card.progress} / ${LOYALTY.stampsPerReward}` : "—"}
          sub={card ? (card.rewards_available > 0 ? `${card.rewards_available} premio por otorgar` : `${card.total_stamps} sellos en total`) : "Sin tarjeta"}
          icon={<Gift size={18} />}
          accent={Boolean(card && card.rewards_available > 0)}
        />
      </div>

      <div className="grid min-w-0 gap-6">
        {active.length > 0 && (
          <Card>
            <CardHeader
              title="Licencias activas ahora"
              description={`${active.reduce((n, s) => n + s.seats, 0)} puesto${active.reduce((n, s) => n + s.seats, 0) === 1 ? "" : "s"} en ${active.length} suscripci${active.length === 1 ? "ón" : "ones"} activa${active.length === 1 ? "" : "s"}`}
            />
            <div className="grid gap-3 px-5 py-4 sm:grid-cols-2 xl:grid-cols-3">
              {active
                .slice()
                .sort((a, b) => (a.renews_at ?? "9999").localeCompare(b.renews_at ?? "9999"))
                .map((s) => {
                  const d = daysUntil(s.renews_at);
                  const t = renewalTone(d);
                  return (
                    <div key={s.id} className={`rounded-xl border p-4 ${d !== null && d <= 30 ? "border-amber-200 bg-amber-50/60" : "border-navy-100 bg-navy-50/60"}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-semibold text-navy-900">{s.products.join(", ")}</div>
                          <div className="text-xs text-slate-500">
                            {s.seats} puesto{s.seats === 1 ? "" : "s"} · {s.account_label}
                          </div>
                        </div>
                        <Badge tone={t.tone}>{t.label}</Badge>
                      </div>
                      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                        <dt className="text-slate-500">Compra</dt>
                        <dd className="text-slate-800">{fmtDate(s.purchased_at)}</dd>
                        <dt className="text-slate-500">Renueva</dt>
                        <dd className="font-medium text-slate-800">{fmtDate(s.renews_at)}</dd>
                        <dt className="text-slate-500">Renovada</dt>
                        <dd className="text-slate-800">{s.renewals > 0 ? `${s.renewals} vez${s.renewals === 1 ? "" : "es"}` : "nunca"}</dd>
                        <dt className="text-slate-500">Precio</dt>
                        <dd className="text-slate-800">{fmtMoney(s.price, s.currency)}</dd>
                      </dl>
                      {s.emails.length > 0 && (
                        <div className="mt-2 border-t border-navy-100 pt-2 text-xs text-slate-600">
                          {s.emails.map((e) => (
                            <div key={e} className="break-all">
                              {e}
                            </div>
                          ))}
                        </div>
                      )}
                      {waFor(s) && (
                        <a
                          href={waFor(s)!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-3 inline-flex h-8 items-center gap-1 rounded-lg bg-[#25D366] px-2.5 text-xs font-medium text-white hover:bg-[#1ebe5d]"
                        >
                          <MessageCircle size={13} /> Recordar por WhatsApp
                        </a>
                      )}
                    </div>
                  );
                })}
            </div>
          </Card>
        )}

        <Card>
          <CardHeader
            title="Suscripciones y renovaciones"
            description={`${subscriptions.length} registrada${subscriptions.length === 1 ? "" : "s"} · las vencidas y canceladas también aparecen`}
            action={
              <Link href={`/suscripciones?q=${encodeURIComponent(c.name)}`} className="text-sm font-medium text-navy-700 hover:text-brand">
                Editar en Suscripciones
              </Link>
            }
          />
          {subscriptions.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-500">Este cliente no tiene suscripciones. Agrégalas desde la sección Suscripciones.</p>
          ) : (
            <Table>
              <thead className="border-b border-navy-100">
                <tr>
                  <Th>Programas</Th>
                  <Th>Cuenta</Th>
                  <Th>Correos</Th>
                  <Th>Compra</Th>
                  <Th>Renueva</Th>
                  <Th>Renovada</Th>
                  <Th className="text-right">Precio</Th>
                  <Th>Estado</Th>
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
                          {s.promo_months > 0 ? ` · +${s.promo_months} mes${s.promo_months === 1 ? "" : "es"} gratis` : ""}
                        </div>
                      </Td>
                      <Td>
                        <div className="text-slate-800">{s.account_label}</div>
                        <div className="text-xs text-slate-400">{s.account_provider}</div>
                      </Td>
                      <Td>
                        {s.emails.length === 0 ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          s.emails.map((e) => (
                            <div key={e} className="break-all text-xs text-slate-600">
                              {e}
                            </div>
                          ))
                        )}
                      </Td>
                      <Td className="whitespace-nowrap">{fmtDate(s.purchased_at)}</Td>
                      <Td>
                        <div className="whitespace-nowrap">{fmtDate(s.renews_at)}</div>
                        {s.status === "active" && s.renews_at && (
                          <Badge tone={t.tone} className="mt-1">
                            {t.label}
                          </Badge>
                        )}
                      </Td>
                      <Td className="whitespace-nowrap">{s.renewals > 0 ? `${s.renewals} vez${s.renewals === 1 ? "" : "es"}` : <span className="text-slate-400">—</span>}</Td>
                      <Td className="whitespace-nowrap text-right font-medium text-navy-900">{fmtMoney(s.price, s.currency)}</Td>
                      <Td>
                        <Badge tone={s.status === "active" ? "success" : s.status === "expired" ? "danger" : "neutral"}>{SUB_STATUS[s.status]}</Badge>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>

        <div className="grid min-w-0 gap-6 lg:grid-cols-3">
          <Card>
            <CardHeader title="Licencias" description={`${licenses.length} asignada${licenses.length === 1 ? "" : "s"} (propias o por puesto)`} />
            {licenses.length === 0 ? (
              <p className="px-5 py-6 text-sm text-slate-500">Sin licencias asignadas.</p>
            ) : (
              <ul className="divide-y divide-navy-100 text-sm">
                {licenses.map((l) => {
                  const seat = l.seat_assignments.find((s) => s.client_id === id);
                  return (
                    <li key={l.id} className="flex items-start justify-between gap-3 px-5 py-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 font-medium text-navy-900">
                          {l.kind === "account" ? <KeyRound size={13} className="text-slate-400" /> : <Ticket size={13} className="text-slate-400" />}
                          {l.product}
                        </div>
                        <div className="text-xs text-slate-500">
                          {LICENSE_TERMS[l.term]}
                          {l.expires_at ? ` · vence ${fmtDate(l.expires_at)}` : ""}
                          {seat ? ` · puesto: ${seat.email ?? "sin correo"}` : l.kind === "account" ? " · cuenta principal" : ""}
                        </div>
                      </div>
                      <Badge tone={l.status === "available" ? "success" : "neutral"}>{l.status === "available" ? "Disponible" : "Utilizada"}</Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Cobros de renovación"
              description={renewalEvents.length === 0 ? "Aún no se registra ninguna renovación cobrada" : `${renewalEvents.length} cobro${renewalEvents.length === 1 ? "" : "s"} · ${fmtMoney(money.renewals_collected)} en total`}
            />
            {renewalEvents.length === 0 ? (
              <p className="px-5 py-6 text-sm text-slate-500">Al pulsar Renovar en una suscripción se registra aquí cuánto cobraste y qué periodo cubre.</p>
            ) : (
              <ul className="divide-y divide-navy-100 text-sm">
                {renewalEvents.map((ev) => {
                  const sub = subscriptions.find((s) => s.id === ev.subscription_id);
                  return (
                    <li key={ev.id} className="flex items-start justify-between gap-3 px-5 py-3">
                      <div className="min-w-0">
                        <div className="text-slate-800">
                          {ev.products.length > 0 ? ev.products.join(", ") : (sub?.products.join(", ") ?? "Suscripción")}
                          {ev.plan === "suite" && <span className="ml-1 text-xs text-slate-500">· suite completa</span>}
                        </div>
                        <div className="text-xs text-slate-500">
                          {fmtDate(ev.renewed_at)}
                          {ev.to_date ? ` · cubre hasta ${fmtDate(ev.to_date)}` : ""}
                        </div>
                      </div>
                      <span className="shrink-0 font-medium text-navy-900">{fmtMoney(ev.amount, ev.currency)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Recordatorios enviados"
              description={reminders.length === 0 ? "Aún no se le ha enviado ninguno" : `${reminders.length} correo${reminders.length === 1 ? "" : "s"} de renovación`}
            />
            {reminders.length === 0 ? (
              <p className="px-5 py-6 text-sm text-slate-500">Cuando le mandes un recordatorio desde Renovaciones aparecerá aquí.</p>
            ) : (
              <ul className="divide-y divide-navy-100 text-sm">
                {reminders.map((r) => (
                  <li key={r.id} className="flex items-start justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <div className="text-slate-800">{r.products || "Suscripción"}</div>
                      <div className="break-all text-xs text-slate-500">{r.to ?? "—"}</div>
                    </div>
                    <span className="shrink-0 text-xs text-slate-500">{fmtDateTime(r.sent_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {card && (
          <Card>
            <CardHeader
              title="Tarjeta de lealtad"
              description={`${card.total_stamps} sello${card.total_stamps === 1 ? "" : "s"} · ${card.rewards.length} premio${card.rewards.length === 1 ? "" : "s"} otorgado${card.rewards.length === 1 ? "" : "s"}`}
              action={
                <Link href="/lealtad" className="text-sm font-medium text-navy-700 hover:text-brand">
                  Ver en Lealtad
                </Link>
              }
            />
            <div className="flex flex-wrap items-center gap-4 px-5 py-4">
              <div className="flex items-center gap-2">
                {Array.from({ length: LOYALTY.stampsPerReward }).map((_, i) => (
                  <div
                    key={i}
                    className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-bold ${
                      i < card.progress ? "border-brand bg-brand text-white" : "border-dashed border-slate-300 text-slate-300"
                    }`}
                  >
                    {i < card.progress ? <Check size={16} strokeWidth={3} /> : i + 1}
                  </div>
                ))}
              </div>
              <p className="text-sm text-slate-600">
                {card.rewards_available > 0
                  ? `Tiene ${card.rewards_available} premio${card.rewards_available === 1 ? "" : "s"} por otorgar: ${LOYALTY.rewardLabel}.`
                  : `Le falta${LOYALTY.stampsPerReward - card.progress === 1 ? "" : "n"} ${LOYALTY.stampsPerReward - card.progress} sello${LOYALTY.stampsPerReward - card.progress === 1 ? "" : "s"} para ${LOYALTY.rewardLabel}.`}
              </p>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}

function Stat({ label, value, sub, icon, accent }: { label: string; value: string; sub?: string; icon: React.ReactNode; accent?: boolean }) {
  return (
    <Card className="flex items-center justify-between px-4 py-3">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-0.5 truncate text-xl font-bold text-navy-900">{value}</p>
        {sub && <p className="truncate text-xs text-slate-500">{sub}</p>}
      </div>
      <div className={`shrink-0 rounded-xl p-2.5 ${accent ? "bg-brand text-white" : "bg-navy-100 text-navy-700"}`}>{icon}</div>
    </Card>
  );
}
