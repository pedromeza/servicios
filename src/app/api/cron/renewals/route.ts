/* eslint-disable @typescript-eslint/no-explicit-any */
import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { decrypt, encrypt } from "@/lib/crypto";
import { sendEmail, sendRenewalEmail, type RenewalItem } from "@/lib/email";
import { splitEmails } from "@/lib/emails";
import { addDaysISO, daysUntil, fmtDate, fmtMoney, todayISO } from "@/lib/format";
import { productsText } from "@/lib/products";
import { daysPhrase, DEFAULT_REMINDER, fillTemplate, parseAutoDays, reminderHtml, whatsappLink, whatsappNumber, type ReminderSettings, type ReminderVars } from "@/lib/reminders";
import { createAdminClient } from "@/lib/supabase/server";
import { createPreference, monthsOf, mpConfigured } from "@/lib/mercadopago";
import { termLabel } from "@/lib/terms";

/** Link de pago para la suscripción (reutiliza uno pendiente igual de los últimos 30 días). */
async function paymentLinkFor(
  db: ReturnType<typeof createAdminClient>,
  userId: string,
  s: { id: string; client_id?: string | null; price: number; currency: string | null; purchased_at: string | null; renews_at: string | null; plan: string | null; products: string[] | null },
  concept: string,
  appUrl: string,
): Promise<string | null> {
  if (!mpConfigured() || !(Number(s.price) > 0)) return null;
  const amount = Number(s.price);
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const prev = await db
    .from("payment_links")
    .select("url")
    .eq("subscription_id", s.id)
    .eq("status", "pending")
    .eq("amount", amount)
    .gte("created_at", since)
    .not("url", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (prev.data?.url) return prev.data.url as string;
  const months = monthsOf(s.purchased_at, s.renews_at);
  const ins = await db
    .from("payment_links")
    .insert({ user_id: userId, subscription_id: s.id, client_id: s.client_id ?? null, concept: `${concept} · ${termLabel(months)}`, amount, currency: s.currency ?? "MXN", months })
    .select("id")
    .single();
  if (ins.error) return null;
  const linkId = (ins.data as { id: string }).id;
  try {
    const pref = await createPreference({ title: `${concept} · ${termLabel(months)}`, amount, currency: s.currency ?? "MXN", external_reference: linkId, notification_url: `${appUrl}/api/mercadopago/webhook`, back_url: `${appUrl}/pago-recibido` });
    await db.from("payment_links").update({ mp_preference_id: pref.id, url: pref.init_point }).eq("id", linkId);
    return pref.init_point;
  } catch {
    await db.from("payment_links").update({ status: "cancelled" }).eq("id", linkId);
    return null;
  }
}

export const dynamic = "force-dynamic";

/** Días antes de la renovación en los que se manda el resumen al dueño (y siempre que esté vencida o sea hoy). */
const NOTIFY_AT_DAYS = new Set([30, 15, 7, 3, 1, 0]);
/** No se repite un recordatorio automático a la misma suscripción dentro de esta ventana. */
const REPEAT_GUARD_DAYS = 6;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (header.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}

function appUrlFrom(req: NextRequest) {
  return process.env.APP_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : req.nextUrl.origin);
}

