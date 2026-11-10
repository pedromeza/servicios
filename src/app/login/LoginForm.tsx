"use client";

import { ArrowLeft, Eye, EyeOff, LockKeyhole, MailCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { login, requestPasswordReset, type ActionState } from "@/lib/actions";
import { Field, FormError, Input } from "@/components/ui/Fields";
import { SubmitButton } from "@/components/ui/SubmitButton";

export function LoginForm({ initialError }: { initialError?: string }) {
  const router = useRouter();
  const [state, action] = useActionState<ActionState, FormData>(login, null);
  const [reset, resetAction] = useActionState<ActionState, FormData>(requestPasswordReset, null);
  const [show, setShow] = useState(false);
  const [forgot, setForgot] = useState(false);

  // Si el enlace de recuperación del correo cae aquí, llevar su token a la pantalla de nueva contraseña.
  useEffect(() => {
    const { hash, search } = window.location;
    if (hash.includes("type=recovery") || new URLSearchParams(search).has("code")) {
      router.replace(`/restablecer${search}${hash}`);
    }
  }, [router]);

  if (forgot) {
    return (
      <form action={resetAction} className="space-y-4">
        <p className="text-sm text-slate-600">Te enviaremos un enlace para definir una contraseña nueva.</p>
        {reset?.ok ? (
          <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            <MailCheck size={16} className="mt-0.5 shrink-0" />
            Si el correo está autorizado, en unos minutos recibirás el enlace. Revisa también la carpeta de spam.
          </div>
        ) : (
          <>
            <FormError message={reset?.error} />
            <Field label="Correo">
              <Input name="email" type="email" autoComplete="username" required placeholder="tu@correo.com" autoFocus />
            </Field>
            <SubmitButton variant="navy">Enviar enlace</SubmitButton>
          </>
        )}
        <button type="button" onClick={() => setForgot(false)} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-navy-900">
          <ArrowLeft size={14} /> Volver a iniciar sesión
        </button>
      </form>
    );
  }

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
      <div className="flex items-center justify-between gap-3">
        <SubmitButton variant="navy">
          <LockKeyhole size={16} /> Entrar
        </SubmitButton>
        <button type="button" onClick={() => setForgot(true)} className="text-sm text-slate-500 hover:text-navy-900">
          ¿Olvidaste tu contraseña?
        </button>
      </div>
    </form>
  );
}
