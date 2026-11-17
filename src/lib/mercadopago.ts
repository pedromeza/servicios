import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { addMonthsISO, todayISO } from "./format";

/** Mercado Pago queda conectado con el access token de producción en MP_ACCESS_TOKEN. */
export function mpConfigured(): boolean {
  return Boolean(process.env.MP_ACCESS_TOKEN);
}

const API = "https://api.mercadopago.com";

async function mp<T>(path: string, init: RequestInit & { idempotency?: string } = {}): Promise<T> {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) throw new Error("Mercado Pago no está conectado: falta MP_ACCESS_TOKEN.");
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.idempotency ? { "X-Idempotency-Key": init.idempotency } : {}),
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg = (body.message as string) || (body.error as string) || `HTTP ${res.status}`;
    throw new Error(`Mercado Pago: ${msg}`);
  }
  return body as T;
}

export type MpPreference = { id: string; init_point: string; sandbox_init_point?: string };

/** Crea una preferencia de Checkout Pro y devuelve el link de pago (init_point). */
export async function createPreference(input: {
  title: string;
  amount: number;
  currency: string;
  external_reference: string;
  notification_url: string;
  back_url?: string;
  payer_email?: string | null;
}): Promise<MpPreference> {
  return mp<MpPreference>("/checkout/preferences", {
    method: "POST",
    idempotency: randomUUID(),
    body: JSON.stringify({
      items: [{ id: input.external_reference, title: input.title.slice(0, 250), quantity: 1, unit_price: Math.round(input.amount * 100) / 100, currency_id: input.currency }],
      external_reference: input.external_reference,
      notification_url: input.notification_url,
      statement_descriptor: "PGPM MEX",
      ...(input.payer_email ? { payer: { email: input.payer_email } } : {}),
      ...(input.back_url ? { back_urls: { success: input.back_url, pending: input.back_url, failure: input.back_url }, auto_return: "approved" } : {}),
    }),
  });
}

export type MpPayment = {
  id: number;
  status: string; // approved, pending, rejected, cancelled, refunded…
  status_detail?: string;
  external_reference?: string;
  transaction_amount?: number;
  currency_id?: string;
  date_approved?: string | null;
  payer?: { email?: string };
};

export async function getPayment(id: string | number): Promise<MpPayment> {
  return mp<MpPayment>(`/v1/payments/${id}`);
}

/**
 * Valida la firma del webhook (x-signature) con MP_WEBHOOK_SECRET. Sin secreto configurado no se
 * valida: de todos modos el pago se consulta a Mercado Pago antes de registrar nada.
 */
export function verifyWebhookSignature(headers: Headers, dataId: string): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) return true;
  const sig = headers.get("x-signature") ?? "";
  const requestId = headers.get("x-request-id") ?? "";
  const parts = Object.fromEntries(sig.split(",").map((p) => p.trim().split("=", 2) as [string, string]));
  if (!parts.ts || !parts.v1) return false;
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${parts.ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(parts.v1);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Meses entre compra y renovación (1 año si no se puede deducir). */
export function monthsOf(purchased_at: string | null, renews_at: string | null): number {
  if (!purchased_at || !renews_at) return 12;
  for (let m = 1; m <= 120; m++) if (addMonthsISO(purchased_at, m) === renews_at) return m;
  return 12;
}

/** Nuevo vencimiento al pagar hoy: desde el vencimiento vigente si no ha pasado, o desde hoy. */
export function nextRenewal(renews_at: string | null, months: number): { from_date: string | null; to_date: string } {
  const today = todayISO();
  const base = renews_at && renews_at >= today ? renews_at : today;
  return { from_date: renews_at, to_date: addMonthsISO(base, months) };
}
