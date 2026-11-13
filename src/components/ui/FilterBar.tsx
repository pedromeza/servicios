"use client";

import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { controlClass } from "./Fields";
import { Select } from "./Fields";
import { cn } from "@/lib/cn";

type FilterDef = { name: string; label: string; options: { value: string; label: string }[] };

export function FilterBar({ placeholder, filters = [] }: { placeholder: string; filters?: FilterDef[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page"); // cualquier cambio de búsqueda o filtro vuelve a la primera página
    router.replace(`${pathname}${next.toString() ? `?${next}` : ""}`);
  };

  useEffect(() => {
    const t = setTimeout(() => {
      if ((params.get("q") ?? "") !== q) update("q", q);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const hasFilters = [...params.keys()].some((k) => k !== "page");

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="relative min-w-[220px] flex-1">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          className={cn(controlClass, "h-10 pl-9")}
          type="search"
        />
      </div>
      {filters.map((f) => (
        <Select
          key={f.name}
          aria-label={f.label}
          value={params.get(f.name) ?? ""}
          onChange={(e) => update(f.name, e.target.value)}
          className="w-auto min-w-[160px]"
        >
          <option value="">{f.label}: todos</option>
          {f.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      ))}
      {hasFilters && (
        <button
          type="button"
          onClick={() => {
            setQ("");
            router.replace(pathname);
          }}
          className="inline-flex h-10 items-center gap-1 rounded-lg px-3 text-sm text-slate-500 hover:bg-navy-100 hover:text-navy-900"
        >
          <X size={14} /> Limpiar
        </button>
      )}
    </div>
  );
}
