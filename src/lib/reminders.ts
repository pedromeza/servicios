/**
 * Plantilla del recordatorio de renovación. Código compartido entre servidor (envío) y navegador (vista previa).
 * El cuerpo es texto plano con variables {{así}}; las líneas en blanco separan párrafos.
 */
export const CLIENT_PLATFORMS = ["Mercado Libre", "WhatsApp", "Facebook", "Instagram", "Directo", "Recomendación", "Otra"] as const;

export type ReminderSettings = {
  reminder_subject: string;
  reminder_body: string;
  reminder_button: string;
  payment_url: string;
  whatsapp: string;
  logo_url: string;
  reminder_days: number;
};

export const REMINDER_VARS = [
  ["cliente", "Nombre del cliente"],
  ["programas", "Programas de la suscripción"],
  ["fecha_compra", "Fecha de compra"],
  ["fecha_renovacion", "Fecha en que vence"],
  ["dias", "Días que faltan (o “hoy” / “hace N días”)"],
  ["precio", "Precio de la suscripción"],
  ["plataforma", "Plataforma por la que compró"],
  ["whatsapp", "Tu número de WhatsApp"],
] as const;

export const DEFAULT_REMINDER: ReminderSettings = {
  reminder_subject: "Tu licencia de {{programas}} vence {{dias}} · PGPM MEX",
  reminder_body: `Hola {{cliente}},

Te escribimos de PGPM MEX. La licencia de {{programas}} que compraste el {{fecha_compra}} por {{plataforma}} vence el {{fecha_renovacion}} ({{dias}}).

Para que no te quedes sin el programa, puedes renovarla con el botón de abajo. El pago se hace por Mercado Libre, igual que tu compra original, y nosotros la activamos el mismo día.

Si tienes dudas o quieres renovar por más tiempo, escríbenos por WhatsApp al {{whatsapp}}. Solo damos atención por ese medio.

Gracias por tu confianza.`,
  reminder_button: "Renovar por Mercado Libre",
  payment_url: "",
  whatsapp: "",
  logo_url: "",
  reminder_days: 30,
};

export type ReminderVars = Record<(typeof REMINDER_VARS)[number][0], string>;

export const SAMPLE_VARS: ReminderVars = {
  cliente: "Edgar Nayar",
  programas: "AutoCAD",
  fecha_compra: "12 feb 2026",
  fecha_renovacion: "12 feb 2027",
  dias: "en 15 días",
  precio: "$350.00",
  plataforma: "Mercado Libre",
  whatsapp: "55 1234 5678",
};

export function fillTemplate(text: string, vars: ReminderVars): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, key: string) => (key in vars ? vars[key as keyof ReminderVars] : m));
}

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}

/** Texto que describe cuántos días faltan, en la forma que se lee bien dentro de una frase. */
export function daysPhrase(days: number): string {
  if (days < 0) return `hace ${Math.abs(days)} día${Math.abs(days) === 1 ? "" : "s"}`;
  if (days === 0) return "hoy";
  return `en ${days} día${days === 1 ? "" : "s"}`;
}

/** Correo completo en HTML con la imagen de marca de PGPM MEX. */
export function reminderHtml(s: ReminderSettings, vars: ReminderVars): { subject: string; html: string; text: string } {
  const subject = fillTemplate(s.reminder_subject, vars);
  const body = fillTemplate(s.reminder_body, vars);
  const button = fillTemplate(s.reminder_button, vars);
  const paragraphs = body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#0f172a">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const logo = s.logo_url
    ? `<img src="${escapeHtml(s.logo_url)}" alt="PGPM MEX" style="max-height:48px;display:block">`
    : `<div style="font-size:22px;font-weight:800;letter-spacing:-0.3px;color:#fff">PGPM <span style="color:#f7941d">MEX</span></div>
       <div style="font-size:11px;color:#c9d4e8;letter-spacing:.14em;text-transform:uppercase">Soluciones digitales</div>`;
  const cta = s.payment_url
    ? `<p style="margin:22px 0 8px;text-align:center"><a href="${escapeHtml(s.payment_url)}" style="display:inline-block;background:#f7941d;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:12px 22px;border-radius:12px">${escapeHtml(button)}</a></p>`
    : "";
  const wa = s.whatsapp
    ? `<p style="margin:14px 0 0;text-align:center;font-size:13px;color:#64748b">Atención únicamente por WhatsApp: <a href="https://wa.me/${escapeHtml(s.whatsapp.replace(/\D/g, ""))}" style="color:#0b2244;font-weight:600">${escapeHtml(s.whatsapp)}</a></p>`
    : "";
  const html = `<!doctype html><html lang="es"><body style="margin:0;background:#f4f6fa;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px">
    <div style="background:#0b2244;border-radius:16px 16px 0 0;padding:22px 26px">${logo}</div>
    <div style="background:#fff;border:1px solid #e3e9f4;border-top:0;border-radius:0 0 16px 16px;padding:26px">
      <div style="background:#fff1e0;border-radius:12px;padding:12px 16px;margin:0 0 18px;font-size:13px;color:#0b2244">
        <strong>${escapeHtml(vars.programas)}</strong> · comprado el ${escapeHtml(vars.fecha_compra)} por ${escapeHtml(vars.plataforma)} · vence el <strong>${escapeHtml(vars.fecha_renovacion)}</strong>
      </div>
      ${paragraphs}
      ${cta}
      ${wa}
    </div>
    <p style="text-align:center;color:#94a3b8;font-size:11px;margin:16px 0 0">PGPM MEX · Soluciones digitales</p>
  </div></body></html>`;
  return { subject, html, text: body };
}
