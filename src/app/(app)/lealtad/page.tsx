import type { Metadata } from "next";
import { LoyaltyBoard } from "@/components/lealtad/LoyaltyBoard";
import { loyaltyCards } from "@/lib/data";

export const metadata: Metadata = { title: "Lealtad" };

export default async function LealtadPage({ searchParams }: PageProps<"/lealtad">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const [cards, all] = await Promise.all([loyaltyCards(q), q ? loyaltyCards() : null]);
  return <LoyaltyBoard cards={cards} total={(all ?? cards).length} />;
}
