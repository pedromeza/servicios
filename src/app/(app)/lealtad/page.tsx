import type { Metadata } from "next";
import { LoyaltyBoard } from "@/components/lealtad/LoyaltyBoard";
import { loyaltyCards } from "@/lib/data";
import { paginate } from "@/lib/paging";

export const metadata: Metadata = { title: "Lealtad" };

export default async function LealtadPage({ searchParams }: PageProps<"/lealtad">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const [cards, all] = await Promise.all([loyaltyCards(q), q ? loyaltyCards() : null]);
  const { items, paging } = paginate(cards, typeof sp.page === "string" ? sp.page : undefined);
  return <LoyaltyBoard cards={items} paging={paging} total={(all ?? cards).length} />;
}
