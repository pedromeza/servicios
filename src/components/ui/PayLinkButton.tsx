"use client";

import { Check, Copy, CreditCard, ExternalLink, MessageCircle } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { createPaymentLink, type PayLinkResult } from "@/lib/actions";
import { addMonthsISO, fmtDate, fmtMoney, todayISO } from "@/lib/format";
import { whatsappLink } from "@/lib/reminders";
import { termLabel } from "@/lib/terms";
import { PRODUCTS_BY_PROVIDER, SUB_PLANS, type Provider } from "@/lib/types";
import { Button } from "./Button";
import { Dialog } from "./Dialog";
import { Field, Input } from "./Fields";
import { TermSelect } from "./TermSelect";

/** Datos de la suscripción para preguntar, antes de generar el link, qué se renueva, por cuánto tiempo y a qué precio. */
export type RenewalInfo = {
  price: number;
  currency: string;
  plan: string;
  products: string[];
  provider: string;
  purchased_at: string | null;
  renews_at: string | null;
};

/** Meses entre compra y renovación (1 año si no se puede deducir). */
function monthsOf(purchased_at: string | null, renews_at: string | null): number {
  if (!purchased_at || !renews_at) return 12;
  for (let m = 1; m <= 120; m++) if (addMonthsISO(purchased_at, m) === renews_at) return m;
  return 12;
}

/**
 * Botón "Link de pago": genera (o reutiliza) un link de Mercado Pago y lo muestra con copiar,
 * abrir y mandar por WhatsApp. Para una suscripción (`renewal`) primero pregunta precio, plazo y
 * qué programas se renuevan, porque pueden cambiar respecto a la compra anterior.
 */
