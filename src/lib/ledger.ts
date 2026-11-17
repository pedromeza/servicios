import type { LedgerRow } from "./types";

export type LedgerFilters = { q?: string; tipo?: string; mes?: string; plataforma?: string };

/**
 * Orden "las que vencen primero": primero lo que vence de hoy en adelante (lo más próximo arriba),
 * luego lo ya vencido (lo más reciente arriba) y al final lo que no renueva. `today` es YYYY-MM-DD.
 */
export function sortByRenewal(rows: LedgerRow[], today: string): LedgerRow[] {
  const group = (r: LedgerRow) => (!r.renews_at ? 2 : r.renews_at >= today ? 0 : 1);
  return [...rows].sort((a, b) => {
    const ga = group(a);
    const gb = group(b);
    if (ga !== gb) return ga - gb;
    if (ga === 0) return a.renews_at!.localeCompare(b.renews_at!) || b.date.localeCompare(a.date);
    if (ga === 1) return b.renews_at!.localeCompare(a.renews_at!) || b.date.localeCompare(a.date);
    return b.date.localeCompare(a.date);
  });
}

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
