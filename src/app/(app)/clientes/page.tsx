import type { Metadata } from "next";
import { ClientsManager } from "@/components/clientes/ClientsManager";
import { listClients } from "@/lib/data";

export const metadata: Metadata = { title: "Clientes" };

export default async function ClientesPage({ searchParams }: PageProps<"/clientes">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const [clients, all] = await Promise.all([listClients(q), q ? listClients() : null]);
  return <ClientsManager clients={clients} total={(all ?? clients).length} />;
}
