/** Normaliza un nombre para comparar duplicados: sin acentos, minúsculas, espacios colapsados. */
/**
 * ¿Son la misma persona? Iguales sin acentos ni mayúsculas, o un nombre contiene todas las
 * palabras del otro ("linda maritza martinez" ≈ "linda maritza martinez zaldaña"). Pide al
 * menos dos palabras en el nombre corto para no confundir "Daniel" con "Daniel Ruiz".
 */
export function sameName(a: string, b: string): boolean {
  const x = normalizeName(a);
  const y = normalizeName(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  const words = short.split(" ").filter((w) => w.length > 1);
  if (words.length < 2) return false;
  const pool = new Set(long.split(" "));
  return words.every((w) => pool.has(w));
}

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
