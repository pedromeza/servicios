import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addMonthsISO, fmtDate, fmtMoney, todayISO } from "./format";
import type { MpPayment } from "./mercadopago";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;
/** Aviso al dueño (correo) cuando un pago se devuelve: título y lo que hizo la app. */
export type Notify = (title: string, notes: string[]) => Promise<unknown>;
export type PaymentOutcome = Record<string, unknown>;

/**
 * Procesa un pago ya consultado a Mercado Pago: busca el link por external_reference y, según el estado,
 * registra la renovación o la venta (aprobado) o deshace lo registrado (reembolso o contracargo).
 * `db` es el cliente con rol de servicio: todo se escribe a nombre del dueño del link.
 */
export async function processPayment(db: Db, payment: MpPayment, notify: Notify): Promise<PaymentOutcome> {
  const linkId = payment.external_reference ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(linkId)) return { ok: true, ignored: "sin external_reference de la app" };

  const found = await db.from("payment_links").select("*").eq("id", linkId).maybeSingle();
  if (found.error || !found.data) return { ok: true, ignored: "link desconocido" };
  const link = found.data as LinkRow;

  // Reembolso total o contracargo de un pago que ya se había registrado: se deshace y se avisa al dueño.
  if (payment.status === "refunded" || payment.status === "charged_back") {
    if (link.status === "refunded") return { ok: true, already: true };
    if (link.status !== "paid" || link.mp_payment_id !== String(payment.id)) return { ok: true, status: payment.status, ignored: "el pago no estaba registrado" };
    const outcome = await undoPayment(db, link, payment.status === "charged_back" ? "contracargo" : "reembolso", notify);
    return { ok: true, refunded: outcome };
  }
  if (payment.status !== "approved") {
    return { ok: true, status: payment.status };
  }
  if (link.status === "paid" || link.mp_payment_id === String(payment.id)) return { ok: true, already: true };

  const today = todayISO();
  const paidAt = payment.date_approved ?? new Date().toISOString();
  const amount = Number(payment.transaction_amount ?? link.amount);
  const currency = payment.currency_id ?? link.currency;
  // El pago debe cubrir lo que pedía el link, en la misma moneda. Si no, no se registra nada y queda anotado para revisarlo.
  if (amount + 0.01 < Number(link.amount) || currency !== link.currency) {
    await db
      .from("audit_log")
      .insert({ user_id: link.user_id, action: "update", entity: "payment_link", entity_id: link.id, detail: `Pago ${payment.id} NO registrado: llegó ${fmtMoney(amount, currency)} y el link pedía ${fmtMoney(Number(link.amount), link.currency)}`.slice(0, 200), actor_email: "Mercado Pago" })
      .then(() => undefined, () => undefined);
    return { ok: false, reason: "el monto o la moneda no coinciden con el link" };
  }

  // Marcar el link como pagado primero (mp_payment_id es único: evita registrar dos veces el mismo pago).
  // Solo sigue quien logra marcarlo: si dos avisos llegan a la vez, el segundo no encuentra fila y termina.
  const mark = await db.from("payment_links").update({ status: "paid", mp_payment_id: String(payment.id), paid_at: paidAt }).eq("id", link.id).neq("status", "paid").select("id");
  if (mark.error) return { ok: false, reason: mark.error.message };
  if (!mark.data || mark.data.length === 0) return { ok: true, already: true };

  let detail = "";
  if (link.subscription_id && link.months > 0) {
    const sub = await db.from("subscriptions").select("id,renews_at,renewals,plan,products,status").eq("id", link.subscription_id).maybeSingle();
    if (sub.data) {
      const s = sub.data as { id: string; renews_at: string | null; renewals: number | null; plan: string | null; products: string[] | null };
      const base = s.renews_at && s.renews_at >= today ? s.renews_at : today;
      const to_date = addMonthsISO(base, link.months);
      // Si el link se generó con otro alcance (p. ej. solo AutoCAD), la suscripción queda con ese alcance.
      const scoped = (link.plan === "suite" || link.plan === "individual") && Array.isArray(link.products) && link.products.length > 0;
      const plan = scoped ? link.plan! : (s.plan ?? "individual");
      const products = scoped ? link.products! : (s.products ?? []);
      await db
        .from("subscriptions")
        .update({ renews_at: to_date, renewals: Number(s.renewals ?? 0) + 1, status: "active", ...(scoped ? { plan, products } : {}) })
        .eq("id", s.id);
      const eventRow = { user_id: link.user_id, subscription_id: s.id, renewed_at: today, amount, cost: 0, currency, from_date: s.renews_at, to_date };
      let ev = await db.from("renewal_events").insert({ ...eventRow, plan, products }).select("id").maybeSingle();
      if (ev.error && /plan|products|schema cache/i.test(ev.error.message)) ev = await db.from("renewal_events").insert(eventRow).select("id").maybeSingle();
      // Se guarda qué hizo este pago, para poder deshacerlo si después hay reembolso (migración 0021; si falta, se ignora).
      await db
        .from("payment_links")
        .update({ renewal_event_id: (ev.data as { id: string } | null)?.id ?? null, prev_renews_at: s.renews_at, new_renews_at: to_date, prev_plan: s.plan ?? "individual", prev_products: s.products ?? [] })
        .eq("id", link.id)
        .then(() => undefined, () => undefined);
      detail = `Renovación pagada por Mercado Pago · ${fmtMoney(amount, currency)} · nuevo vencimiento ${to_date}`;
    }
  } else {
    const sale = await db
      .from("sales")
      .insert({ user_id: link.user_id, client_id: link.client_id, concept: link.concept, sold_at: today, price: amount, cost: 0, currency, platform: "Mercado Pago" })
      .select("id")
      .maybeSingle();
    await db
      .from("payment_links")
      .update({ sale_id: (sale.data as { id: string } | null)?.id ?? null })
      .eq("id", link.id)
      .then(() => undefined, () => undefined);
    detail = `Cobro pagado por Mercado Pago · ${link.concept} · ${fmtMoney(amount, currency)}`;
  }
  await db.from("audit_log").insert({ user_id: link.user_id, action: "renew", entity: link.subscription_id ? "subscription" : "sale", entity_id: link.subscription_id, detail: detail.slice(0, 200), actor_email: "Mercado Pago" }).then(() => undefined, () => undefined);
  return { ok: true, registered: detail };
}


