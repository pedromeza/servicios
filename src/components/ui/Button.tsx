import { cn } from "@/lib/cn";
import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "navy";
  size?: "sm" | "md" | "icon";
};

const variants = {
  primary: "bg-brand text-white hover:bg-brand-dark shadow-sm",
  navy: "bg-navy-900 text-white hover:bg-navy-800 shadow-sm",
  secondary: "bg-white text-navy-900 border border-navy-200 hover:bg-navy-50",
  ghost: "text-navy-700 hover:bg-navy-100/70",
  danger: "bg-red-600 text-white hover:bg-red-700 shadow-sm",
};
const sizes = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  icon: "h-8 w-8 text-sm",
};

export function Button({ variant = "primary", size = "md", className, type = "button", ...props }: Props) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}
