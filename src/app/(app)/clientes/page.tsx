import type { Metadata } from "next";
import { ClientsManager } from "@/components/clientes/ClientsManager";
import { listClients } from "@/lib/data";

export const metadata: Metadata = { title: "Clientes" };

export default async function ClientesPage({ searchParams }: PageProps<"/clientes">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  // Siempre se cargan todos: la lista completa de nombres alimenta el aviso de duplicados del formulario.
  const [clients, all] = await Promise.all([q ? listClients(q) : listClients(), q ? listClients() : null]);
  const everyone = all ?? clients;
  return <ClientsManager clients={clients} total={everyone.length} allNames={everyone.map((c) => c.name)} />;
}
