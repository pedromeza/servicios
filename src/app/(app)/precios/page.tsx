import type { Metadata } from "next";
import { PricesManager } from "@/components/precios/PricesManager";
import { getReminderSettings, listPrices } from "@/lib/data";

export const metadata: Metadata = { title: "Precios y cotizador" };

export default async function PreciosPage() {
  const [prices, settings] = await Promise.all([listPrices(), getReminderSettings()]);
  return <PricesManager prices={prices} whatsapp={settings.whatsapp} paymentUrl={settings.payment_url} />;
}
