"use client";

import { AlertTriangle, BellRing, CheckCircle2, Mail, MailCheck, MailX, MessageCircle, Send } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { sendReminders, type SendResult } from "@/lib/actions";
import type { EmailProvider } from "@/lib/email";
import { fmtDate, fmtDateTime, fmtMoney } from "@/lib/format";
import { daysPhrase, fillTemplate, whatsappLink, type ReminderSettings, type ReminderVars } from "@/lib/reminders";
import { renewalTone } from "@/lib/renewal";
import { productsText } from "@/lib/products";
import type { ReminderCandidate } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { PayLinkButton } from "@/components/ui/PayLinkButton";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { Select } from "@/components/ui/Fields";
import { TemplateEditor } from "./TemplateEditor";

export function RemindersManager({
  settings,
  candidates,
  days,
  mail,
  testTo,
  resendReady,
  defaultLogoUrl,
  mpReady = false,
}: {
  settings: ReminderSettings;
  candidates: ReminderCandidate[];
  days: number;
  mail: EmailProvider;
  testTo: string;
  resendReady: boolean;
  defaultLogoUrl: string;
  /** Mercado Pago conectado (MP_ACCESS_TOKEN): se pueden generar links de pago. */
  mpReady?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<string[] | null>(null);
  const [results, setResults] = useState<SendResult[] | null>(null);
  const [pending, start] = useTransition();

  const withEmail = candidates.filter((c) => c.emails.length > 0);
  /** Botones de un cliente: WhatsApp, correo y link de pago. Nunca parten su texto en varias líneas. */
  const rowActions = (c: ReminderCandidate) => (
    <>
      {waFor(c) ? (
        <a
          href={waFor(c)!}
          target="_blank"
          rel="noopener noreferrer"
          title="Abrir WhatsApp con el mensaje escrito"
          className="inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-lg bg-[#25D366] px-2.5 text-xs font-medium text-white hover:bg-[#1ebe5d]"
        >
          <MessageCircle size={13} /> WhatsApp
        </a>
      ) : (
        <span
          title="Sin teléfono: agrega el número en el contacto del cliente"
          className="inline-flex h-8 shrink-0 cursor-not-allowed items-center gap-1 whitespace-nowrap rounded-lg bg-slate-100 px-2.5 text-xs text-slate-400"
        >
          <MessageCircle size={13} /> WhatsApp
        </span>
      )}
      <Button size="sm" variant="secondary" className="shrink-0" disabled={c.emails.length === 0 || !resendReady || pending} onClick={() => setConfirm([c.subscription_id])}>
        <Send size={13} /> Correo
      </Button>
      {mpReady && (
        <PayLinkButton
          subscriptionId={c.subscription_id}
          renewal={{ price: c.price, currency: c.currency, plan: c.plan, products: c.products, provider: c.provider, purchased_at: c.purchased_at, renews_at: c.renews_at }}
          phone={c.phone}
          label="Link"
          className="shrink-0"
          waIntro={`Hola ${c.client_name}, te saludamos de PGPM MEX. Aquí tienes tu link para renovar ${productsText(c.plan, c.products, c.provider)}`}
        />
      )}
    </>
  );
  const waFor = (c: ReminderCandidate) => {
    if (!c.phone) return null;
    const vars: ReminderVars = {
      cliente: c.client_name,
      programas: productsText(c.plan, c.products, c.provider) || "tu programa",
      fecha_compra: fmtDate(c.purchased_at),
      fecha_renovacion: fmtDate(c.renews_at),
      dias: daysPhrase(c.days),
      precio: fmtMoney(c.price, c.currency),
      plataforma: c.platform ?? "nuestra tienda",
      whatsapp: settings.whatsapp || "nuestro WhatsApp",
    };
    return whatsappLink(c.phone, fillTemplate(settings.whatsapp_body, vars));
  };
  const allSelectable = withEmail.map((c) => c.subscription_id);
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const setDays = (d: string) => {
    const next = new URLSearchParams(params.toString());
    next.set("dias", d);
    router.replace(`${pathname}?${next}`);
  };

  return (
    <>
      <PageHeader
        title="Renovaciones"
        description={`${candidates.length} suscripci${candidates.length === 1 ? "ón vence" : "ones vencen"} en los próximos ${days} días o ya vencieron · ${withEmail.length} con correo`}
      />

      {mail.provider === "none" ? (
        <Notice tone="danger">
          La app no puede enviar correos todavía. En Vercel define <code>GMAIL_USER</code> y <code>GMAIL_APP_PASSWORD</code> para enviar desde tu
          Gmail, o <code>RESEND_API_KEY</code> para usar Resend.
        </Notice>
      ) : mail.provider === "gmail" ? (
        <Notice tone="success">
          Enviando desde tu Gmail: <code>{mail.from}</code>. Los correos llegan a la bandeja principal y las respuestas caen en tu Gmail. Gmail
          permite unos 500 envíos al día.
        </Notice>
      ) : mail.limited ? (
        <Notice tone="warning">
          Estás enviando desde <code>{mail.from}</code>, el remitente de prueba de Resend: <strong>solo llega a tu propio correo</strong> y suele
          caer en spam. Para escribir a clientes, configura tu Gmail (<code>GMAIL_USER</code> y <code>GMAIL_APP_PASSWORD</code>) o verifica un dominio en
          Resend.
        </Notice>
      ) : (
        <Notice tone="success">
          Enviando con Resend desde <code>{mail.from}</code>.
        </Notice>
      )}

      <div className="mb-6">
        <TemplateEditor settings={settings} testTo={testTo} resendReady={resendReady} defaultLogoUrl={defaultLogoUrl} />
      </div>

      <Card>
        <CardHeader
          title="Clientes por avisar"
          description="Suscripciones activas por vencer. Marca a quién avisar y envía el correo con la plantilla guardada."
          action={
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-full sm:w-44">
              <Select value={String(days)} onChange={(ev) => setDays(ev.target.value)} aria-label="Ventana de días">
                {[7, 15, 30, 45, 60, 90].map((d) => (
                  <option key={d} value={d}>
                    Próximos {d} días
                  </option>
                ))}
              </Select>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelected(selected.size === allSelectable.length ? new Set() : new Set(allSelectable))}
                disabled={allSelectable.length === 0}
              >
                {selected.size === allSelectable.length && allSelectable.length > 0 ? "Quitar selección" : `Seleccionar ${allSelectable.length} con correo`}
              </Button>
              <Button size="sm" onClick={() => setConfirm([...selected])} disabled={selected.size === 0 || !resendReady}>
                <Send size={14} /> Enviar a {selected.size} seleccionado{selected.size === 1 ? "" : "s"}
              </Button>
            </div>
          }
        />

        {results && (
          <div className="border-b border-navy-100 px-5 py-3 text-sm">
            <p className="mb-1 font-semibold text-navy-900">
              Resultado: {results.filter((r) => r.ok).length} enviado{results.filter((r) => r.ok).length === 1 ? "" : "s"},{" "}
              {results.filter((r) => !r.ok).length} con error.
            </p>
            <ul className="space-y-0.5 text-xs">
              {results.map((r) => (
                <li key={r.subscription_id} className={r.ok ? "text-emerald-700" : "text-red-700"}>
                  {r.ok ? <CheckCircle2 size={12} className="mr-1 inline" /> : <AlertTriangle size={12} className="mr-1 inline" />}
                  {r.client} {r.email ? `· ${r.email}` : ""} {r.error ? `· ${r.error}` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}

        {candidates.length === 0 ? (
          <EmptyState icon={<BellRing size={24} />} title="Nada por vencer" description={`Ninguna suscripción activa vence en los próximos ${days} días.`} />
        ) : (
          <>
            {/* Teléfono: una tarjeta por cliente, sin desplazamiento lateral. */}
            <ul className="divide-y divide-navy-100 md:hidden">
              {candidates.map((c) => {
                const t = renewalTone(c.days);
                return (
                  <li key={c.subscription_id} className={`px-4 py-3 ${selected.has(c.subscription_id) ? "bg-brand-light/40" : ""}`}>
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-1 accent-brand"
                        aria-label={`Seleccionar ${c.client_name}`}
                        disabled={c.emails.length === 0}
                        checked={selected.has(c.subscription_id)}
                        onChange={() => toggle(c.subscription_id)}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-medium text-navy-900">{c.client_name}</div>
                            <div className="text-xs text-slate-500" title={c.products.join(", ")}>
                              {productsText(c.plan, c.products, c.provider)}
                              {c.platform ? ` · ${c.platform}` : ""}
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <div className="font-semibold text-navy-900">{fmtMoney(c.price, c.currency)}</div>
                            <Badge tone={t.tone} className="mt-0.5">
                              {t.label}
                            </Badge>
                          </div>
                        </div>
                        <div className="mt-1.5 space-y-0.5 text-xs text-slate-600">
                          <div>
                            Vence <span className="font-medium text-navy-900">{fmtDate(c.renews_at)}</span> · compra {fmtDate(c.purchased_at)}
                          </div>
                          {c.emails.length > 0 ? (
                            c.emails.map((e) => (
                              <div key={e} className="flex items-center gap-1 break-all">
                                <Mail size={12} className="shrink-0 text-slate-400" /> {e}
                              </div>
                            ))
                          ) : (
                            <div className="flex items-center gap-1 text-red-600">
                              <MailX size={12} /> Sin correo
                            </div>
                          )}
                          <div className="text-slate-400">{c.last_reminder_at ? `Último aviso ${fmtDateTime(c.last_reminder_at)} · ${c.reminders_sent} enviado${c.reminders_sent === 1 ? "" : "s"}` : "Sin avisos enviados"}</div>
                        </div>
                        <div className="mt-2.5 flex flex-wrap gap-1.5">{rowActions(c)}</div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* Pantallas medianas y grandes: tabla. */}
            <Table className="hidden md:block">
              <thead className="border-b border-navy-100">
                <tr>
                  <Th className="w-8" />
                  <Th>Cliente</Th>
                  <Th>Programas</Th>
                  <Th>Vence</Th>
                  <Th className="text-right">Precio</Th>
                  <Th>Último aviso</Th>
                  <Th />
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-100">
                {candidates.map((c) => {
                  const t = renewalTone(c.days);
                  return (
                    <tr key={c.subscription_id} className={`hover:bg-navy-50/60 ${selected.has(c.subscription_id) ? "bg-brand-light/40" : ""}`}>
                      <Td>
                        <input
                          type="checkbox"
                          className="accent-brand"
                          aria-label={`Seleccionar ${c.client_name}`}
                          disabled={c.emails.length === 0}
                          checked={selected.has(c.subscription_id)}
                          onChange={() => toggle(c.subscription_id)}
                        />
                      </Td>
                      <Td>
                        <div className="font-medium text-navy-900">{c.client_name}</div>
                        {c.emails.length > 0 ? (
                          c.emails.map((e) => (
                            <div key={e} className="flex items-center gap-1 text-xs text-slate-500">
                              <Mail size={12} className="shrink-0 text-slate-400" /> <span className="break-all">{e}</span>
                            </div>
                          ))
                        ) : (
                          <div className="flex items-center gap-1 text-xs text-red-600">
                            <MailX size={12} /> Sin correo
                          </div>
                        )}
                        {c.platform && <div className="text-xs text-slate-400">{c.platform}</div>}
                      </Td>
                      <Td className="max-w-[220px] text-slate-800">
                        <span title={c.products.join(", ")}>{productsText(c.plan, c.products, c.provider)}</span>
                      </Td>
                      <Td>
                        <div className="whitespace-nowrap text-slate-800">{fmtDate(c.renews_at)}</div>
                        <div className="whitespace-nowrap text-xs text-slate-400">compra {fmtDate(c.purchased_at)}</div>
                        <Badge tone={t.tone} className="mt-1">
                          {t.label}
                        </Badge>
                      </Td>
                      <Td className="whitespace-nowrap text-right font-medium text-navy-900">{fmtMoney(c.price, c.currency)}</Td>
                      <Td className="whitespace-nowrap text-xs text-slate-500">
                        {c.last_reminder_at ? (
                          <>
                            {fmtDateTime(c.last_reminder_at)}
                            <div className="text-slate-400">
                              {c.reminders_sent} enviado{c.reminders_sent === 1 ? "" : "s"}
                            </div>
                          </>
                        ) : (
                          <span className="text-slate-400">Nunca</span>
                        )}
                      </Td>
                      <Td>
                        <div className="flex flex-wrap justify-end gap-1.5">{rowActions(c)}</div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </>
        )}
      </Card>

      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        pending={pending}
        tone="primary"
        confirmLabel="Enviar"
        pendingLabel="Enviando…"
        title={`Enviar recordatorio a ${confirm?.length ?? 0} cliente${(confirm?.length ?? 0) === 1 ? "" : "s"}`}
        description="Se enviará el correo con la plantilla guardada, personalizado con los datos de cada suscripción. Cada envío queda registrado en la columna “Último aviso”."
        onConfirm={() => {
          if (!confirm) return;
          const ids = confirm;
          start(async () => {
            const { results } = await sendReminders(ids);
            setResults(results);
            setSelected(new Set());
            setConfirm(null);
          });
        }}
      />
    </>
  );
}

function Notice({ tone, children }: { tone: "warning" | "danger" | "success"; children: React.ReactNode }) {
  const cls =
    tone === "danger"
      ? "border-red-200 bg-red-50 text-red-800"
      : tone === "success"
        ? "border-emerald-200 bg-emerald-50 text-emerald-900"
        : "border-amber-200 bg-amber-50 text-amber-900";
  return (
    <div role={tone === "success" ? "status" : "alert"} className={`mb-6 flex items-start gap-2 rounded-2xl border px-4 py-3 text-sm ${cls}`}>
      {tone === "success" ? <MailCheck size={18} className="mt-0.5 shrink-0" /> : <AlertTriangle size={18} className="mt-0.5 shrink-0" />}
      <p className="[&_code]:rounded [&_code]:bg-white/70 [&_code]:px-1">{children}</p>
    </div>
  );
}
