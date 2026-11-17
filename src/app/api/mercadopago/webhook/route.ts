import { NextResponse, type NextRequest } from "next/server";
import { sendEmail } from "@/lib/email";
import { getPayment, mpConfigured, verifyWebhookSignature } from "@/lib/mercadopago";
import { processPayment } from "@/lib/payments";
import { createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Aviso de Mercado Pago cuando cambia un pago. Se consulta el pago a Mercado Pago (nunca se confía
 * solo en el aviso), se busca el link por external_reference y, si está aprobado, se registra la
 * renovación o la venta a nombre del dueño del link. Siempre responde 200 para que MP no reintente
 * sin fin; los problemas quedan en el cuerpo de la respuesta.
 */
export async function POST(req: NextRequest) {
  if (!mpConfigured()) return NextResponse.json({ ok: false, reason: "sin MP_ACCESS_TOKEN" });
  const body = (await req.json().catch(() => ({}))) as { type?: string; action?: string; data?: { id?: string | number } };
  const sp = req.nextUrl.searchParams;
  const topic = body.type ?? sp.get("type") ?? sp.get("topic") ?? "";
  const paymentId = String(body.data?.id ?? sp.get("data.id") ?? sp.get("id") ?? "");
  if (!/payment/i.test(topic) || !paymentId) return NextResponse.json({ ok: true, ignored: topic || "sin tipo" });
  // Un id de pago de Mercado Pago es solo dígitos: cualquier otra cosa se descarta sin consultar nada.
  if (!/^\d{5,20}$/.test(paymentId)) return NextResponse.json({ ok: true, ignored: "id de pago inválido" });
  // Un aviso firmado con firma incorrecta se rechaza. Los avisos sin firma (formato IPN) se aceptan porque
  // el pago se consulta a Mercado Pago más abajo: un aviso falso no puede inventar un pago aprobado.
  if (req.headers.get("x-signature") && !verifyWebhookSignature(req.headers, paymentId)) return NextResponse.json({ ok: false, reason: "firma inválida" }, { status: 401 });

  let payment;
  try {
    payment = await getPayment(paymentId);
  } catch (e) {
    return NextResponse.json({ ok: false, reason: (e as Error).message });
  }
  const outcome = await processPayment(createAdminClient(), payment, notifyOwner);
  return NextResponse.json(outcome);
}

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Correo al dueño cuando un pago se devuelve. */
async function notifyOwner(title: string, notes: string[]) {
  const to = process.env.NOTIFY_EMAIL ?? process.env.GMAIL_USER;
  if (!to) return;
  const chargeback = /^Contracargo/.test(title);
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px;color:#0f172a">
      <h2 style="margin:0 0 12px;color:#b91c1c">${esc(title)}</h2>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.5">Mercado Pago avisó que este pago se devolvió${chargeback ? " porque el cliente desconoció el cargo con su banco" : ""}. Esto es lo que hizo la app:</p>
      <ul style="margin:0 0 14px;padding-left:20px;font-size:15px;line-height:1.6">${notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>
      <p style="margin:0;font-size:15px;line-height:1.5"><strong>Te toca a ti:</strong> retirar el acceso o la licencia al cliente si ya se la habías entregado.</p>
    </div>`;
  await sendEmail(to, `⚠️ ${title}`, html, `${title}\n\n${notes.join("\n")}\n\nRetira el acceso o la licencia al cliente si ya se la habías entregado.`);
}

/** Mercado Pago a veces prueba la URL con GET. También sirve para comprobar a simple vista si el token ya está puesto. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    mercado_pago: mpConfigured() ? "conectado" : "falta MP_ACCESS_TOKEN en Vercel (o falta el redeploy)",
    firma_webhook: process.env.MP_WEBHOOK_SECRET ? "activada" : "sin MP_WEBHOOK_SECRET (opcional)",
  });
}
