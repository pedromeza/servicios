"use client";

import { Eye, EyeOff } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { saveAccount, type ActionState } from "@/lib/actions";
import { addYearsISO, fmtDate, todayISO } from "@/lib/format";
import { ACCOUNT_ROLES, ACCOUNT_TERMS, PROVIDERS, type Account, type Option } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/Fields";
import { SubmitButton } from "@/components/ui/SubmitButton";

export function AccountForm({
  account,
  admins,
  clients,
  onDone,
  onCancel,
}: {
  account: Account | null;
  admins: Option[];
  clients: Option[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [state, action] = useActionState<ActionState, FormData>(saveAccount, null);
  const [role, setRole] = useState<string>(account?.role ?? "user");
  const [clientId, setClientId] = useState<string>(account?.client_id ?? "");
  const [contractedAt, setContractedAt] = useState<string>(account?.contracted_at ?? "");
  const [termYears, setTermYears] = useState<string>(account?.term_years ? String(account.term_years) : "");
  const [show, setShow] = useState(false);
  const isOwn = clientId === "";
  const expiresAt = contractedAt && termYears ? addYearsISO(contractedAt, Number(termYears)) : null;
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);
  const e = state?.errors ?? {};

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={account?.id ?? ""} />
      <FormError message={state?.error} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Proveedor" error={e.provider}>
          <Select name="provider" defaultValue={account?.provider ?? "Autodesk"}>
            {PROVIDERS.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </Select>
        </Field>
        <Field label="Tipo de cuenta" error={e.role}>
          <Select name="role" value={role} onChange={(ev) => setRole(ev.target.value)}>
            {Object.entries(ACCOUNT_ROLES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Nombre de la cuenta" error={e.label} hint="Cómo la identificas tú. Ej. “Admin Autodesk principal” o “Usuario 3 Revit”.">
        <Input name="label" defaultValue={account?.label} required autoFocus />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Correo / usuario" error={e.username} hint="Se guarda cifrado.">
          <Input name="username" defaultValue={account?.username} required autoComplete="off" />
        </Field>
        <Field label="Contraseña" error={e.password} hint={account ? "Déjala vacía para conservar la actual." : "Se guarda cifrada; solo se muestra bajo demanda."}>
          <div className="relative">
            <Input name="password" type={show ? "text" : "password"} autoComplete="new-password" className="pr-10" />
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
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {role === "user" && (
          <Field label="Depende de la cuenta admin" error={e.parent_account_id}>
            <Select name="parent_account_id" defaultValue={account?.parent_account_id ?? ""}>
              <option value="">Ninguna</option>
              {admins
                .filter((a) => a.value !== account?.id)
                .map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
            </Select>
          </Field>
        )}
        <Field label="Cliente asignado" error={e.client_id}>
          <Select name="client_id" value={clientId} onChange={(ev) => setClientId(ev.target.value)}>
            <option value="">Sin asignar (propia)</option>
            {clients.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {isOwn && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Fecha de contratación" error={e.contracted_at}>
            <Input name="contracted_at" type="date" value={contractedAt} onChange={(ev) => setContractedAt(ev.target.value)} />
          </Field>
          <Field
            label="Vigencia"
            error={e.term_years}
            hint={expiresAt ? `Vence el ${fmtDate(expiresAt)}.` : "Por cuánto tiempo contrataste esta cuenta."}
          >
            <Select
              name="term_years"
              value={termYears}
              onChange={(ev) => {
                setTermYears(ev.target.value);
                if (ev.target.value && !contractedAt) setContractedAt(todayISO());
              }}
            >
              <option value="">Sin definir</option>
              {Object.entries(ACCOUNT_TERMS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      )}

      <Field label="Notas" error={e.notes} hint="Correo de recuperación, preguntas de seguridad, etc. Se guardan cifradas.">
        <Textarea name="notes" defaultValue={account?.notes ?? ""} />
      </Field>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <SubmitButton>{account ? "Guardar cambios" : "Crear cuenta"}</SubmitButton>
      </div>
    </form>
  );
}
