/** Convierte "a@x.com, b@y.com" (coma, punto y coma, espacio o salto de línea) en una lista limpia y sin repetidos. */
export function splitEmails(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  for (const part of raw.split(/[\s,;]+/)) {
    const e = part.trim().toLowerCase();
    if (e) seen.add(e);
  }
  return [...seen];
}
