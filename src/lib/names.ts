/** Normaliza un nombre para comparar duplicados: sin acentos, minúsculas, espacios colapsados. */
export function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Nombres existentes que coinciden exactamente o se parecen al que se está escribiendo. */
export function findSimilarNames(name: string, existing: string[], excludeExact?: string | null) {
  const n = normalizeName(name);
  if (!n) return { exact: null as string | null, similar: [] as string[] };
  const exact = existing.find((e) => normalizeName(e) === n && (!excludeExact || normalizeName(excludeExact) !== normalizeName(e))) ?? null;
  const similar = n.length >= 4
    ? existing.filter((e) => {
        const ne = normalizeName(e);
        return ne !== n && (ne.includes(n) || n.includes(ne)) && (!excludeExact || normalizeName(excludeExact) !== ne);
      })
    : [];
  return { exact, similar: similar.slice(0, 3) };
}
