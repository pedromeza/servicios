"use client";

import { Plus } from "lucide-react";
import { useActionState, useEffect, useMemo, useState } from "react";
import { savePriceItem, type ActionState } from "@/lib/actions";
import { CURRENCIES, LICENSE_PRODUCTS, PRODUCTS_BY_PROVIDER, type PriceItem } from "@/lib/types";
import { ComboSelect } from "@/components/ui/ComboSelect";
import { TermSelect } from "@/components/ui/TermSelect";
import { Button } from "@/components/ui/Button";
import { Field, FormError, Input } from "@/components/ui/Fields";
import { SubmitButton } from "@/components/ui/SubmitButton";

const ALL_PRODUCTS = Array.from(new Set([...Object.values(PRODUCTS_BY_PROVIDER).flat(), ...LICENSE_PRODUCTS]));

/** Frases frecuentes para la nota; se suman las notas ya usadas en otros precios. */
const NOTE_SUGGESTIONS = [
  "Activación el mismo día",
  "Se asigna a tu correo y accedes desde el programa",
  "Licencia original con actualizaciones",
  "Incluye instalación por videollamada",
  "Soporte por WhatsApp",
  "Para 1 computadora",
  "Hasta 3 dispositivos",
  "Precio por usuario",
];

export function PriceForm({
  item,
  usedNotes = [],
  onDone,
  onCancel,
}: {
  item: PriceItem | null;
  usedNotes?: string[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [state, action] = useActionState<ActionState, FormData>(savePriceItem, null);
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [termMonths, setTermMonths] = useState(item ? String(item.term_months || "") : "12");
  const [currency, setCurrency] = useState(item?.currency ?? "MXN");
  const suggestions = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const n of [...usedNotes, ...NOTE_SUGGESTIONS]) {
      const t = n.trim();
      const key = t.toLowerCase();
      if (t && !seen.has(key)) {
        seen.add(key);
        out.push(t);
      }
    }
    return out;
  }, [usedNotes]);
  const current = notes.toLowerCase();
  const addNote = (s: string) => setNotes((n) => (n.trim() ? `${n.trim()}${/[.;,]$/.test(n.trim()) ? "" : ","} ${s}` : s));
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);
  const e = state?.errors ?? {};
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={item?.id ?? ""} />
      <FormError message={state?.error} />
      <Field label="Producto" error={e.product}>
        <Input name="product" list="price-products" defaultValue={item?.product} required autoFocus placeholder="AutoCAD" />
        <datalist id="price-products">
          {ALL_PRODUCTS.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Vigencia" error={e.term_months} hint="Permanente, o meses/años; escribe otra, p. ej. 18 o 5 años.">
          <TermSelect name="term_months" value={termMonths} onChange={setTermMonths} emptyLabel="Permanente" />
        </Field>
        <Field label="Moneda" error={e.currency}>
          <ComboSelect name="currency" value={currency} onChange={setCurrency} options={CURRENCIES.map((c) => ({ value: c, label: c }))} placeholder="Moneda" />
        </Field>
        <Field label="Precio al cliente" error={e.price}>
          <Input name="price" type="number" step="0.01" min={0} defaultValue={item?.price ?? ""} placeholder="0.00" required />
        </Field>
        <Field label="Te cuesta" error={e.cost} hint="Opcional, para ver la ganancia por línea.">
          <Input name="cost" type="number" step="0.01" min={0} defaultValue={item?.cost || ""} placeholder="0.00" />
        </Field>
      </div>
      <Field label="Nota (aparece en la cotización)" error={e.notes} hint="Toca una sugerencia para añadirla.">
        <Input name="notes" value={notes} onChange={(ev) => setNotes(ev.target.value)} placeholder="Ej. activación el mismo día, incluye instalación" maxLength={300} />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {suggestions.map((s) => {
            const used = current.includes(s.toLowerCase());
            return (
              <button
                key={s}
                type="button"
                onClick={() => !used && addNote(s)}
                disabled={used}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition ${
                  used ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-600 hover:border-brand hover:text-navy-900"
                }`}
              >
                {!used && <Plus size={11} />}
                {s}
              </button>
            );
          })}
        </div>
      </Field>
      <input type="hidden" name="active" value={item ? (item.active ? "on" : "off") : "on"} />
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <SubmitButton>{item ? "Guardar cambios" : "Agregar precio"}</SubmitButton>
      </div>
    </form>
  );
}
