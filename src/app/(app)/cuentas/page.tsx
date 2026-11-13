import type { Metadata } from "next";
import { AccountsManager } from "@/components/cuentas/AccountsManager";
import { clientOptions, listAccounts } from "@/lib/data";
import { paginate } from "@/lib/paging";

export const metadata: Metadata = { title: "Cuentas" };

const s = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

export default async function CuentasPage({ searchParams }: PageProps<"/cuentas">) {
  const sp = await searchParams;
  const filters = { q: s(sp.q), provider: s(sp.provider), role: s(sp.role) };
  const [all, clients] = await Promise.all([listAccounts(), clientOptions()]);
  const accounts = await listAccounts(filters);
  const admins = all.filter((a) => a.role === "admin").map((a) => ({ value: a.id, label: `${a.label} · ${a.username}` }));
  const { items, paging } = paginate(accounts, s(sp.page) || undefined);
  return <AccountsManager accounts={items} paging={paging} total={all.length} admins={admins} clients={clients} />;
}
