import type { Tone } from "@/components/ui/Badge";

export function renewalTone(days: number | null): { tone: Tone; label: string } {
  if (days === null) return { tone: "neutral", label: "Sin fecha" };
  if (days < 0) return { tone: "danger", label: `Vencida hace ${Math.abs(days)} d` };
  if (days === 0) return { tone: "danger", label: "Hoy" };
  if (days <= 7) return { tone: "danger", label: `En ${days} d` };
  if (days <= 30) return { tone: "warning", label: `En ${days} d` };
  return { tone: "success", label: `En ${days} d` };
}
