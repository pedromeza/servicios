import type { Metadata } from "next";
import { SubscriptionsManager } from "@/components/suscripciones/SubscriptionsManager";
import { accountOptions, clientOptions, listSubscriptions } from "@/lib/data";
import { paginate } from "@/lib/paging";

export const metadata: Metadata = { title: "Suscripciones" };

const s = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

export default async function SuscripcionesPage({ searchParams }: PageProps<"/suscripciones">) {
  const sp = await searchParams;
  const filters = { q: s(sp.q), status: s(sp.status) };
  const [all, accounts, clients] = await Promise.all([listSubscriptions(), accountOptions(), clientOptions()]);
  const filtered = filters.q || filters.status ? await listSubscriptions(filters) : all;
  const { items, paging } = paginate(filtered, s(sp.page) || undefined, s(sp.por) || undefined);
  return <SubscriptionsManager subscriptions={items} paging={paging} total={all.length} accounts={accounts} clients={clients} />;
}
