"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PAGE_SIZES, type Page } from "@/lib/paging";

/** Paginador que vive en la URL (?page=N) para convivir con la búsqueda y los filtros. */
export function Pagination({ paging, label = "registros" }: { paging: Page; label?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  if (paging.count === 0) return null;

  const go = (page: number) => {
    const next = new URLSearchParams(params.toString());
    if (page <= 1) next.delete("page");
    else next.set("page", String(page));
    router.replace(`${pathname}${next.toString() ? `?${next}` : ""}`);
  };
  const setSize = (size: string) => {
    const next = new URLSearchParams(params.toString());
    next.set("por", size);
    next.delete("page");
    router.replace(`${pathname}?${next}`);
  };

  // Páginas a mostrar: primera, última y las vecinas de la actual.
  const shown = new Set<number>([1, paging.pages, paging.page - 1, paging.page, paging.page + 1].filter((p) => p >= 1 && p <= paging.pages));
  const list = [...shown].sort((a, b) => a - b);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-navy-100 px-4 py-3 text-sm text-slate-500">
      <div className="flex flex-wrap items-center gap-3">
        <span>
          {paging.from}–{paging.to} de {paging.count} {label}
        </span>
        <label className="flex items-center gap-1.5 text-xs">
          Por página
          <select
            value={paging.size}
            onChange={(ev) => setSize(ev.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-navy-600 focus:outline-none"
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>
      {paging.pages > 1 && (
        <nav className="flex items-center gap-1" aria-label="Paginación">
          <button
            type="button"
            onClick={() => go(paging.page - 1)}
            disabled={paging.page <= 1}
            aria-label="Anterior"
            className="rounded-lg p-1.5 hover:bg-navy-100 disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <ChevronLeft size={16} />
          </button>
          {list.map((p, i) => (
            <span key={p} className="flex items-center">
              {i > 0 && list[i - 1] !== p - 1 && <span className="px-1 text-slate-400">…</span>}
              <button
                type="button"
                onClick={() => go(p)}
                aria-current={p === paging.page ? "page" : undefined}
                className={`min-w-8 rounded-lg px-2 py-1 text-sm ${p === paging.page ? "bg-navy-900 font-semibold text-white" : "hover:bg-navy-100"}`}
              >
                {p}
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={() => go(paging.page + 1)}
            disabled={paging.page >= paging.pages}
            aria-label="Siguiente"
            className="rounded-lg p-1.5 hover:bg-navy-100 disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <ChevronRight size={16} />
          </button>
        </nav>
      )}
    </div>
  );
}
