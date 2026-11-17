const pad = (n: number) => String(n).padStart(2, "0");

export function parseDate(d: string): Date {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day);
}

/**
 * Zona horaria del negocio. El servidor (Vercel) corre en hora universal, 6 horas adelante de México:
 * sin fijarla, después de las 6 p.m. "hoy" sería mañana y las horas saldrían corridas.
 */
export const TIME_ZONE = "America/Mexico_City";

/** La fecha de hoy (YYYY-MM-DD) en la Ciudad de México, sin importar dónde corra el código. */
export function todayISO(): string {
  // en-CA formatea como 2026-11-17.
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

/** Fecha (YYYY-MM-DD) en la Ciudad de México de un instante (ISO con hora). */
export function dateInZone(iso: string | Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(typeof iso === "string" ? new Date(iso) : iso);
}

export function addDaysISO(iso: string, days: number): string {
  const d = parseDate(iso);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addYearsISO(iso: string, years: number): string {
  const d = parseDate(iso);
  d.setFullYear(d.getFullYear() + years);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Suma meses conservando el día; si el mes destino es más corto, usa su último día. */
export function addMonthsISO(iso: string, months: number): string {
  const d = parseDate(iso);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function daysUntil(d: string | null): number | null {
  if (!d) return null;
  // Ambas fechas como días de calendario (sin hora), contando "hoy" en la Ciudad de México.
  return Math.round((parseDate(d).getTime() - parseDate(todayISO()).getTime()) / 86_400_000);
}

export function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", year: "numeric" }).format(parseDate(d));
}

export function fmtMoney(n: number | null | undefined, currency = "MXN"): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency, maximumFractionDigits: 2 }).format(n ?? 0);
}

export function fmtDateTime(iso: string): string {
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short", timeZone: TIME_ZONE }).format(new Date(iso));
}
