"use client";

import { useState } from "react";
import { parseTermInput, termOptions } from "@/lib/terms";
import { ComboSelect } from "./ComboSelect";

/** Selector de vigencia en meses con búsqueda y posibilidad de escribir otra (p. ej. "18" o "5 años"). */
export function TermSelect({
  name,
  value,
  onChange,
  emptyLabel,
}: {
  name: string;
  value: string; // meses como texto, "" = sin definir
  onChange: (months: string) => void;
  emptyLabel?: string;
}) {
  const [extra, setExtra] = useState<number[]>(() => (value ? [Number(value)] : []));
  return (
    <ComboSelect
      name={name}
      value={value}
      onChange={onChange}
      options={termOptions(extra)}
      emptyLabel={emptyLabel}
      placeholder="Ej. 18 o 5 años"
      createLabel="Usar"
      onCreate={(text) => {
        const months = parseTermInput(text);
        if (!months) throw new Error("Escribe un número de meses (1 a 120) o de años, p. ej. 18 o 5 años.");
        setExtra((l) => (l.includes(months) ? l : [...l, months]));
        return { value: String(months), label: termOptions([months]).find((o) => o.value === String(months))!.label };
      }}
    />
  );
}
