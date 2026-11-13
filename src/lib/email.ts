import "server-only";
import { Resend } from "resend";
import { fmtDate, fmtMoney } from "./format";

export type RenewalItem = {
  client: string;
  account: string;
  provider: string;
  products: string;
  renews_at: string;
  days: number;
  price: number;
  currency: string;
};

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}

function row(i: RenewalItem) {
  const when = i.days < 0 ? `vencida hace ${Math.abs(i.days)} d` : i.days === 0 ? "hoy" : `en ${i.days} d`;
  const color = i.days <= 1 ? "#dc2626" : i.days <= 7 ? "#d97706" : "#0b2244";
  return `<tr>
    <td style="padding:10px 12px;border-bottom:1px solid #e3e9f4"><strong>${escapeHtml(i.client)}</strong><br><span style="color:#64748b;font-size:12px">${escapeHtml(i.account)} · ${escapeHtml(i.provider)}</span></td>
    <td style="padding:10px 12px;border-bottom:1px solid #e3e9f4">${escapeHtml(i.products)}</td>
    <td style="padding:10px 12px;border-bottom:1px solid #e3e9f4;white-space:nowrap">${fmtDate(i.renews_at)}<br><span style="color:${color};font-weight:600;font-size:12px">${when}</span></td>
    <td style="padding:10px 12px;border-bottom:1px solid #e3e9f4;text-align:right;white-space:nowrap">${fmtMoney(i.price, i.currency)}</td>
  </tr>`;
}

export function renewalEmailHtml(items: RenewalItem[], appUrl: string) {
  return `<!doctype html><html lang="es"><body style="margin:0;background:#f4f6fa;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a">
  <div style="max-width:640px;margin:0 auto;padding:24px">
    <div style="background:#0b2244;border-radius:16px 16px 0 0;padding:20px 24px;color:#fff">
      <div style="font-size:20px;font-weight:800;letter-spacing:-0.3px">PGPM <span style="color:#f7941d">MEX</span></div>
      <div style="font-size:12px;opacity:.7;letter-spacing:.12em;text-transform:uppercase">Soluciones digitales</div>
    </div>
    <div style="background:#fff;border:1px solid #e3e9f4;border-top:0;border-radius:0 0 16px 16px;padding:24px">
      <h1 style="margin:0 0 6px;font-size:18px;color:#0b2244">Renovaciones próximas</h1>
      <p style="margin:0 0 16px;color:#64748b;font-size:14px">${items.length} suscripci${items.length === 1 ? "ón requiere" : "ones requieren"} tu atención.</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <thead><tr style="text-align:left;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.06em">
          <th style="padding:8px 12px">Cliente</th><th style="padding:8px 12px">Programas</th><th style="padding:8px 12px">Renueva</th><th style="padding:8px 12px;text-align:right">Precio</th>
        </tr></thead>
        <tbody>${items.map(row).join("")}</tbody>
      </table>
      <p style="margin:20px 0 0"><a href="${escapeHtml(appUrl)}/suscripciones" style="display:inline-block;background:#f7941d;color:#fff;text-decoration:none;font-weight:600;padding:10px 16px;border-radius:10px">Abrir suscripciones</a></p>
    </div>
    <p style="text-align:center;color:#94a3b8;font-size:11px;margin:16px 0 0">Aviso automático diario · PGPM MEX Admin</p>
  </div></body></html>`;
}

/** Envío genérico con Resend. Devuelve el error de Resend como texto para mostrarlo en pantalla. */
export async function sendEmail(to: string, subject: string, html: string, text?: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.FROM_EMAIL ?? "PGPM MEX <onboarding@resend.dev>";
  if (!apiKey) return { ok: false, error: "Falta RESEND_API_KEY en las variables de entorno." };
  const resend = new Resend(apiKey);
  // Las respuestas del cliente van a tu correo real, aunque el remitente sea el de avisos.
  const replyTo = process.env.REPLY_TO ?? process.env.NOTIFY_EMAIL;
  const { error } = await resend.emails.send({ from, to, subject, html, text, ...(replyTo ? { replyTo } : {}) });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function sendRenewalEmail(items: RenewalItem[], appUrl: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.NOTIFY_EMAIL;
  const from = process.env.FROM_EMAIL ?? "PGPM MEX <onboarding@resend.dev>";
  if (!apiKey || !to) throw new Error("Faltan RESEND_API_KEY o NOTIFY_EMAIL.");
  const resend = new Resend(apiKey);
  const urgent = items.filter((i) => i.days <= 7).length;
  const subject = urgent
    ? `⚠️ ${urgent} renovaci${urgent === 1 ? "ón" : "ones"} en menos de 7 días`
    : `${items.length} renovaci${items.length === 1 ? "ón próxima" : "ones próximas"}`;
  const { error } = await resend.emails.send({ from, to, subject, html: renewalEmailHtml(items, appUrl) });
  if (error) throw new Error(error.message);
}
