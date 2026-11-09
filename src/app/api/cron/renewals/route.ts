/* eslint-disable @typescript-eslint/no-explicit-any */
import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { sendRenewalEmail, type RenewalItem } from "@/lib/email";
import { addDaysISO, daysUntil, todayISO } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Días antes de la renovación en los que se manda aviso (y siempre que esté vencida o sea hoy). */
const NOTIFY_AT_DAYS = new Set([30, 15, 7, 3, 1, 0]);

function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (header.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const supabase = createAdminClient();
  const today = todayISO();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("renews_at, products, price, currency, account:accounts(label,provider), client:clients(name)")
    .eq("status", "active")
    .not("renews_at", "is", null)
    .lte("renews_at", addDaysISO(today, 30));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

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
    }))
    .filter((i) => i.days < 0 || NOTIFY_AT_DAYS.has(i.days))
    .sort((a, b) => a.days - b.days);

  if (items.length === 0) return NextResponse.json({ sent: false, reason: "Nada que avisar hoy", checked: data.length });

  const appUrl = process.env.APP_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : req.nextUrl.origin);
  try {
    await sendRenewalEmail(items, appUrl);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
  return NextResponse.json({ sent: true, count: items.length });
}
