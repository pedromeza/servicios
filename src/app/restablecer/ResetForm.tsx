"use client";

import { Eye, EyeOff, Loader2, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Field, FormError, Input } from "@/components/ui/Fields";

type Stage = "checking" | "ready" | "invalid" | "saving" | "done";

export function ResetForm() {
  const supabase = useMemo(() => createClient(), []);
  const [stage, setStage] = useState<Stage>("checking");
  const [error, setError] = useState<string | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    let settled = false;
    const settle = (s: Stage) => {
      if (settled) return;
      settled = true;
      setStage(s);
    };
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) settle("ready");
    });
    (async () => {
      // Enlace del correo (flujo implícito): los tokens vienen en el fragmento #access_token=...&refresh_token=...
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const access_token = hash.get("access_token");
      const refresh_token = hash.get("refresh_token");
      if (access_token && refresh_token) {
        const { error } = await supabase.auth.setSession({ access_token, refresh_token });
        if (error) console.error("[restablecer] setSession:", error.message);
        if (!error) {
          window.history.replaceState(null, "", window.location.pathname);
          return settle("ready");
        }
      }
      // Flujo PKCE: ?code=...
      const code = new URLSearchParams(window.location.search).get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) console.error("[restablecer] exchangeCode:", error.message);
        if (!error) return settle("ready");
      }
      const { data } = await supabase.auth.getSession();
      if (data.session) return settle("ready");
      // El enlace del correo trae el token en el fragmento (#...); dar tiempo a que el cliente lo procese.
      setTimeout(() => settle("invalid"), 3000);
    })();
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password") ?? "");
    const confirm = String(fd.get("confirm") ?? "");
    if (password.length < 10) return setError("Usa al menos 10 caracteres.");
    if (password !== confirm) return setError("Las contraseñas no coinciden.");
    setError(null);
    setStage("saving");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
      setStage("ready");
      return;
    }
    setStage("done");
    // Navegación completa a propósito: el proxy debe leer las cookies de sesión recién creadas.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    setTimeout(() => window.location.assign("/"), 1200);
  }

  if (stage === "checking") {
    return (
      <p className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 size={16} className="animate-spin" /> Validando el enlace…
      </p>
    );
  }
  if (stage === "invalid") {
    return (
      <div className="space-y-4">
        <FormError message="El enlace no es válido o ya caducó. Solicita uno nuevo desde la pantalla de inicio de sesión." />
        <Link href="/login" className="inline-flex h-10 items-center rounded-lg bg-navy-900 px-4 text-sm font-medium text-white hover:bg-navy-800">
          Ir al inicio de sesión
        </Link>
      </div>
    );
  }
  if (stage === "done") {
    return <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Contraseña guardada. Entrando…</p>;
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <FormError message={error ?? undefined} />
      <Field label="Nueva contraseña" hint="Mínimo 10 caracteres. Usa una frase larga y única.">
        <div className="relative">
          <Input name="password" type={show ? "text" : "password"} autoComplete="new-password" required minLength={10} className="pr-10" autoFocus />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Ocultar" : "Mostrar"}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700"
          >
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </Field>
      <Field label="Confirmar contraseña">
        <Input name="confirm" type={show ? "text" : "password"} autoComplete="new-password" required minLength={10} />
      </Field>
      <Button type="submit" variant="navy" disabled={stage === "saving"}>
        {stage === "saving" ? <Loader2 size={16} className="animate-spin" /> : <LockKeyhole size={16} />} Guardar y entrar
      </Button>
    </form>
  );
}
