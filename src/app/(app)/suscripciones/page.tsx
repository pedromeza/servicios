import type { Metadata } from "next";
import { SubscriptionsManager } from "@/components/suscripciones/SubscriptionsManager";
import { accountOptions, clientOptions, listRenewalEvents, listSubscriptions, renewalMoney } from "@/lib/data";
import { mpConfigured } from "@/lib/mercadopago";
import { paginate } from "@/lib/paging";

export const metadata: Metadata = { title: "Suscripciones" };

const s = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

export default async function SuscripcionesPage({ searchParams }: PageProps<"/suscripciones">) {
  const sp = await searchParams;
  const filters = { q: s(sp.q), status: s(sp.status) };
  const [all, accounts, clients, events] = await Promise.all([listSubscriptions(), accountOptions(), clientOptions(), listRenewalEvents()]);
  const filtered = filters.q || filters.status ? await listSubscriptions(filters) : all;
  const { items, paging } = paginate(filtered, s(sp.page) || undefined, s(sp.por) || undefined);
  const genericCount = all.filter((x) => !x.deleted_at && x.plan === "individual" && x.products.length === 1 && /sin especificar/i.test(x.products[0])).length;
  return (
    <SubscriptionsManager subscriptions={items} paging={paging} total={all.length} money={renewalMoney(all, events)} accounts={accounts} clients={clients} genericCount={genericCount} mpReady={mpConfigured()} />
  );
}
