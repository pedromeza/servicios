"use client";

import { useActionState, useEffect } from "react";
import { saveClient, type ActionState } from "@/lib/actions";
import type { Client } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Field, FormError, Input, Textarea } from "@/components/ui/Fields";
import { SubmitButton } from "@/components/ui/SubmitButton";

export function ClientForm({ client, onDone, onCancel }: { client: Client | null; onDone: () => void; onCancel: () => void }) {
  const [state, action] = useActionState<ActionState, FormData>(saveClient, null);
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);
  const e = state?.errors ?? {};

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={client?.id ?? ""} />
      <FormError message={state?.error} />
      <Field label="Nombre o empresa" error={e.name}>
        <Input name="name" defaultValue={client?.name} required autoFocus placeholder="Ej. Constructora Ríos SA de CV" />
      </Field>
      <Field label="Contacto" error={e.contact} hint="Teléfono, correo, WhatsApp… Se guarda cifrado.">
        <Input name="contact" defaultValue={client?.contact ?? ""} placeholder="55 1234 5678 · contacto@empresa.com" />
      </Field>
      <Field label="Notas" error={e.notes} hint="Se guardan cifradas.">
        <Textarea name="notes" defaultValue={client?.notes ?? ""} />
      </Field>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <SubmitButton>{client ? "Guardar cambios" : "Crear cliente"}</SubmitButton>
      </div>
    </form>
  );
}
