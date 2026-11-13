"use client";

import { AlertTriangle, BellRing, CheckCircle2, Mail, MailX, Send } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { sendReminders, type SendResult } from "@/lib/actions";
import { fmtDate, fmtDateTime, fmtMoney } from "@/lib/format";
import type { ReminderSettings } from "@/lib/reminders";
import { renewalTone } from "@/lib/renewal";
import type { ReminderCandidate } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { Select } from "@/components/ui/Fields";
import { TemplateEditor } from "./TemplateEditor";

export function RemindersManager({
  settings,
  candidates,
  days,
  fromEmail,
  testTo,
  resendReady,
}: {
  settings: ReminderSettings;
  candidates: ReminderCandidate[];
  days: number;
  fromEmail: string;
  testTo: string;
  resendReady: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<string[] | null>(null);
  const [results, setResults] = useState<SendResult[] | null>(null);
  const [pending, start] = useTransition();

  const withEmail = candidates.filter((c) => c.email);
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
  const usesTestSender = /resend\.dev/i.test(fromEmail);

  return (
    <>
      <PageHeader
        title="Renovaciones"
        description={`${candidates.length} suscripci${candidates.length === 1 ? "ón vence" : "ones vencen"} en los próximos ${days} días o ya vencieron · ${withEmail.length} con correo`}
      />

      {!resendReady ? (
        <Notice tone="danger">
          Falta <code>RESEND_API_KEY</code> en Vercel: la app no puede enviar correos todavía.
        </Notice>
      ) : usesTestSender ? (
        <Notice tone="warning">
          Estás enviando desde <code>{fromEmail}</code>, el remitente de prueba de Resend: <strong>solo llega a tu propio correo</strong>. Para
          escribir a clientes, verifica tu dominio en Resend y pon en Vercel <code>FROM_EMAIL</code>, por ejemplo{" "}
          <code>PGPM MEX &lt;avisos@tudominio.com&gt;</code>.
        </Notice>
      ) : null}

      <div className="mb-6">
        <TemplateEditor settings={settings} testTo={testTo} resendReady={resendReady} />
      </div>

      <Card>
        <CardHeader
          title="Clientes por avisar"
          description="Suscripciones activas por vencer. Marca a quién avisar y envía el correo con la plantilla guardada."
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Select value={String(days)} onChange={(ev) => setDays(ev.target.value)} className="w-auto" aria-label="Ventana de días">
                {[7, 15, 30, 45, 60, 90].map((d) => (
                  <option key={d} value={d}>
                    Próximos {d} días
                  </option>
                ))}
              </Select>
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
          <Table>
            <thead className="border-b border-navy-100">
              <tr>
                <Th className="w-8" />
                <Th>Cliente</Th>
                <Th>Correo</Th>
                <Th>Programas</Th>
                <Th>Compra</Th>
                <Th>Vence</Th>
                <Th className="text-right">Precio</Th>
                <Th>Último aviso</Th>
                <Th className="w-28" />
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
                        disabled={!c.email}
                        checked={selected.has(c.subscription_id)}
                        onChange={() => toggle(c.subscription_id)}
                      />
                    </Td>
                    <Td>
                      <div className="font-medium text-navy-900">{c.client_name}</div>
                      {c.platform && <div className="text-xs text-slate-400">{c.platform}</div>}
                    </Td>
                    <Td>
                      {c.email ? (
                        <span className="flex items-center gap-1 break-all text-slate-700">
                          <Mail size={13} className="shrink-0 text-slate-400" /> {c.email}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-red-600">
                          <MailX size={13} /> Sin correo
                        </span>
                      )}
                    </Td>
                    <Td className="max-w-[200px] text-slate-800">{c.products.join(", ")}</Td>
                    <Td className="whitespace-nowrap">{fmtDate(c.purchased_at)}</Td>
                    <Td>
                      <div className="whitespace-nowrap text-slate-800">{fmtDate(c.renews_at)}</div>
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
                      <div className="flex justify-end">
                        <Button size="sm" variant="secondary" disabled={!c.email || !resendReady || pending} onClick={() => setConfirm([c.subscription_id])}>
                          <Send size={13} /> Enviar
                        </Button>
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
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

function Notice({ tone, children }: { tone: "warning" | "danger"; children: React.ReactNode }) {
  const cls = tone === "danger" ? "border-red-200 bg-red-50 text-red-800" : "border-amber-200 bg-amber-50 text-amber-900";
  return (
    <div role="alert" className={`mb-6 flex items-start gap-2 rounded-2xl border px-4 py-3 text-sm ${cls}`}>
      <AlertTriangle size={18} className="mt-0.5 shrink-0" />
      <p className="[&_code]:rounded [&_code]:bg-white/70 [&_code]:px-1">{children}</p>
    </div>
  );
}
