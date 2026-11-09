import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

const tones = {
  neutral: "bg-slate-100 text-slate-700",
  navy: "bg-navy-100 text-navy-800",
  brand: "bg-brand-light text-brand-dark",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-red-50 text-red-700",
};

export type Tone = keyof typeof tones;

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium", tones[tone], className)}>
      {children}
    </span>
  );
}
