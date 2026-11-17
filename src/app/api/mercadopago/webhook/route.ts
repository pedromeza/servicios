import { NextResponse, type NextRequest } from "next/server";
import { addMonthsISO, fmtMoney, todayISO } from "@/lib/format";
import { getPayment, mpConfigured, verifyWebhookSignature } from "@/lib/mercadopago";
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
  // Un aviso firmado con firma incorrecta se rechaza. Los avisos sin firma (formato IPN) se aceptan porque
  // el pago se consulta a Mercado Pago más abajo: un aviso falso no puede inventar un pago aprobado.
  if (req.headers.get("x-signature") && !verifyWebhookSignature(req.headers, paymentId)) return NextResponse.json({ ok: false, reason: "firma inválida" }, { status: 401 });

  let payment;
  try {
    payment = await getPayment(paymentId);
  } catch (e) {
    return NextResponse.json({ ok: false, reason: (e as Error).message });
  }
  const linkId = payment.external_reference ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(linkId)) return NextResponse.json({ ok: true, ignored: "sin external_reference de la app" });

  const db = createAdminClient();
  const found = await db.from("payment_links").select("*").eq("id", linkId).maybeSingle();
  if (found.error || !found.data) return NextResponse.json({ ok: true, ignored: "link desconocido" });
  const link = found.data as { id: string; user_id: string; subscription_id: string | null; client_id: string | null; concept: string; amount: number; currency: string; months: number; status: string; mp_payment_id: string | null };

  if (payment.status !== "approved") {
    return NextResponse.json({ ok: true, status: payment.status });
  }
  if (link.status === "paid" || link.mp_payment_id === String(payment.id)) return NextResponse.json({ ok: true, already: true });

  const today = todayISO();
  const paidAt = payment.date_approved ?? new Date().toISOString();
  const amount = Number(payment.transaction_amount ?? link.amount);
  const currency = payment.currency_id ?? link.currency;

  // Marcar el link como pagado primero (mp_payment_id es único: evita registrar dos veces el mismo pago).
  // Solo sigue quien logra marcarlo: si dos avisos llegan a la vez, el segundo no encuentra fila y termina.
  const mark = await db.from("payment_links").update({ status: "paid", mp_payment_id: String(payment.id), paid_at: paidAt }).eq("id", link.id).neq("status", "paid").select("id");
  if (mark.error) return NextResponse.json({ ok: false, reason: mark.error.message });
  if (!mark.data || mark.data.length === 0) return NextResponse.json({ ok: true, already: true });

  let detail = "";
  if (link.subscription_id && link.months > 0) {
    const sub = await db.from("subscriptions").select("id,renews_at,renewals,plan,products,status").eq("id", link.subscription_id).maybeSingle();
    if (sub.data) {
      const s = sub.data as { id: string; renews_at: string | null; renewals: number | null; plan: string | null; products: string[] | null };
      const base = s.renews_at && s.renews_at >= today ? s.renews_at : today;
      const to_date = addMonthsISO(base, link.months);
      await db.from("subscriptions").update({ renews_at: to_date, renewals: Number(s.renewals ?? 0) + 1, status: "active" }).eq("id", s.id);
      const eventRow = { user_id: link.user_id, subscription_id: s.id, renewed_at: today, amount, cost: 0, currency, from_date: s.renews_at, to_date };
      let ev = await db.from("renewal_events").insert({ ...eventRow, plan: s.plan ?? "individual", products: s.products ?? [] });
      if (ev.error && /plan|products|schema cache/i.test(ev.error.message)) ev = await db.from("renewal_events").insert(eventRow);
      detail = `Renovación pagada por Mercado Pago · ${fmtMoney(amount, currency)} · nuevo vencimiento ${to_date}`;
    }
  } else {
    await db.from("sales").insert({ user_id: link.user_id, client_id: link.client_id, concept: link.concept, sold_at: today, price: amount, cost: 0, currency, platform: "Mercado Pago" });
    detail = `Cobro pagado por Mercado Pago · ${link.concept} · ${fmtMoney(amount, currency)}`;
  }
  await db.from("audit_log").insert({ user_id: link.user_id, action: "renew", entity: link.subscription_id ? "subscription" : "sale", entity_id: link.subscription_id, detail: detail.slice(0, 200), actor_email: "Mercado Pago" }).then(() => undefined, () => undefined);
  return NextResponse.json({ ok: true, registered: detail });
}

/** Mercado Pago a veces prueba la URL con GET. */
export async function GET() {
  return NextResponse.json({ ok: true });
}
