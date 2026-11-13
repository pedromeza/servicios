"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { saveSubscription, type ActionState } from "@/lib/actions";
import { splitEmails } from "@/lib/emails";
import { addMonthsISO, addYearsISO, todayISO } from "@/lib/format";
import { ACCOUNT_TERMS, CURRENCIES, PRODUCTS_BY_PROVIDER, SUB_PLANS, SUB_STATUS, type Option, type Provider, type Subscription } from "@/lib/types";

const TERM_KEYS = Object.keys(ACCOUNT_TERMS);

/** Renovación = compra + vigencia en años + meses gratis de promoción. */
function renewalFor(purchasedAt: string, years: number, promoMonths: number): string {
  return addMonthsISO(addYearsISO(purchasedAt, years), promoMonths);
}

/** Devuelve la vigencia (en años) si la renovación coincide con compra + N años + promo; si no, "". */
function termFor(purchasedAt: string, renewsAt: string, promoMonths: number): string {
  if (!purchasedAt || !renewsAt) return "";
  return TERM_KEYS.find((k) => renewalFor(purchasedAt, Number(k), promoMonths) === renewsAt) ?? "";
}

const toMonths = (v: string) => Math.max(0, Math.floor(Number(v) || 0));
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
  const [emailText, setEmailText] = useState<string>(sub?.email ?? "");
  const [seatsText, setSeatsText] = useState<string>(String(sub?.seats ?? 1));
  const emailCount = splitEmails(emailText).length;
  const seatCount = Math.max(1, Math.floor(Number(seatsText) || 1));
  const [purchasedAt, setPurchasedAt] = useState<string>(sub?.purchased_at ?? todayISO());
  const [renewsAt, setRenewsAt] = useState<string>(sub?.renews_at ?? "");
  const [promo, setPromo] = useState<string>(sub?.promo_months ? String(sub.promo_months) : "");
  const [term, setTerm] = useState<string>(() => termFor(sub?.purchased_at ?? "", sub?.renews_at ?? "", sub?.promo_months ?? 0));
  const applyTerm = (t: string, from: string, promoMonths: number) => {
    setTerm(t);
    if (t && from) setRenewsAt(renewalFor(from, Number(t), promoMonths));
  };
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

      <Field
        label="Correos de la suscripción"
        error={e.emails}
        hint={
          emailCount > 1
            ? `${emailCount} correos → ${Math.max(emailCount, seatCount)} puestos. Todos reciben los recordatorios. Se guardan cifrados.`
            : "Uno o varios, separados por coma. Si son varios, los puestos se ajustan solos. Se guardan cifrados."
        }
      >
        <Textarea
          name="email"
          inputMode="email"
          autoComplete="off"
          value={emailText}
          onChange={(ev) => setEmailText(ev.target.value)}
          placeholder="usuario1@correo.com, usuario2@correo.com"
          className="min-h-[44px]"
          rows={emailCount > 1 ? Math.min(6, emailCount) : 1}
        />
      </Field>

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

      <Field label="Puestos / usuarios" error={e.seats} hint={emailCount > seatCount ? `Se guardará con ${emailCount}, uno por cada correo.` : undefined}>
        <Input name="seats" type="number" min={1} value={seatsText} onChange={(ev) => setSeatsText(ev.target.value)} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Fecha de compra" error={e.purchased_at}>
          <Input
            name="purchased_at"
            type="date"
            value={purchasedAt}
            onChange={(ev) => {
              setPurchasedAt(ev.target.value);
              if (term) applyTerm(term, ev.target.value, toMonths(promo));
            }}
          />
        </Field>
        <Field label="Vigencia" hint="Calcula la renovación desde la fecha de compra.">
          <Select name="term_years" value={term} onChange={(ev) => applyTerm(ev.target.value, purchasedAt, toMonths(promo))}>
            <option value="">Manual</option>
            {Object.entries(ACCOUNT_TERMS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Fecha de renovación" error={e.renews_at}>
          <Input
            name="renews_at"
            type="date"
            value={renewsAt}
            onChange={(ev) => {
              setRenewsAt(ev.target.value);
              setTerm(termFor(purchasedAt, ev.target.value, toMonths(promo)));
            }}
          />
        </Field>
      </div>

      <Field label="Meses gratis de promoción" error={e.promo_months} hint="Se suman a la vigencia al calcular la renovación. Deja 0 si no aplica.">
        <Input
          name="promo_months"
          type="number"
          min={0}
          max={24}
          step={1}
          value={promo}
          placeholder="0"
          onChange={(ev) => {
            setPromo(ev.target.value);
            if (term) applyTerm(term, purchasedAt, toMonths(ev.target.value));
            else setTerm(termFor(purchasedAt, renewsAt, toMonths(ev.target.value)));
          }}
        />
      </Field>

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
