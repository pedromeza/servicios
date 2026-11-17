import { CheckCircle2, Lock, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { Logo } from "@/components/Logo";
import { fmtMoney } from "@/lib/format";
import { LINK_DAYS } from "@/lib/mercadopago";
import { createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Link = { concept: string; amount: number; currency: string; status: "pending" | "paid" | "cancelled"; url: string | null; expired: boolean };

/** El botón de pago solo puede llevar a Mercado Pago por https: nunca a otro sitio ni a un enlace de script. */
function safePayUrl(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    const host = u.hostname.toLowerCase();
    const allowed = /(^|\.)mercadopago\.com(\.[a-z]{2})?$/.test(host) || /(^|\.)mercadolibre\.com(\.[a-z]{2})?$/.test(host) || /(^|\.)mercadopago\.cl$/.test(host);
    return u.protocol === "https:" && allowed ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Solo lo necesario para mostrar el cobro. El id es un UUID que nadie puede adivinar. */
async function loadLink(id: string): Promise<Link | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null;
  try {
    const db = createAdminClient();
    const { data } = await db.from("payment_links").select("concept,amount,currency,status,url,created_at").eq("id", id).maybeSingle();
    if (!data) return null;
    const expired = data.status === "pending" && new Date(data.created_at).getTime() + LINK_DAYS * 86_400_000 < Date.now();
    return { concept: data.concept, amount: Number(data.amount ?? 0), currency: data.currency ?? "MXN", status: data.status, url: safePayUrl(data.url ?? null), expired };
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: PageProps<"/pagar/[id]">): Promise<Metadata> {
  const { id } = await params;
  const link = await loadLink(id);
  const title = link ? `PGPM MEX · ${link.concept} · ${fmtMoney(link.amount, link.currency)}` : "PGPM MEX · Pago";
  const description = "Pago seguro con Mercado Pago a nombre de PGPM MEX · Soluciones digitales.";
  return { title, description, robots: { index: false, follow: false }, openGraph: { title, description, images: ["/logo-email.png"] } };
}

/**
 * Página pública de cobro: lo que recibe el cliente por WhatsApp. Muestra quién cobra, qué y cuánto,
 * y lleva a Mercado Pago. Así el enlace del mensaje es de la propia app y el cliente ve la marca.
 */
export default async function PagarPage({ params }: PageProps<"/pagar/[id]">) {
  const { id } = await params;
  const link = await loadLink(id);
  return (
    <main className="flex min-h-screen items-center justify-center bg-navy-900 p-5 text-white">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white text-navy-900 shadow-xl">
        <div className="bg-navy-900 px-6 py-5">
          <Logo />
        </div>
        <div className="p-6 text-center">
          {!link ? (
            <>
              <h1 className="text-xl font-bold">Link no disponible</h1>
              <p className="mt-2 text-sm text-slate-600">Este link de pago no existe o ya no está activo. Escríbenos por WhatsApp y te mandamos uno nuevo.</p>
            </>
          ) : link.status === "paid" ? (
            <>
              <CheckCircle2 size={44} className="mx-auto text-emerald-600" />
              <h1 className="mt-3 text-xl font-bold">Este pago ya se recibió</h1>
              <p className="mt-2 text-sm text-slate-600">
                {link.concept} · {fmtMoney(link.amount, link.currency)}. ¡Gracias! Si tienes dudas, escríbenos por WhatsApp.
              </p>
            </>
          ) : link.status === "cancelled" || link.expired || !link.url ? (
            <>
              <h1 className="text-xl font-bold">{link.expired ? "Link vencido" : "Link cancelado"}</h1>
              <p className="mt-2 text-sm text-slate-600">Este link de pago ya no está activo. Escríbenos por WhatsApp y te mandamos uno nuevo.</p>
            </>
          ) : (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pago a PGPM MEX</p>
              <h1 className="mt-2 text-lg font-semibold">{link.concept}</h1>
              <p className="mt-3 text-4xl font-bold tracking-tight">{fmtMoney(link.amount, link.currency)}</p>
              <a
                href={link.url}
                className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand text-base font-semibold text-white shadow-sm transition-colors hover:bg-brand-dark"
              >
                <Lock size={17} /> Pagar con Mercado Pago
              </a>
              <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-slate-500">
                <ShieldCheck size={14} className="text-emerald-600" /> El pago se hace en la página segura de Mercado Pago. Nosotros no vemos los datos de tu tarjeta.
              </p>
            </>
          )}
          <p className="mt-6 text-xs text-slate-400">PGPM MEX · Soluciones digitales</p>
        </div>
      </div>
    </main>
  );
}
