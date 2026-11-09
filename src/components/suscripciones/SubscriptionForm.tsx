"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { saveSubscription, type ActionState } from "@/lib/actions";
import { todayISO } from "@/lib/format";
import { CURRENCIES, PRODUCTS_BY_PROVIDER, SUB_PLANS, SUB_STATUS, type Option, type Provider, type Subscription } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/Fields";
import { SubmitButton } from "@/components/ui/SubmitButton";

export function SubscriptionForm({
  subscription: sub,
  accounts,
  clients,
  onDone,
  onCancel,
}: {
  subscription: Subscription | null;
  accounts: Option[];
  clients: Option[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [state, action] = useActionState<ActionState, FormData>(saveSubscription, null);
  const [accountId, setAccountId] = useState(sub?.account_id ?? accounts[0]?.value ?? "");
  const [plan, setPlan] = useState<string>(sub?.plan ?? "individual");
  const [status, setStatus] = useState<string>(sub?.status ?? "active");
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);
  const e = state?.errors ?? {};

  const provider = (accounts.find((a) => a.value === accountId)?.meta ?? "Otro") as Provider;
  const catalog = useMemo(() => PRODUCTS_BY_PROVIDER[provider] ?? [], [provider]);
  const extraProducts = (sub?.products ?? []).filter((p) => !catalog.includes(p));

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={sub?.id ?? ""} />
      <FormError message={state?.error} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Cuenta" error={e.account_id}>
          <Select name="account_id" value={accountId} onChange={(ev) => setAccountId(ev.target.value)} required>
            {accounts.length === 0 && <option value="">Primero crea una cuenta</option>}
            {accounts.map((a) => (
              <option key={a.value} value={a.value}>
                [{a.meta}] {a.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Cliente" error={e.client_id}>
          <Select name="client_id" defaultValue={sub?.client_id ?? ""}>
            <option value="">Sin asignar</option>
            {clients.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Alcance" error={e.plan}>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(SUB_PLANS).map(([k, v]) => (
            <label
              key={k}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                plan === k ? "border-brand bg-brand-light text-navy-900" : "border-slate-200 hover:bg-navy-50"
              }`}
            >
              <input type="radio" name="plan" value={k} checked={plan === k} onChange={() => setPlan(k)} className="accent-brand" />
              {v}
            </label>
          ))}
        </div>
      </Field>

      <Field label="Programas incluidos" error={e.products}>
        {catalog.length > 0 ? (
          <div className="grid grid-cols-2 gap-1.5 rounded-lg border border-slate-200 p-3 sm:grid-cols-3">
            {catalog.map((p) => (
              <label key={p} className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" name="products" value={p} defaultChecked={sub?.products.includes(p)} className="accent-brand" />
                {p}
              </label>
            ))}
          </div>
        ) : null}
        <Input
          name="products_extra"
          defaultValue={extraProducts.join(", ")}
          placeholder={catalog.length ? "Otros programas, separados por coma" : "Programas, separados por coma"}
          className="mt-2"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Puestos / usuarios" error={e.seats}>
          <Input name="seats" type="number" min={1} defaultValue={sub?.seats ?? 1} />
        </Field>
        <Field label="Fecha de compra" error={e.purchased_at}>
          <Input name="purchased_at" type="date" defaultValue={sub?.purchased_at ?? todayISO()} />
        </Field>
        <Field label="Fecha de renovación" error={e.renews_at}>
          <Input name="renews_at" type="date" defaultValue={sub?.renews_at ?? ""} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Te costó" error={e.cost}>
          <Input name="cost" type="number" step="0.01" min={0} defaultValue={sub?.cost ?? ""} placeholder="0.00" />
        </Field>
        <Field label="Lo vendiste en" error={e.price}>
          <Input name="price" type="number" step="0.01" min={0} defaultValue={sub?.price ?? ""} placeholder="0.00" />
        </Field>
        <Field label="Moneda" error={e.currency}>
          <Select name="currency" defaultValue={sub?.currency ?? "MXN"}>
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Estado" error={e.status}>
        <Select name="status" value={status} onChange={(ev) => setStatus(ev.target.value)}>
          {Object.entries(SUB_STATUS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Notas" error={e.notes} hint="Se guardan cifradas.">
        <Textarea name="notes" defaultValue={sub?.notes ?? ""} />
      </Field>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <SubmitButton>{sub ? "Guardar cambios" : "Registrar suscripción"}</SubmitButton>
      </div>
    </form>
  );
}
