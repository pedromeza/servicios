"use client";

import { Check, Copy, CreditCard, ExternalLink, MessageCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { createPaymentLink, type PayLinkResult } from "@/lib/actions";
import { fmtMoney } from "@/lib/format";
import { whatsappLink } from "@/lib/reminders";
import { Button } from "./Button";
import { Dialog } from "./Dialog";

/**
 * Botón "Link de pago": genera (o reutiliza) un link de Mercado Pago y lo muestra con copiar,
 * abrir y mandar por WhatsApp. Sirve para una suscripción (renovación) o para un cobro suelto.
 */
export function PayLinkButton({
  subscriptionId,
  clientId,
  concept,
  amount,
  phone,
  waIntro,
  size = "sm",
  label = "Link de pago",
  className,
}: {
  subscriptionId?: string;
  clientId?: string | null;
  concept?: string;
  amount?: number;
  phone?: string | null; // para el botón de WhatsApp
  waIntro?: string; // mensaje antes del link
  size?: "sm" | "md";
  label?: string;
  className?: string;
}) {
  const [result, setResult] = useState<PayLinkResult | null>(null);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const generate = () =>
    start(async () => {
      const res = await createPaymentLink({ subscription_id: subscriptionId, client_id: clientId ?? undefined, concept, amount });
      setResult(res);
      setCopied(false);
      setOpen(true);
    });
  const copy = async () => {
    if (!result?.url) return;
    try {
      await navigator.clipboard.writeText(result.url);
      setCopied(true);
    } catch {
      window.prompt("Copia el link:", result.url);
    }
  };
  const waText = result?.url ? `${waIntro ?? "Hola, aquí tienes tu link de pago de PGPM MEX"}${result.concept ? ` (${result.concept}, ${fmtMoney(result.amount ?? 0)})` : ""}:\n${result.url}` : "";

  return (
    <>
      <Button size={size} variant="secondary" onClick={generate} disabled={pending} className={className} title="Generar link de pago de Mercado Pago">
        <CreditCard size={size === "sm" ? 13 : 15} /> {pending ? "Generando…" : label}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Link de pago" description={result?.ok ? `${result.concept} · ${fmtMoney(result.amount ?? 0)}` : undefined}>
        {result?.ok && result.url ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-lg border border-navy-200 bg-navy-50 px-3 py-2 text-sm">
              <input readOnly value={result.url} className="min-w-0 flex-1 bg-transparent text-slate-700 outline-none" onFocus={(ev) => ev.currentTarget.select()} />
              <Button size="sm" variant="secondary" onClick={copy}>
                {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copiado" : "Copiar"}
              </Button>
            </div>
            <p className="text-xs text-slate-500">
              Cuando el cliente pague, Mercado Pago avisa a la app y {subscriptionId ? "la renovación se registra sola con su nueva fecha" : "el cobro se registra solo en Ventas"}. El link sirve mientras no se cancele.
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              {phone && (
                <a
                  href={whatsappLink(phone, waText)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#25D366] px-4 text-sm font-medium text-white hover:bg-[#1ebe5d]"
                >
                  <MessageCircle size={15} /> Mandar por WhatsApp
                </a>
              )}
              <a href={result.url} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-lg border border-navy-200 bg-white px-4 text-sm font-medium text-navy-900 hover:bg-navy-50">
                <ExternalLink size={15} /> Abrir
              </a>
              <Button onClick={() => setOpen(false)}>Listo</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{result?.error ?? "No se pudo generar el link."}</p>
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Cerrar
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}
