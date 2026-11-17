"use client";

import { useActionState, useEffect, useState } from "react";
import { quickCreateClient, saveSale, type ActionState } from "@/lib/actions";
import { todayISO } from "@/lib/format";
import { ComboSelect } from "@/components/ui/ComboSelect";
import { Button } from "@/components/ui/Button";
import { Field, FormError, Input, Textarea } from "@/components/ui/Fields";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { CURRENCIES, LICENSE_PRODUCTS, SALE_PLATFORMS, type Option, type Sale } from "@/lib/types";

const CONCEPTS = ["Instalación de Windows", "Instalación de Office", "Formateo y respaldo", "Soporte técnico (hora)", "Configuración de correo", "Mouse", "Teclado", "Disco SSD", "Memoria RAM"];

export function SaleForm({ sale, clients, onDone, onCancel }: { sale: Sale | null; clients: Option[]; onDone: () => void; onCancel: () => void }) {
  const [state, action] = useActionState<ActionState, FormData>(saveSale, null);
  const [clientId, setClientId] = useState<string>(sale?.client_id ?? "");
  const [clientList, setClientList] = useState<Option[]>(clients);
  const [currency, setCurrency] = useState<string>(sale?.currency ?? "MXN");
  const [platform, setPlatform] = useState<string>(sale?.platform ?? "");
  const [platformList, setPlatformList] = useState<string[]>(() => Array.from(new Set([...SALE_PLATFORMS, ...(sale?.platform ? [sale.platform] : [])])));
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);
  const e = state?.errors ?? {};
  const createClient = async (label: string) => {
    const res = await quickCreateClient(label);
    if (!res.ok) throw new Error(res.error);
    setClientList((l) => (l.some((c) => c.value === res.value) ? l : [...l, { value: res.value, label: res.label }]));
    return { value: res.value, label: res.label };
  };

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={sale?.id ?? ""} />
      <FormError message={state?.error} />

      <Field label="Qué vendiste" error={e.concept} hint="Un servicio, hardware o cualquier cosa que no sea licencia ni suscripción.">
        <Input name="concept" list="sale-concepts" defaultValue={sale?.concept ?? ""} required autoFocus placeholder="Instalación de Windows" />
        <datalist id="sale-concepts">
          {[...CONCEPTS, ...LICENSE_PRODUCTS].map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Cliente" error={e.client_id} hint="Escribe para buscar; si no existe, lo creas desde aquí.">
          <ComboSelect name="client_id" value={clientId} onChange={setClientId} options={clientList} emptyLabel="Sin cliente" placeholder="Buscar cliente…" createLabel="Crear cliente" onCreate={createClient} />
        </Field>
        <Field label="Fecha" error={e.sold_at}>
          <Input name="sold_at" type="date" defaultValue={sale?.sold_at ?? todayISO()} required />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Lo vendiste en" error={e.price}>
          <Input name="price" type="number" step="0.01" min={0} defaultValue={sale?.price ?? ""} placeholder="0.00" />
        </Field>
        <Field label="Te costó" error={e.cost}>
          <Input name="cost" type="number" step="0.01" min={0} defaultValue={sale?.cost ?? ""} placeholder="0.00" />
        </Field>
        <Field label="Moneda" error={e.currency}>
          <ComboSelect name="currency" value={currency} onChange={setCurrency} options={CURRENCIES.map((c) => ({ value: c, label: c }))} placeholder="Moneda" />
        </Field>
      </div>

      <Field label="Plataforma" error={e.platform} hint="Por dónde se vendió.">
        <ComboSelect
          name="platform"
          value={platform}
          onChange={setPlatform}
          options={platformList.map((p) => ({ value: p, label: p }))}
          emptyLabel="Sin especificar"
          placeholder="Buscar o escribir plataforma…"
          createLabel="Agregar"
          onCreate={(label) => {
            setPlatformList((l) => (l.includes(label) ? l : [...l, label]));
            return { value: label, label };
          }}
        />
      </Field>

      <Field label="Notas" error={e.notes} hint="Se guardan cifradas.">
        <Textarea name="notes" defaultValue={sale?.notes ?? ""} />
      </Field>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <SubmitButton>{sale ? "Guardar cambios" : "Guardar venta"}</SubmitButton>
      </div>
    </form>
  );
}
