"use client";

import { Check, Copy, Eye, EyeOff, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { revealSecret, type SecretEntity } from "@/lib/actions";
import { cn } from "@/lib/cn";

/**
 * Muestra un secreto cifrado solo bajo demanda. El valor nunca viaja al navegador
 * hasta que el usuario pulsa "mostrar" o "copiar", y cada revelación queda en bitácora.
 */
export function SecretField({
  entity,
  id,
  hint,
  empty = "Sin dato",
  className,
}: {
  entity: SecretEntity;
  id: string;
  hint?: string;
  empty?: string;
  className?: string;
}) {
  const [value, setValue] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  const fetchValue = (): Promise<string | null> =>
    new Promise((resolve) => {
      start(async () => {
        const res = await revealSecret(entity, id);
        if (res.ok) {
          setValue(res.value);
          setError(null);
          resolve(res.value);
        } else {
          setError(res.error);
          resolve(null);
        }
      });
    });

  const toggle = async () => {
    if (value !== null) return setValue(null);
    await fetchValue();
  };

  const copy = async () => {
    const v = value ?? (await fetchValue());
    if (!v) return;
    try {
      await navigator.clipboard.writeText(v);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("No se pudo copiar al portapapeles.");
    }
  };

  const masked = hint ? `•••••-${hint}` : "••••••••••";

  return (
    <div className={cn("inline-flex max-w-full items-center gap-1.5", className)}>
      <code
        className={cn(
          "truncate rounded-md px-2 py-1 font-mono text-xs",
          value !== null ? "bg-brand-light text-navy-900" : "bg-slate-100 text-slate-500",
        )}
        title={value ?? undefined}
      >
        {error ? empty : value ?? masked}
      </code>
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-label={value !== null ? "Ocultar" : "Mostrar"}
        className="rounded-md p-1 text-slate-500 hover:bg-navy-100 hover:text-navy-800 disabled:opacity-50"
      >
        {pending ? <Loader2 size={15} className="animate-spin" /> : value !== null ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
      <button
        type="button"
        onClick={copy}
        disabled={pending}
        aria-label="Copiar"
        className="rounded-md p-1 text-slate-500 hover:bg-navy-100 hover:text-navy-800 disabled:opacity-50"
      >
        {copied ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