/** Recordatorios automáticos a clientes, por cada usuario que los tenga activados. */
async function sendAutomaticReminders(supabase: ReturnType<typeof createAdminClient>, appUrl: string) {
  const { data: settingsRows, error } = await supabase.from("settings").select("*").eq("auto_remind", true);
  if (error) return { error: error.message, sent: 0, skipped: 0 };
  let sent = 0;
  let skipped = 0;
  const failures: string[] = [];
  for (const row of (settingsRows ?? []) as any[]) {
    const settings: ReminderSettings = {
      ...DEFAULT_REMINDER,
      reminder_subject: row.reminder_subject || DEFAULT_REMINDER.reminder_subject,
      reminder_body: row.reminder_body || DEFAULT_REMINDER.reminder_body,
      reminder_button: row.reminder_button || DEFAULT_REMINDER.reminder_button,
      payment_url: row.payment_url || "",
      whatsapp: row.whatsapp || "",
      logo_url: row.logo_url || `${appUrl}/logo-email.png`,
      reminder_days: Number(row.reminder_days ?? 30),
      auto_remind: true,
      auto_days: row.auto_days || DEFAULT_REMINDER.auto_days,
      whatsapp_body: row.whatsapp_body || DEFAULT_REMINDER.whatsapp_body,
    };
    const days = new Set(parseAutoDays(settings.auto_days));
    if (days.size === 0) continue;
    const maxDays = Math.max(...days);

    const [subs, recent] = await Promise.all([
      supabase
        .from("subscriptions")
        .select("id,client_id,plan,products,purchased_at,renews_at,price,currency,email_enc,client:clients(name,contact_enc,platform),account:accounts(provider)")
        .eq("user_id", row.user_id)
        .eq("status", "active")
        .is("deleted_at", null)
        .not("renews_at", "is", null)
        .lte("renews_at", addDaysISO(todayISO(), maxDays)),
      supabase
        .from("reminders")
        .select("subscription_id")
        .eq("user_id", row.user_id)
        .in("kind", ["client", "auto"])
        .gte("sent_at", new Date(Date.now() - REPEAT_GUARD_DAYS * 86_400_000).toISOString()),
    ]);
    if (subs.error) {
      failures.push(subs.error.message);
      continue;
    }
    const recentlySent = new Set(((recent.data ?? []) as any[]).map((r) => r.subscription_id));

    for (const s of (subs.data ?? []) as any[]) {
      const d = daysUntil(s.renews_at);
      if (d === null || !days.has(d)) continue;
      if (recentlySent.has(s.id)) {
        skipped += 1;
        continue;
      }
      const contact = decrypt(s.client?.contact_enc);
      const emails = splitEmails(decrypt(s.email_enc));
      const to = emails.length > 0 ? emails : contact?.match(EMAIL_RE)?.[0] ? [contact.match(EMAIL_RE)![0]] : [];
      if (to.length === 0) {
        skipped += 1;
        continue;
      }
      const products: string[] = s.products ?? [];
      const vars: ReminderVars = {
        cliente: s.client?.name ?? "cliente",
        programas: productsText(s.plan ?? "individual", products, (Array.isArray(s.account) ? s.account[0] : s.account)?.provider) || "tu programa",
        fecha_compra: fmtDate(s.purchased_at),
        fecha_renovacion: fmtDate(s.renews_at),
        dias: daysPhrase(d),
        precio: fmtMoney(Number(s.price), s.currency),
        plataforma: s.client?.platform ?? "nuestra tienda",
        whatsapp: settings.whatsapp || "nuestro WhatsApp",
      };
      const payUrl = await paymentLinkFor(supabase, row.user_id, s, `Renovación ${vars.programas}`, appUrl);
      const perSub = payUrl ? { ...settings, payment_url: payUrl, reminder_button: settings.reminder_button.replace(/mercado libre/i, "Mercado Pago") } : settings;
      const mail = reminderHtml(perSub, vars);
      const res = await sendEmail(to, mail.subject, mail.html, mail.text);
      if (res.ok) {
        sent += 1;
        await supabase.from("reminders").insert({ user_id: row.user_id, subscription_id: s.id, to_email_enc: encrypt(to.join(", ")), kind: "auto" });
      } else {
        failures.push(`${vars.cliente}: ${res.error}`);
      }
    }
  }
  return { sent, skipped, failures };
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const supabase = createAdminClient();
  const today = todayISO();
  const appUrl = appUrlFrom(req);

  // 1) Recordatorios automáticos a clientes (si están activados).
  let auto: Awaited<ReturnType<typeof sendAutomaticReminders>> | { error: string } = { sent: 0, skipped: 0, failures: [] };
  try {
    auto = await sendAutomaticReminders(supabase, appUrl);
  } catch (e) {
    auto = { error: (e as Error).message };
  }

  // 2) Resumen diario al dueño.
  const { data: ownerSettings } = await supabase.from("settings").select("whatsapp,whatsapp_body").limit(1).maybeSingle();
  const waBody = (ownerSettings as any)?.whatsapp_body || DEFAULT_REMINDER.whatsapp_body;
  const waOwn = (ownerSettings as any)?.whatsapp || "nuestro WhatsApp";
  const { data, error } = await supabase
    .from("subscriptions")
    .select("renews_at, purchased_at, products, price, currency, account:accounts(label,provider), client:clients(name,contact_enc,platform)")
    .eq("status", "active")
    .is("deleted_at", null)
    .not("renews_at", "is", null)
    .lte("renews_at", addDaysISO(today, 30));
  if (error) return NextResponse.json({ error: error.message, auto }, { status: 500 });

  const items: RenewalItem[] = (data as any[])
    .map((r) => ({
      client: r.client?.name ?? "Sin cliente",
      account: r.account?.label ?? "—",
      provider: r.account?.provider ?? "",
      products: (r.products ?? []).join(", "),
      renews_at: r.renews_at,
      days: daysUntil(r.renews_at) ?? 0,
      price: Number(r.price),
      currency: r.currency,
      whatsapp_url: (() => {
        const phone = whatsappNumber(decrypt(r.client?.contact_enc));
        if (!phone) return null;
        const vars: ReminderVars = {
          cliente: r.client?.name ?? "cliente",
          programas: (r.products ?? []).join(", ") || "tu programa",
          fecha_compra: fmtDate(r.purchased_at),
          fecha_renovacion: fmtDate(r.renews_at),
          dias: daysPhrase(daysUntil(r.renews_at) ?? 0),
          precio: fmtMoney(Number(r.price), r.currency),
          plataforma: r.client?.platform ?? "nuestra tienda",
          whatsapp: waOwn,
        };
        return whatsappLink(phone, fillTemplate(waBody, vars));
      })(),
    }))
    .filter((i) => i.days < 0 || NOTIFY_AT_DAYS.has(i.days))
    .sort((a, b) => a.days - b.days);

  if (items.length === 0) return NextResponse.json({ sent: false, reason: "Nada que avisar hoy", checked: data.length, auto });

  try {
    await sendRenewalEmail(items, appUrl);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message, auto }, { status: 500 });
  }
  return NextResponse.json({ sent: true, count: items.length, auto });
}
