/** Vigencias en meses: opciones frecuentes; cualquier otro número de meses se puede escribir. */
export const TERM_PRESETS = [1, 3, 6, 12, 24, 36] as const;

export function termLabel(months: number): string {
  if (months % 12 === 0) {
    const y = months / 12;
    return `${y} año${y === 1 ? "" : "s"}`;
  }
  return `${months} mes${months === 1 ? "" : "es"}`;
}

/** "18", "18 meses", "2 años", "año y medio" no; acepta número + unidad opcional. */
export function parseTermInput(text: string): number | null {
  const t = text.trim().toLowerCase();
  const m = t.match(/^(\d{1,3})\s*(a[ñn]os?|a|m(eses)?)?$/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!n) return null;
  const months = m[2]?.startsWith("a") ? n * 12 : n;
  return months >= 1 && months <= 120 ? months : null;
}

export function termOptions(extra: number[] = []): { value: string; label: string }[] {
  const all = Array.from(new Set([...TERM_PRESETS, ...extra.filter((n) => n > 0)])).sort((a, b) => a - b);
  return all.map((n) => ({ value: String(n), label: termLabel(n) }));
}
