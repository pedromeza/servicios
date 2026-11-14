"use client";

import { useActionState, useEffect, useState } from "react";
import { renewSubscription, type ActionState } from "@/lib/actions";
import { addYearsISO, fmtDate, fmtMoney, todayISO } from "@/lib/format";
import { ACCOUNT_TERMS, type Subscription } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field, FormError, Input, Select } from "@/components/ui/Fields";
import { SubmitButton } from "@/components/ui/SubmitButton";

/** Renovar una suscripción registrando cuánto se cobró, cuánto costó y por cuánto tiempo. */
export function RenewDialog({ subscription: s, onClose }: { subscription: Subscription | null; onClose: () => void }) {
  const [state, action] = useActionState<ActionState, FormData>(renewSubscription, null);
  const [years, setYears] = useState("1");
  const [renewedAt, setRenewedAt] = useState(todayISO());
  const [onlyPayment, setOnlyPayment] = useState(false);
  useEffect(() => {
    if (state?.ok) onClose();
  }, [state, onClose]);
  const e = state?.errors ?? {};
  if (!s) return null;
  const base = s.renews_at && s.renews_at >= renewedAt ? s.renews_at : renewedAt;
  const next = addYearsISO(base, Number(years) || 1);

  return (
    <Dialog open onClose={onClose} title="Renovar suscripción" description={`${s.products.join(", ")} · ${s.client_name ?? "sin cliente"} · ${s.account_label}`}>
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
          <Field label={onlyPayment ? "Periodo que cubrió" : "Renovar por"} error={e.years} hint={onlyPayment ? `Se registra como cobrado hasta ${fmtDate(s.renews_at)}.` : `Nueva renovación: ${fmtDate(next)}.`}>
            <Select name="years" value={years} onChange={(ev) => setYears(ev.target.value)}>
              {Object.entries(ACCOUNT_TERMS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
        </div>
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
