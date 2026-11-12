"use client";

import { useActionState, useEffect, useState } from "react";
import { grantReward, type ActionState } from "@/lib/actions";
import { addMonthsISO, fmtDate, todayISO } from "@/lib/format";
import { LOYALTY, type LoyaltyCard } from "@/lib/loyalty";
import { Button } from "@/components/ui/Button";
import { Field, FormError, Input, Textarea } from "@/components/ui/Fields";
import { SubmitButton } from "@/components/ui/SubmitButton";

const SUGGESTIONS = ["1 mes gratis de AutoCAD", "1 mes gratis de Microsoft 365", "Cuenta de usuario gratis 1 mes", "Licencia Windows 11 Pro gratis"];

export function RewardForm({ card, onDone, onCancel }: { card: LoyaltyCard; onDone: () => void; onCancel: () => void }) {
  const [state, action] = useActionState<ActionState, FormData>(grantReward, null);
  const [grantedAt, setGrantedAt] = useState(todayISO());
  const [months, setMonths] = useState(String(LOYALTY.rewardMonths));
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);
  const e = state?.errors ?? {};
  const m = Math.max(0, Math.floor(Number(months) || 0));
  const expires = m > 0 && grantedAt ? addMonthsISO(grantedAt, m) : null;
  const ready = card.rewards_available > 0;

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="client_id" value={card.client_id} />
      <input type="hidden" name="stamps_used" value={LOYALTY.stampsPerReward} />
      <FormError message={state?.error} />

      <p className={`rounded-lg px-3 py-2 text-sm ${ready ? "bg-brand-light text-navy-900" : "bg-amber-50 text-amber-800"}`}>
        {ready
          ? `${card.client_name} completó ${card.rewards_available} tarjeta${card.rewards_available === 1 ? "" : "s"}. Este premio consumirá ${LOYALTY.stampsPerReward} sellos.`
          : `${card.client_name} lleva ${card.progress} de ${LOYALTY.stampsPerReward} sellos. Puedes otorgar un premio de cortesía igual; consumirá ${LOYALTY.stampsPerReward} sellos y su tarjeta quedará en negativo hasta reponerlos.`}
      </p>

      <Field label="Premio" error={e.description} hint="Qué le das: un mes gratis, una cuenta, una licencia…">
        <Input name="description" list="reward-suggestions" defaultValue={LOYALTY.rewardLabel} required autoFocus />
        <datalist id="reward-suggestions">
          {SUGGESTIONS.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Desde" error={e.granted_at}>
          <Input name="granted_at" type="date" value={grantedAt} onChange={(ev) => setGrantedAt(ev.target.value)} />
        </Field>
        <Field label="Duración (meses)" error={e.months} hint={expires ? `Vence el ${fmtDate(expires)}.` : "0 = sin vencimiento."}>
          <Input name="months" type="number" min={0} max={36} step={1} value={months} onChange={(ev) => setMonths(ev.target.value)} />
        </Field>
      </div>

      <Field label="Notas" error={e.notes} hint="En qué cuenta se activó, a qué correo… Se guardan cifradas.">
        <Textarea name="notes" />
      </Field>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <SubmitButton>Registrar premio</SubmitButton>
      </div>
    </form>
  );
}
