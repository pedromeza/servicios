"use client";

import { useActionState } from "react";
import { changePassword, type ActionState } from "@/lib/actions";
import { Field, FormError, Input } from "@/components/ui/Fields";
import { SubmitButton } from "@/components/ui/SubmitButton";

export function PasswordForm() {
  const [state, action] = useActionState<ActionState, FormData>(changePassword, null);
  return (
    <form action={action} className="space-y-4">
      <FormError message={state?.error} />
      {state?.ok && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Contraseña actualizada.</div>
      )}
      <Field label="Nueva contraseña" hint="Mínimo 10 caracteres. Usa una frase larga y única.">
        <Input name="password" type="password" autoComplete="new-password" required minLength={10} />
      </Field>
      <Field label="Confirmar contraseña">
        <Input name="confirm" type="password" autoComplete="new-password" required minLength={10} />
      </Field>
      <SubmitButton variant="navy">Cambiar contraseña</SubmitButton>
    </form>
  );
}
