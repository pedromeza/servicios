import type { Metadata } from "next";
import { Logo } from "@/components/Logo";

export const metadata: Metadata = { title: "Pago recibido" };

/** Página pública a la que vuelve el cliente desde Mercado Pago. */
export default async function PagoRecibidoPage({ searchParams }: PageProps<"/pago-recibido">) {
  const sp = await searchParams;
  const status = typeof sp.status === "string" ? sp.status : typeof sp.collection_status === "string" ? sp.collection_status : "";
  const ok = status === "approved";
  const pending = status === "pending" || status === "in_process";
  return (
    <main className="flex min-h-screen items-center justify-center bg-navy-900 p-6 text-white">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center text-navy-900 shadow-xl">
        <div className="mx-auto mb-6 inline-block rounded-xl bg-navy-900 px-4 py-3">
          <Logo />
        </div>
        <h1 className="text-2xl font-bold">{ok ? "¡Gracias por tu pago!" : pending ? "Pago en proceso" : "No se completó el pago"}</h1>
        <p className="mt-3 text-sm text-slate-600">
          {ok
            ? "Ya lo recibimos. Activamos o renovamos tu licencia el mismo día y te avisamos por WhatsApp o correo."
            : pending
              ? "Mercado Pago está confirmando tu pago. En cuanto se acredite activamos o renovamos tu licencia y te avisamos."
              : "Puedes volver a intentarlo con el mismo link o escribirnos por WhatsApp para ayudarte."}
        </p>
        <p className="mt-6 text-xs text-slate-400">PGPM MEX · Soluciones digitales</p>
      </div>
    </main>
  );
}
