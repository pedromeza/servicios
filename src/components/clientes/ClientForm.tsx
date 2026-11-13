"use client";

import { AlertTriangle, Info } from "lucide-react";
import { useActionState, useEffect, useMemo, useState } from "react";
import { saveClient, type ActionState } from "@/lib/actions";
import { findSimilarNames } from "@/lib/names";
import { CLIENT_PLATFORMS } from "@/lib/reminders";
import type { Client } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/Fields";
import { SubmitButton } from "@/components/ui/SubmitButton";

export function ClientForm({
  client,
  existingNames,
  onDone,
  onCancel,
}: {
  client: Client | null;
  existingNames: string[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [state, action] = useActionState<ActionState, FormData>(saveClient, null);
  const [name, setName] = useState(client?.name ?? "");
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);
  const e = state?.errors ?? {};

  // Aviso en vivo: nombre idéntico (bloquea) o parecido (solo avisa). Al editar, el propio nombre no cuenta.
  const { exact, similar } = useMemo(() => findSimilarNames(name, existingNames, client?.name), [name, existingNames, client?.name]);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={client?.id ?? ""} />
      <FormError message={state?.error} />
      <Field label="Nombre o empresa" error={e.name ?? (exact ? `Ya existe un cliente registrado como “${exact}”.` : undefined)}>
        <Input
          name="name"
          value={name}
          onChange={(ev) => setName(ev.target.value)}
          required
          autoFocus
          placeholder="Ej. Constructora Ríos SA de CV"
          aria-invalid={Boolean(exact)}
          className={exact ? "border-red-400 focus:border-red-500 focus:ring-red-500/15" : undefined}
        />
      </Field>
      {exact ? (
        <p className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          Ese cliente ya está registrado. Búscalo en la lista y edítalo en lugar de crearlo de nuevo.
        </p>
      ) : similar.length > 0 ? (
        <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <Info size={16} className="mt-0.5 shrink-0" />
          <span>
            ¿Será el mismo? Ya tienes: {similar.map((s) => `“${s}”`).join(", ")}.
          </span>
        </p>
      ) : null}
      <Field label="Contacto" error={e.contact} hint="Teléfono, correo, WhatsApp… Se guarda cifrado. Si incluye un correo, se usa para los recordatorios.">
        <Input name="contact" defaultValue={client?.contact ?? ""} placeholder="55 1234 5678 · contacto@empresa.com" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Plataforma" error={e.platform} hint="Por dónde llegó o compra.">
          <Select name="platform" defaultValue={client?.platform ?? ""}>
            <option value="">Sin especificar</option>
            {CLIENT_PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
            {client?.platform && !CLIENT_PLATFORMS.includes(client.platform as (typeof CLIENT_PLATFORMS)[number]) && (
              <option value={client.platform}>{client.platform}</option>
            )}
          </Select>
        </Field>
        <Field label="Usuario o ID en la plataforma" error={e.platform_ref} hint="Ej. su apodo de Mercado Libre.">
          <Input name="platform_ref" defaultValue={client?.platform_ref ?? ""} placeholder="Ej. JUANPEREZ2024" />
        </Field>
      </div>
      <Field label="Notas" error={e.notes} hint="Se guardan cifradas.">
        <Textarea name="notes" defaultValue={client?.notes ?? ""} />
      </Field>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <SubmitButton disabled={Boolean(exact)}>{client ? "Guardar cambios" : "Crear cliente"}</SubmitButton>
      </div>
    </form>
  );
}
