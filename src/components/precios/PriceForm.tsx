"use client";

import { useActionState, useEffect } from "react";
import { savePriceItem, type ActionState } from "@/lib/actions";
import { CURRENCIES, LICENSE_PRODUCTS, PRICE_TERMS, PRODUCTS_BY_PROVIDER, type PriceItem } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Field, FormError, Input, Select } from "@/components/ui/Fields";
import { SubmitButton } from "@/components/ui/SubmitButton";

const ALL_PRODUCTS = Array.from(new Set([...Object.values(PRODUCTS_BY_PROVIDER).flat(), ...LICENSE_PRODUCTS]));

export function PriceForm({ item, onDone, onCancel }: { item: PriceItem | null; onDone: () => void; onCancel: () => void }) {
  const [state, action] = useActionState<ActionState, FormData>(savePriceItem, null);
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);
  const e = state?.errors ?? {};
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={item?.id ?? ""} />
      <FormError message={state?.error} />
      <Field label="Producto" error={e.product}>
        <Input name="product" list="price-products" defaultValue={item?.product} required autoFocus placeholder="AutoCAD" />
        <datalist id="price-products">
          {ALL_PRODUCTS.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Vigencia" error={e.term_years}>
          <Select name="term_years" defaultValue={String(item?.term_years ?? 1)}>
            {Object.entries(PRICE_TERMS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Moneda" error={e.currency}>
          <Select name="currency" defaultValue={item?.currency ?? "MXN"}>
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field label="Precio al cliente" error={e.price}>
          <Input name="price" type="number" step="0.01" min={0} defaultValue={item?.price ?? ""} placeholder="0.00" required />
        </Field>
        <Field label="Te cuesta" error={e.cost} hint="Opcional, para ver la ganancia por línea.">
          <Input name="cost" type="number" step="0.01" min={0} defaultValue={item?.cost || ""} placeholder="0.00" />
        </Field>
      </div>
      <Field label="Nota (aparece en la cotización)" error={e.notes}>
        <Input name="notes" defaultValue={item?.notes ?? ""} placeholder="Ej. activación el mismo día, incluye instalación" />
      </Field>
      <input type="hidden" name="active" value={item ? (item.active ? "on" : "off") : "on"} />
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <SubmitButton>{item ? "Guardar cambios" : "Agregar precio"}</SubmitButton>
      </div>
    </form>
  );
}
