"use client";

import { Trash2, UserPlus } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import { addHelper, removeHelper, type ActionState } from "@/lib/actions";
import type { Helper } from "@/lib/data";
import { fmtDate } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { Field, FormError, Input } from "@/components/ui/Fields";
import { SubmitButton } from "@/components/ui/SubmitButton";

export function TeamPanel({ helpers }: { helpers: Helper[] }) {
  const [state, action] = useActionState<ActionState, FormData>(addHelper, null);
  const [removing, setRemoving] = useState<Helper | null>(null);
  const [pending, start] = useTransition();
  const e = state?.errors ?? {};

  return (
    <div className="space-y-4 px-5 py-4 text-sm">
      {helpers.length === 0 ? (
        <p className="text-slate-500">Aún no tienes ayudantes. Un ayudante puede registrar clientes, suscripciones, licencias y renovaciones, pero no ve contraseñas ni claves y no puede borrar nada.</p>
      ) : (
        <ul className="divide-y divide-navy-100 rounded-lg border border-navy-100">
          {helpers.map((h) => (
            <li key={h.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="min-w-0">
                <div className="truncate text-slate-800">{h.email}</div>
                <div className="text-xs text-slate-400">Ayudante desde {fmtDate(h.created_at.slice(0, 10))}</div>
              </div>
              <Button size="icon" variant="ghost" aria-label="Quitar ayudante" className="hover:text-red-600" onClick={() => setRemoving(h)}>
                <Trash2 size={15} />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <form action={action} className="space-y-3 rounded-lg border border-dashed border-navy-200 p-3">
        <p className="font-medium text-navy-900">Dar de alta un ayudante</p>
        <FormError message={state?.error} />
        {state?.ok && <p className="text-xs text-emerald-700">Listo. Ya puede entrar con ese correo y la contraseña que pusiste.</p>}
        <Field label="Correo" error={e.email}>
          <Input name="email" type="email" required placeholder="ayudante@correo.com" autoComplete="off" />
        </Field>
        <Field label="Contraseña inicial" error={e.password} hint="Mínimo 8 caracteres. Podrá cambiarla desde Seguridad.">
          <Input name="password" type="text" required minLength={8} autoComplete="off" />
        </Field>
        <div className="flex justify-end">
          <SubmitButton>
            <UserPlus size={15} /> Crear acceso
          </SubmitButton>
        </div>
      </form>

      <ConfirmDialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        pending={pending}
        title="Quitar ayudante"
        description={`Se eliminará el acceso de ${removing?.email}. Los registros que haya creado se conservan.`}
        onConfirm={() => {
          if (!removing) return;
          start(async () => {
            await removeHelper(removing.id);
            setRemoving(null);
          });
        }}
      />
    </div>
  );
}