export function PayLinkButton({
  subscriptionId,
  renewal,
  clientId,
  concept,
  amount,
  phone,
  waIntro,
  size = "sm",
  label = "Link de pago",
  iconOnly = false,
  className,
}: {
  subscriptionId?: string;
  renewal?: RenewalInfo;
  clientId?: string | null;
  concept?: string;
  amount?: number;
  phone?: string | null; // para el botón de WhatsApp
  waIntro?: string; // mensaje antes del link
  size?: "sm" | "md";
  label?: string;
  iconOnly?: boolean; // solo el ícono, para filas de tabla
  className?: string;
}) {
  const [result, setResult] = useState<PayLinkResult | null>(null);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  // Opciones de la renovación (solo cuando hay `renewal`).
  const [price, setPrice] = useState("");
  const [months, setMonths] = useState("12");
  const [plan, setPlan] = useState("individual");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [extra, setExtra] = useState("");
  const catalog = useMemo(() => {
    if (!renewal) return [];
    const base = PRODUCTS_BY_PROVIDER[(renewal.provider || "Otro") as Provider] ?? [];
    return Array.from(new Set([...base, ...renewal.products.filter((p) => !/sin especificar/i.test(p))]));
  }, [renewal]);

  const begin = () => {
    setResult(null);
    setCopied(false);
    if (renewal) {
      // Punto de partida: lo mismo que tiene hoy la suscripción.
      setPrice(renewal.price > 0 ? String(renewal.price) : "");
      setMonths(String(monthsOf(renewal.purchased_at, renewal.renews_at)));
      setPlan(renewal.plan === "suite" ? "suite" : "individual");
      setChecked(new Set(renewal.products.filter((p) => !/sin especificar/i.test(p))));
      setExtra("");
      setOpen(true);
      return;
    }
    start(async () => {
      setResult(await createPaymentLink({ subscription_id: subscriptionId, client_id: clientId ?? undefined, concept, amount }));
      setOpen(true);
    });
  };

  const chosenProducts = Array.from(new Set([...catalog.filter((p) => checked.has(p)), ...extra.split(",").map((s) => s.trim()).filter(Boolean)]));
  const nMonths = Math.max(1, Math.floor(Number(months) || 12));
  const nPrice = Number(price);
  const today = todayISO();
  const base = renewal?.renews_at && renewal.renews_at >= today ? renewal.renews_at : today;
  const nextDate = addMonthsISO(base, nMonths);
  const samePrice = renewal ? nPrice === renewal.price : true;
  const sameTerm = renewal ? nMonths === monthsOf(renewal.purchased_at, renewal.renews_at) : true;
  const canGenerate = nPrice > 0 && chosenProducts.length > 0;

  const generateRenewal = () =>
    start(async () => {
      setResult(
        await createPaymentLink({
          subscription_id: subscriptionId,
          amount: nPrice,
          months: nMonths,
          plan: plan === "suite" ? "suite" : "individual",
          products: chosenProducts,
        }),
      );
    });

  // Se comparte la página de cobro de la app (con la marca), que lleva a Mercado Pago.
  const share = result?.share_url ?? result?.url ?? "";
  const copy = async () => {
    if (!share) return;
    try {
      await navigator.clipboard.writeText(share);
      setCopied(true);
    } catch {
      window.prompt("Copia el link:", share);
    }
  };
  const waText = share ? `${waIntro ?? "Hola, aquí tienes tu link de pago de PGPM MEX"}${result?.concept ? ` (${result.concept}, ${fmtMoney(result.amount ?? 0)})` : ""}:\n${share}\n\nEl pago es seguro, por Mercado Pago a nombre de PGPM MEX.` : "";
  const askOptions = Boolean(renewal) && !result;

  return (
    <>
      {iconOnly ? (
        <Button size="icon" variant="ghost" onClick={begin} disabled={pending} className={className} aria-label="Link de pago" title="Generar link de pago de Mercado Pago">
          <CreditCard size={15} className={pending ? "animate-pulse" : ""} />
        </Button>
      ) : (
        <Button size={size} variant="secondary" onClick={begin} disabled={pending} className={className} title="Generar link de pago de Mercado Pago">
          <CreditCard size={size === "sm" ? 13 : 15} /> {pending && !renewal ? "Generando…" : label}
        </Button>
      )}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={askOptions ? "Link de pago para renovar" : "Link de pago"}
        description={askOptions ? "Revisa qué se renueva antes de generar el link. Puede cambiar el precio, el plazo o los programas." : result?.ok ? `${result.concept} · ${fmtMoney(result.amount ?? 0)}` : undefined}
        wide={askOptions}
      >
        {askOptions && renewal ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Precio a cobrar" hint={samePrice ? "El mismo precio que tiene la suscripción." : `Antes: ${fmtMoney(renewal.price, renewal.currency)}.`}>
                <Input type="number" min={1} step="0.01" inputMode="decimal" value={price} onChange={(ev) => setPrice(ev.target.value)} placeholder="0.00" autoFocus />
              </Field>
              <Field label="Renovar por" hint={`${sameTerm ? "El mismo plazo que tenía." : "Plazo distinto al anterior."} Nueva renovación: ${fmtDate(nextDate)}.`}>
                <TermSelect name="pay_months" value={months} onChange={setMonths} />
              </Field>
            </div>
            <Field label="Qué se renueva" hint={plan === "suite" ? "Queda como suite completa." : "Queda solo con los programas marcados."}>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(SUB_PLANS).map(([k, v]) => (
                  <label key={k} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${plan === k ? "border-brand bg-brand-light text-navy-900" : "border-slate-200 hover:bg-navy-50"}`}>
                    <input
                      type="radio"
                      checked={plan === k}
                      onChange={() => {
                        setPlan(k);
                        if (k === "suite") setChecked(new Set(catalog));
                      }}
                      className="accent-brand"
                    />
                    {v}
                  </label>
                ))}
              </div>
              {catalog.length > 0 && (
                <div className="mt-2 grid grid-cols-2 gap-1.5 rounded-lg border border-slate-200 p-3 sm:grid-cols-3">
                  {catalog.map((p) => (
                    <label key={p} className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={checked.has(p)}
                        onChange={() =>
                          setChecked((c) => {
                            const n = new Set(c);
                            if (n.has(p)) n.delete(p);
                            else n.add(p);
                            return n;
                          })
                        }
                        className="accent-brand"
                      />
                      {p}
                    </label>
                  ))}
                </div>
              )}
              <Input value={extra} onChange={(ev) => setExtra(ev.target.value)} placeholder="Otros programas, separados por coma" className="mt-2" />
              {renewal.plan === "suite" && plan === "individual" && <p className="mt-2 text-xs text-amber-700">Tenía la suite completa; al renovar solo lo marcado, pierde acceso al resto cuando venza el periodo actual.</p>}
            </Field>
            <p className="rounded-lg bg-navy-50 px-3 py-2 text-sm text-navy-900">
              Se cobrará <strong>{fmtMoney(nPrice || 0, renewal.currency)}</strong> por <strong>{termLabel(nMonths)}</strong> de{" "}
              <strong>{plan === "suite" ? "la suite completa" : chosenProducts.join(", ") || "…"}</strong>. Al pagarse, la suscripción queda así y vence el {fmtDate(nextDate)}.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={generateRenewal} disabled={pending || !canGenerate} title={canGenerate ? undefined : "Pon un precio mayor a cero y marca al menos un programa"}>
                <CreditCard size={15} /> {pending ? "Generando…" : "Generar link"}
              </Button>
            </div>
          </div>
        ) : result?.ok && share ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-lg border border-navy-200 bg-navy-50 px-3 py-2 text-sm">
              <input readOnly value={share} className="min-w-0 flex-1 bg-transparent text-slate-700 outline-none" onFocus={(ev) => ev.currentTarget.select()} />
              <Button size="sm" variant="secondary" onClick={copy}>
                {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copiado" : "Copiar"}
              </Button>
            </div>
            <p className="text-xs text-slate-500">
              Cuando el cliente pague, Mercado Pago avisa a la app y {subscriptionId ? "la renovación se registra sola con su nueva fecha" : "el cobro se registra solo en Ventas"}. El link vence en 30 días o cuando lo canceles en Ventas.
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <a
                href={phone ? whatsappLink(phone, waText) : `https://wa.me/?text=${encodeURIComponent(waText)}`}
                target="_blank"
                rel="noopener noreferrer"
                title={phone ? "Mandar al WhatsApp del cliente" : "Abrir WhatsApp y elegir a quién mandarlo"}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#25D366] px-4 text-sm font-medium text-white hover:bg-[#1ebe5d]"
              >
                <MessageCircle size={15} /> Mandar por WhatsApp
              </a>
              <a href={share} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-lg border border-navy-200 bg-white px-4 text-sm font-medium text-navy-900 hover:bg-navy-50">
                <ExternalLink size={15} /> Abrir
              </a>
              <Button onClick={() => setOpen(false)}>Listo</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{result?.error ?? "No se pudo generar el link."}</p>
            <div className="flex justify-end gap-2">
              {renewal && (
                <Button variant="secondary" onClick={() => setResult(null)}>
                  Volver
                </Button>
              )}
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
