"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { renewSubscription, type ActionState } from "@/lib/actions";
import { addMonthsISO, fmtDate, fmtMoney, todayISO } from "@/lib/format";
import { PRODUCTS_BY_PROVIDER, SUB_PLANS, type Provider, type Subscription } from "@/lib/types";
import { TermSelect } from "@/components/ui/TermSelect";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field, FormError, Input } from "@/components/ui/Fields";
import { SubmitButton } from "@/components/ui/SubmitButton";

/** Renovar una suscripción registrando cuánto se cobró, cuánto costó y por cuánto tiempo. */
export function RenewDialog({ subscription: s, onClose }: { subscription: Subscription | null; onClose: () => void }) {
  const [state, action] = useActionState<ActionState, FormData>(renewSubscription, null);
  const [months, setMonths] = useState("12");
  const [renewedAt, setRenewedAt] = useState(todayISO());
  const [onlyPayment, setOnlyPayment] = useState(false);
  const [plan, setPlan] = useState<string>(s?.plan ?? "individual");
  const catalog = useMemo(() => {
    const base = PRODUCTS_BY_PROVIDER[(s?.account_provider ?? "Otro") as Provider] ?? [];
    return Array.from(new Set([...base, ...(s?.products ?? [])]));
  }, [s]);
  const [checked, setChecked] = useState<Set<string>>(() => new Set(s?.products ?? []));
  const toggle = (p: string) =>
    setChecked((c) => {
      const n = new Set(c);
      if (n.has(p)) n.delete(p);
      else n.add(p);
      return n;
    });
  const extraProducts = (s?.products ?? []).filter((p) => !catalog.includes(p));
  useEffect(() => {
    if (state?.ok) onClose();
  }, [state, onClose]);
  const e = state?.errors ?? {};
  if (!s) return null;
  const base = s.renews_at && s.renews_at >= renewedAt ? s.renews_at : renewedAt;
  const next = addMonthsISO(base, Number(months) || 12);

  return (
    <Dialog open onClose={onClose} title="Renovar suscripción" description={`${s.products.join(", ")} · ${s.client_name ?? "sin cliente"} · ${s.account_label}`} wide>
      <form action={action} className="space-y-4">
        <input type="hidden" name="id" value={s.id} />
        <FormError message={state?.error} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Cobrado por la renovación" error={e.amount} hint={`La venta original fue de ${fmtMoney(s.price, s.currency)}.`}>
            <Input name="amount" type="number" step="0.01" min={0} defaultValue={s.price} autoFocus />
          </Field>
          <Field label="Te costó renovar" error={e.cost} hint="Opcional, para la ganancia.">
            <Input name="cost" type="number" step="0.01" min={0} defaultValue={s.cost || ""} placeholder="0.00" />
          </Field>
          <Field label="Fecha del cobro" error={e.renewed_at}>
            <Input name="renewed_at" type="date" value={renewedAt} onChange={(ev) => setRenewedAt(ev.target.value)} />
          </Field>
          <Field label={onlyPayment ? "Periodo que cubrió" : "Renovar por"} error={e.months} hint={onlyPayment ? `Se registra como cobrado hasta ${fmtDate(s.renews_at)}.` : `Nueva renovación: ${fmtDate(next)}. Escribe otra, p. ej. 18 o 5 años.`}>
            <TermSelect name="months" value={months} onChange={setMonths} />
          </Field>
        </div>
        <Field label="Qué se renueva" error={e.products} hint={plan === "suite" ? "La suscripción queda como suite completa." : "La suscripción queda solo con los programas marcados."}>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(SUB_PLANS).map(([k, v]) => (
              <label
                key={k}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                  plan === k ? "border-brand bg-brand-light text-navy-900" : "border-slate-200 hover:bg-navy-50"
                }`}
              >
                <input
                  type="radio"
                  name="plan"
                  value={k}
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
          <div className="mt-2 grid grid-cols-2 gap-1.5 rounded-lg border border-slate-200 p-3 sm:grid-cols-3">
            {catalog.map((p) => (
              <label key={p} className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" name="products" value={p} checked={checked.has(p)} onChange={() => toggle(p)} className="accent-brand" />
                {p}
              </label>
            ))}
          </div>
          <Input name="products_extra" defaultValue={extraProducts.join(", ")} placeholder="Otros programas, separados por coma" className="mt-2" />
          {s.plan === "suite" && plan === "individual" && (
            <p className="mt-2 text-xs text-amber-700">Tenía la suite completa; al renovar solo lo marcado, el cliente pierde acceso al resto cuando venza el periodo actual.</p>
          )}
        </Field>

        <label className="flex items-start gap-2 rounded-lg border border-navy-100 px-3 py-2 text-sm text-slate-700">
          <input type="checkbox" name="only_payment" checked={onlyPayment} onChange={(ev) => setOnlyPayment(ev.target.checked)} className="mt-0.5 accent-brand" />
          <span>
            <span className="font-medium text-navy-900">Solo registrar el cobro.</span> Úsalo para una renovación que ya hiciste antes: anota el importe sin
            mover la fecha de renovación ni sumar otra renovación.
          </span>
        </label>
        {!onlyPayment && (
          <p className="rounded-lg bg-navy-50 px-3 py-2 text-xs text-slate-600">
            El periodo nuevo empieza donde termina el actual ({fmtDate(s.renews_at)}); si ya había vencido, desde la fecha del cobro. La suscripción queda
            activa y el cliente suma un sello de lealtad.
          </p>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <SubmitButton>{onlyPayment ? "Registrar cobro" : "Registrar renovación"}</SubmitButton>
        </div>
      </form>
    </Dialog>
  );
}
