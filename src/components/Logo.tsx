import { cn } from "@/lib/cn";

/** Isotipo: nube con "P" y tres conectores naranja, tomado del logotipo PGPM MEX. */
export function LogoMark({ className, size = 48 }: { className?: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M30 76 H86 A17 17 0 0 0 88 42 A26 26 0 0 0 40 36 A20 20 0 0 0 30 76 Z" />
      <text
        x="59"
        y="66"
        textAnchor="middle"
        fontSize="36"
        fontWeight="700"
        fill="currentColor"
        stroke="none"
        fontFamily="inherit"
      >
        P
      </text>
      <path d="M46 76 V88 M59 76 V96 M72 76 V88" />
      <g fill="#f7941d" stroke="none">
        <circle cx="46" cy="94" r="5.5" />
        <circle cx="59" cy="102" r="5.5" />
        <circle cx="72" cy="94" r="5.5" />
      </g>
    </svg>
  );
}

export function Logo({
  className,
  variant = "light",
  compact = false,
}: {
  className?: string;
  variant?: "light" | "dark";
  compact?: boolean;
}) {
  const text = variant === "light" ? "text-white" : "text-navy-900";
  return (
    <div className={cn("flex items-center gap-3", text, className)}>
      <LogoMark size={compact ? 36 : 44} />
      <div className="leading-none">
        <div className={cn("font-extrabold tracking-tight", compact ? "text-lg" : "text-2xl")}>
          PGPM <span className="text-brand">MEX</span>
        </div>
        {!compact && <div className="mt-1 text-[11px] font-medium uppercase tracking-[0.18em] opacity-70">Soluciones digitales</div>}
      </div>
    </div>
  );
}
