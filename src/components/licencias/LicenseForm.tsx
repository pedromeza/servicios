"use client";

import { Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { saveLicense, type ActionState } from "@/lib/actions";
import { addYearsISO, fmtDate, todayISO } from "@/lib/format";
import {
  LICENSE_KINDS,
  LICENSE_PRODUCTS,
  LICENSE_STATUS,
  LICENSE_TERMS,
  MAX_LICENSE_SEATS,
  type License,
  type Option,
} from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/Fields";
import { SubmitButton } from "@/components/ui/SubmitButton";

type SeatRow = { key: number; email: string; client_id: string };

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
  const [kind, setKind] = useState<string>(license?.kind ?? "key");
  const [term, setTerm] = useState<string>(license?.term ?? "perpetual");
  const [purchasedAt, setPurchasedAt] = useState<string>(license?.purchased_at ?? "");
  const [expiresAt, setExpiresAt] = useState<string>(license?.expires_at ?? "");
  const [seats, setSeats] = useState<string>(String(license?.seats ?? 1));
  const [rows, setRows] = useState<SeatRow[]>(() =>
    (license?.seat_assignments ?? []).map((s, i) => ({ key: i, email: s.email ?? "", client_id: s.client_id ?? "" })),
  );
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);
  const e = state?.errors ?? {};

  const isAccount = kind === "account";
  const isAnnual = term === "annual";
  const seatCount = Math.max(1, Math.floor(Number(seats) || 1));

  const addRow = () => setRows((r) => [...r, { key: Date.now() + r.length, email: "", client_id: "" }]);
  const updateRow = (key: number, patch: Partial<SeatRow>) => setRows((r) => r.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  const removeRow = (key: number) => setRows((r) => r.filter((row) => row.key !== key));

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

      <Field label="Tipo de licencia" error={e.kind}>
        <div className="grid gap-2 sm:grid-cols-2">
          {Object.entries(LICENSE_KINDS).map(([k, v]) => (
            <label
              key={k}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                kind === k ? "border-brand bg-brand-light text-navy-900" : "border-slate-200 hover:bg-navy-50"
              }`}
            >
              <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="accent-brand" />
              {v}
            </label>
          ))}
        </div>
      </Field>

      {!isAccount ? (
        <Field
          label="Clave de producto"
          error={e.key}
          hint={
            license?.kind === "key" && license.key_hint
              ? `Guardada (termina en ${license.key_hint}). Déjala vacía para conservarla.`
              : "Se guarda cifrada; solo se muestra bajo demanda."
          }
        >
          <Input name="key" className="font-mono uppercase tracking-wider" placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX" autoComplete="off" spellCheck={false} />
        </Field>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Correo de la cuenta principal" error={e.account_email} hint="Se guarda cifrado.">
              <Input
                name="account_email"
                type="email"
                inputMode="email"
                autoComplete="off"
                defaultValue={license?.account_email ?? ""}
                placeholder="principal@correo.com"
                required={isAccount && !license?.account_email}
              />
            </Field>
            <Field
              label="Contraseña"
              error={e.account_password}
              hint={license?.has_account_password ? "Déjala vacía para conservar la actual." : "Se guarda cifrada; solo se muestra bajo demanda."}
            >
              <div className="relative">
                <Input name="account_password" type={show ? "text" : "password"} autoComplete="new-password" className="pr-10" />
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

          <Field label="Puestos incluidos" error={e.seats} hint="Cuántos usuarios admite la licencia. Ej. Microsoft 365 Familia: 5 además de la principal.">
            <Input name="seats" type="number" min={1} max={MAX_LICENSE_SEATS} step={1} value={seats} onChange={(ev) => setSeats(ev.target.value)} />
          </Field>

          <Field label="Puestos asignados" error={e.seat_assignments} hint="Correo de cada usuario y a qué cliente se lo diste. Se guardan cifrados.">
            <div className="space-y-2 rounded-lg border border-slate-200 p-3">
              {rows.length === 0 && <p className="text-xs text-slate-400">Aún no asignas ningún puesto.</p>}
              {rows.map((row, i) => (
                <div key={row.key} className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_1fr_auto]">
                  <Input
                    name="seat_email"
                    type="email"
                    inputMode="email"
                    autoComplete="off"
                    value={row.email}
                    onChange={(ev) => updateRow(row.key, { email: ev.target.value })}
                    placeholder={`Correo del puesto ${i + 1}`}
                    className="col-span-2 sm:col-span-1"
                  />
                  <Select name="seat_client" value={row.client_id} onChange={(ev) => updateRow(row.key, { client_id: ev.target.value })}>
                    <option value="">Sin cliente</option>
                    {clients.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </Select>
                  <Button size="icon" variant="ghost" aria-label="Quitar puesto" className="hover:text-red-600" onClick={() => removeRow(row.key)}>
                    <Trash2 size={15} />
                  </Button>
                </div>
              ))}
              <div className="flex items-center justify-between pt-1">
                <span className={`text-xs ${rows.length > seatCount ? "text-red-600" : "text-slate-400"}`}>
                  {rows.length} de {seatCount} puesto{seatCount === 1 ? "" : "s"} asignado{rows.length === 1 ? "" : "s"}
                </span>
                <Button size="sm" variant="secondary" onClick={addRow} disabled={rows.length >= seatCount}>
                  <Plus size={14} /> Agregar puesto
                </Button>
              </div>
            </div>
          </Field>
        </>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Vigencia" error={e.term}>
          <Select
            name="term"
            value={term}
            onChange={(ev) => {
              setTerm(ev.target.value);
              if (ev.target.value === "annual") {
                const from = purchasedAt || todayISO();
                if (!purchasedAt) setPurchasedAt(from);
                if (!expiresAt) setExpiresAt(addYearsISO(from, 1));
              }
            }}
          >
            {Object.entries(LICENSE_TERMS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Fecha de compra" error={e.purchased_at}>
          <Input
            name="purchased_at"
            type="date"
            value={purchasedAt}
            onChange={(ev) => {
              setPurchasedAt(ev.target.value);
              if (isAnnual && ev.target.value) setExpiresAt(addYearsISO(ev.target.value, 1));
            }}
          />
        </Field>
        {isAnnual && (
          <Field label="Vence" error={e.expires_at} hint={expiresAt ? `Renovar antes del ${fmtDate(expiresAt)}.` : "Un año después de la compra."}>
            <Input name="expires_at" type="date" value={expiresAt} onChange={(ev) => setExpiresAt(ev.target.value)} />
          </Field>
        )}
      </div>

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
        <Field label={isAccount ? "Cliente de la cuenta principal" : "Cliente"} error={e.client_id}>
          <Select name="client_id" defaultValue={license?.client_id ?? ""}>
            <option value="">{isAccount ? "Sin asignar (propia)" : "Sin asignar"}</option>
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
