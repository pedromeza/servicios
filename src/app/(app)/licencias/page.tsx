import type { Metadata } from "next";
import { LicensesManager } from "@/components/licencias/LicensesManager";
import { clientOptions, listLicenses } from "@/lib/data";
import { paginate } from "@/lib/paging";

export const metadata: Metadata = { title: "Licencias" };

const s = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

export default async function LicenciasPage({ searchParams }: PageProps<"/licencias">) {
  const sp = await searchParams;
  const filters = { q: s(sp.q), status: s(sp.status), kind: s(sp.kind), term: s(sp.term) };
  const [all, clients] = await Promise.all([listLicenses(), clientOptions()]);
  const filtered = Object.values(filters).some(Boolean) ? await listLicenses(filters) : all;
  const { items, paging } = paginate(filtered, s(sp.page) || undefined, s(sp.por) || undefined);
  return (
    <LicensesManager
      licenses={items}
      paging={paging}
      total={all.length}
      available={all.filter((l) => l.status === "available").length}
      clients={clients}
    />
  );
}
