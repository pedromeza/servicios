import type { Metadata } from "next";
import { ImportManager } from "@/components/importar/ImportManager";

export const metadata: Metadata = { title: "Importar ventas" };

export default function ImportarPage() {
  return <ImportManager />;
}
