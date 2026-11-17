import type { SubPlan } from "./types";

/**
 * Texto para mostrar los programas de una suscripción. Una suite completa no enumera los doce
 * programas: dice "Colección completa de Autodesk" (lista larga en el título/tooltip si hace falta).
 */
export function productsText(plan: SubPlan | string, products: string[], provider?: string | null): string {
  if (plan === "suite") return `Colección completa${provider && provider !== "Otro" ? ` de ${provider}` : ""}`;
  return products.join(", ");
}