type LinkRow = {
  id: string;
  user_id: string;
  subscription_id: string | null;
  client_id: string | null;
  concept: string;
  amount: number;
  currency: string;
  months: number;
  status: string;
  mp_payment_id: string | null;
  plan?: string | null;
  products?: string[] | null;
  renewal_event_id?: string | null;
  sale_id?: string | null;
  prev_renews_at?: string | null;
  new_renews_at?: string | null;
  prev_plan?: string | null;
  prev_products?: string[] | null;
};

/**
 * Deshace lo que registró un pago que después se devolvió: quita la renovación (y regresa la fecha y el
 * alcance anteriores si nadie tocó la suscripción desde entonces) o manda la venta a la papelera. Anota el
 * hecho en el historial y avisa por correo al dueño, que debe retirar el acceso al cliente.
 */
export async function undoPayment(db: Db, link: LinkRow, kind: "reembolso" | "contracargo", notify: Notify): Promise<string> {
  const today = todayISO();
  // Solo sigue quien logra marcarlo (dos avisos a la vez). Si la migración 0021 falta, el estado no cambia pero se avisa igual.
  const mark = await db.from("payment_links").update({ status: "refunded", refunded_at: new Date().toISOString() }).eq("id", link.id).eq("status", "paid").select("id");
  if (!mark.error && (!mark.data || mark.data.length === 0)) return "ya procesado";

  const notes: string[] = [];
  if (link.subscription_id) {
    if (link.renewal_event_id) {
      await db.from("renewal_events").delete().eq("id", link.renewal_event_id);
      notes.push("Se quitó el cobro de renovación de Ventas.");
    } else {
      notes.push("No se pudo ubicar el cobro de renovación: revísalo en Ventas.");
    }
    const sub = await db.from("subscriptions").select("id,renews_at,renewals").eq("id", link.subscription_id).maybeSingle();
    const s = sub.data as { id: string; renews_at: string | null; renewals: number | null } | null;
    if (s && link.new_renews_at && s.renews_at === link.new_renews_at) {
      const back = link.prev_renews_at ?? null;
      await db
        .from("subscriptions")
        .update({
          renews_at: back,
          renewals: Math.max(0, Number(s.renewals ?? 0) - 1),
          status: back && back < today ? "expired" : "active",
          ...(link.prev_plan && link.prev_products?.length ? { plan: link.prev_plan, products: link.prev_products } : {}),
        })
        .eq("id", s.id);
      notes.push(`La suscripción volvió a su vencimiento anterior${back ? ` (${fmtDate(back)})` : ""}.`);
    } else if (s) {
      notes.push("La suscripción cambió después del pago, así que no se tocó su fecha: revísala a mano.");
    }
  } else if (link.sale_id) {
    await db.from("sales").update({ deleted_at: new Date().toISOString() }).eq("id", link.sale_id);
    notes.push("La venta se mandó a la papelera de Ventas.");
  } else {
    notes.push("No se pudo ubicar la venta registrada: revísala en Ventas.");
  }
  if (mark.error) notes.push("Falta aplicar la migración 0021: el link sigue marcado como pagado.");

  const title = `${kind === "contracargo" ? "Contracargo" : "Reembolso"} de ${fmtMoney(Number(link.amount), link.currency)} · ${link.concept}`;
  await db
    .from("audit_log")
    .insert({ user_id: link.user_id, action: "update", entity: "payment_link", entity_id: link.id, detail: `${title}. ${notes.join(" ")}`.slice(0, 200), actor_email: "Mercado Pago" })
    .then(() => undefined, () => undefined);

  await notify(title, notes).then(() => undefined, () => undefined);
  return notes.join(" ");
}

