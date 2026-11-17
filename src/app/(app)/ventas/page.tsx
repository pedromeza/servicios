import type { Metadata } from "next";
import { SalesManager } from "@/components/ventas/SalesManager";
import { clientOptions, ledgerByMonth, listPaymentLinks, listSales, pendingMigrations, salesLedger } from "@/lib/data";
import { mpConfigured } from "@/lib/mercadopago";
import { filterLedger } from "@/lib/ledger";
import { todayISO } from "@/lib/format";
import { paginate } from "@/lib/paging";

export const metadata: Metadata = { title: "Ventas" };

const s = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

export default async function VentasPage({ searchParams }: PageProps<"/ventas">) {
  const sp = await searchParams;
  const filters = { q: s(sp.q), tipo: s(sp.tipo), mes: s(sp.mes), plataforma: s(sp.plataforma) };
  const [ledger, sales, trash, clients, pending, links] = await Promise.all([salesLedger(), listSales(), listSales({ trash: true }), clientOptions(), pendingMigrations(), listPaymentLinks(30)]);
  const months = ledgerByMonth(ledger);
  const filtered = filterLedger(ledger, filters);
  const { items, paging } = paginate(filtered, s(sp.page) || undefined, s(sp.por) || undefined);
  const thisMonth = todayISO().slice(0, 7);
  const yearRows = ledger.filter((r) => r.date.startsWith(thisMonth.slice(0, 4)));
  const totals = {
    count: filtered.length,
    price: filtered.reduce((n, r) => n + r.price, 0),
    cost: filtered.reduce((n, r) => n + r.cost, 0),
    month: months.find((m) => m.month === thisMonth) ?? null,
    year: { count: yearRows.length, price: yearRows.reduce((n, r) => n + r.price, 0), cost: yearRows.reduce((n, r) => n + r.cost, 0) },
  };
  const origin = process.env.APP_URL?.replace(/\/$/, "") ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "");
  const platforms = Array.from(new Set(ledger.map((r) => r.platform).filter((p): p is string => Boolean(p)))).sort();
  return (
    <SalesManager
      rows={items}
      paging={paging}
      months={months}
      totals={totals}
      sales={sales}
      trash={trash}
      clients={clients}
      platforms={platforms}
      migrationPending={pending.includes("0018_sales.sql")}
      links={links}
      origin={origin}
      mpReady={mpConfigured()}
    />
  );
}
