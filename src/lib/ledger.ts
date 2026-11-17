import type { LedgerRow } from "./types";

export type LedgerFilters = { q?: string; tipo?: string; mes?: string; plataforma?: string };

/** Filtra el libro de ventas con los parámetros de la URL (búsqueda, tipo, mes YYYY-MM y plataforma). */
export function filterLedger(rows: LedgerRow[], f: LedgerFilters): LedgerRow[] {
  const q = (f.q ?? "").trim().toLowerCase();
  return rows.filter(
    (r) =>
      (!f.tipo || f.tipo === "deleted" || r.kind === f.tipo) &&
      (!f.mes || r.date.startsWith(f.mes)) &&
      (!f.plataforma || (r.platform ?? "") === f.plataforma) &&
      (!q || [r.client_name, r.concept, r.detail, r.platform].some((x) => (x ?? "").toLowerCase().includes(q))),
  );
}
