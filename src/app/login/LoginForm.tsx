"use client";

import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { useActionState, useState } from "react";
import { login, type ActionState } from "@/lib/actions";
import { Field, FormError, Input } from "@/components/ui/Fields";
import { SubmitButton } from "@/components/ui/SubmitButton";

export function LoginForm({ initialError }: { initialError?: string }) {
  const [state, action] = useActionState<ActionState, FormData>(login, null);
  const [show, setShow] = useState(false);

  return (
    <form action={action} className="space-y-4">
      <FormError message={state?.error ?? initialError} />
      <Field label="Correo">
        <Input name="email" type="email" autoComplete="username" required placeholder="tu@correo.com" autoFocus />
      </Field>
      <Field label="Contraseña">
        <div className="relative">
          <Input name="password" type={show ? "text" : "password"} autoComplete="current-password" required className="pr-10" />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700"
          >
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </Field>
      <SubmitButton variant="navy">
        <LockKeyhole size={16} /> Entrar
      </SubmitButton>
    </form>
  );
}
