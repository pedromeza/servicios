"use client";

import { useActionState, useEffect, useState } from "react";
import { saveLicense, type ActionState } from "@/lib/actions";
import { todayISO } from "@/lib/format";
import { LICENSE_PRODUCTS, LICENSE_STATUS, type License, type Option } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/Fields";
import { SubmitButton } from "@/components/ui/SubmitButton";

export function LicenseForm({
  license,
  clients,
  onDone,
  onCancel,
}: {
  license: License | null;
  clients: Option[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [state, action] = useActionState<ActionState, FormData>(saveLicense, null);
  const [status, setStatus] = useState<string>(license?.status ?? "available");
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);
  const e = state?.errors ?? {};

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={license?.id ?? ""} />
      <FormError message={state?.error} />

      <Field label="Producto" error={e.product}>
        <Input name="product" list="license-products" defaultValue={license?.product} required autoFocus placeholder="Windows 11 Pro" />
        <datalist id="license-products">
          {LICENSE_PRODUCTS.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </Field>

      <Field
        label="Clave de producto"
        error={e.key}
        hint={license ? `Guardada (termina en ${license.key_hint}). Déjala vacía para conservarla.` : "Se guarda cifrada; solo se muestra bajo demanda."}
      >
        <Input name="key" className="font-mono uppercase tracking-wider" placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX" autoComplete="off" spellCheck={false} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Estado" error={e.status}>
          <Select name="status" value={status} onChange={(ev) => setStatus(ev.target.value)}>
            {Object.entries(LICENSE_STATUS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Cliente" error={e.client_id}>
          <Select name="client_id" defaultValue={license?.client_id ?? ""}>
            <option value="">Sin asignar</option>
            {clients.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {status === "used" && (
        <Field label="Fecha en que se utilizó" error={e.used_at}>
          <Input name="used_at" type="date" defaultValue={license?.used_at ?? todayISO()} />
        </Field>
      )}

      <Field label="Notas" error={e.notes} hint="Dónde la compraste, en qué equipo se activó… Se guardan cifradas.">
        <Textarea name="notes" defaultValue={license?.notes ?? ""} />
      </Field>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <SubmitButton>{license ? "Guardar cambios" : "Guardar licencia"}</SubmitButton>
      </div>
    </form>
  );
}
