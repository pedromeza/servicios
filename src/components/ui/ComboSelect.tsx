"use client";

import { Check, ChevronDown, Plus, Search, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { normalizeName } from "@/lib/names";
import { controlClass } from "./Fields";

export type ComboOption = { value: string; label: string; hint?: string };

/**
 * Selector con búsqueda. Opcionalmente permite crear una opción nueva escribiéndola.
 * Envía el valor elegido en un <input type="hidden" name=…> para que funcione con formularios de servidor.
 */
export function ComboSelect({
  name,
  value,
  onChange,
  options,
  placeholder = "Buscar…",
  emptyLabel,
  createLabel = "Agregar",
  onCreate,
  disabled,
  required,
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: ComboOption[];
  placeholder?: string;
  /** Si se indica, hay una opción vacía con este texto (p. ej. "Sin asignar"). */
  emptyLabel?: string;
  createLabel?: string;
  /** Crear una opción nueva a partir del texto buscado. Devuelve la opción creada (o null si falló). */
  onCreate?: (label: string) => Promise<ComboOption | null> | ComboOption | null;
  disabled?: boolean;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [highlight, setHighlight] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  // La lista flota con posición fija sobre la página: así no agranda ni desplaza el diálogo que la contiene.
  const [pos, setPos] = useState<{ left: number; width: number; top?: number; bottom?: number; maxList: number } | null>(null);
  const place = () => {
    const el = root.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const below = window.innerHeight - r.bottom - 12;
    const above = r.top - 12;
    const SEARCH = 48; // alto de la fila de búsqueda
    const openUp = below < 220 && above > below;
    const room = Math.max(120, (openUp ? above : below) - SEARCH);
    setPos({
      left: Math.max(8, Math.min(r.left, window.innerWidth - r.width - 8)),
      width: r.width,
      ...(openUp ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }),
      maxList: Math.min(256, room),
    });
  };

  const selected = options.find((o) => o.value === value) ?? null;
  const filtered = useMemo(() => {
    const q = normalizeName(query);
    const list = q ? options.filter((o) => normalizeName(`${o.label} ${o.hint ?? ""}`).includes(q)) : options;
    return list.slice(0, 200);
  }, [options, query]);
  const exact = query.trim() !== "" && options.some((o) => normalizeName(o.label) === normalizeName(query));
  const canCreate = Boolean(onCreate) && query.trim().length > 0 && !exact;
  const rows: Array<{ kind: "empty" } | { kind: "option"; o: ComboOption } | { kind: "create" }> = [
    ...(emptyLabel && !query ? [{ kind: "empty" as const }] : []),
    ...filtered.map((o) => ({ kind: "option" as const, o })),
    ...(canCreate ? [{ kind: "create" as const }] : []),
  ];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    // Si la página o el diálogo se desplazan o cambian de tamaño, la lista sigue al campo.
    const onMove = (e: Event) => {
      if (e.target instanceof Node && root.current?.contains(e.target)) return; // desplazamiento dentro de la propia lista
      place();
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [open]);

  const openList = () => {
    if (disabled) return;
    place();
    setOpen(true);
    setQuery("");
    setHighlight(0);
    setError(null);
    setTimeout(() => input.current?.focus({ preventScroll: true }), 0);
  };
  const choose = (v: string) => {
    onChange(v);
    setOpen(false);
  };
  const create = async () => {
    if (!onCreate || creating) return;
    setCreating(true);
    setError(null);
    try {
      const made = await onCreate(query.trim());
      if (made) choose(made.value);
      else setError("No se pudo crear.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear.");
    } finally {
      setCreating(false);
    }
  };
  const activate = (row: (typeof rows)[number]) => {
    if (row.kind === "empty") choose("");
    else if (row.kind === "option") choose(row.o.value);
    else void create();
  };

  return (
    <div ref={root} className="relative">
      <input type="hidden" name={name} value={value} required={required} />
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openList())}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(controlClass, "flex h-10 items-center justify-between gap-2 text-left")}
      >
        <span className={cn("truncate", !selected && "text-slate-400")}>{selected ? selected.label : emptyLabel ?? placeholder}</span>
        <ChevronDown size={16} className="shrink-0 text-slate-400" />
      </button>

      {open && pos && (
        <div
          className="fixed z-[70] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl"
          style={{ left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom }}
        >
          <div className="flex items-center gap-2 border-b border-slate-100 px-3">
            <Search size={14} className="shrink-0 text-slate-400" />
            <input
              ref={input}
              value={query}
              onChange={(ev) => {
                setQuery(ev.target.value);
                setHighlight(0);
              }}
              onKeyDown={(ev) => {
                if (ev.key === "ArrowDown") {
                  ev.preventDefault();
                  setHighlight((h) => Math.min(rows.length - 1, h + 1));
                } else if (ev.key === "ArrowUp") {
                  ev.preventDefault();
                  setHighlight((h) => Math.max(0, h - 1));
                } else if (ev.key === "Enter") {
                  ev.preventDefault();
                  if (rows[highlight]) activate(rows[highlight]);
                } else if (ev.key === "Escape") {
                  ev.stopPropagation(); // que no cierre también el diálogo que contiene al selector
                  setOpen(false);
                }
              }}
              placeholder={placeholder}
              aria-controls={listId}
              className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} aria-label="Limpiar" className="text-slate-400 hover:text-slate-700">
                <X size={14} />
              </button>
            )}
          </div>
          <ul id={listId} role="listbox" className="overflow-y-auto py-1 text-sm" style={{ maxHeight: pos.maxList }}>
            {rows.length === 0 && <li className="px-3 py-2 text-slate-400">Sin resultados.</li>}
            {rows.map((row, i) => {
              const active = i === highlight;
              if (row.kind === "empty") {
                return (
                  <li key="__empty" role="option" aria-selected={value === ""} onMouseEnter={() => setHighlight(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => choose("")} className={cn("flex cursor-pointer items-center justify-between px-3 py-2 text-slate-500", active && "bg-navy-50")}>
                    {emptyLabel}
                    {value === "" && <Check size={14} className="text-brand" />}
                  </li>
                );
              }
              if (row.kind === "create") {
                return (
                  <li key="__create" role="option" aria-selected={false} onMouseEnter={() => setHighlight(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => void create()} className={cn("flex cursor-pointer items-center gap-2 px-3 py-2 font-medium text-brand-dark", active && "bg-brand-light")}>
                    <Plus size={14} /> {creating ? "Creando…" : `${createLabel} “${query.trim()}”`}
                  </li>
                );
              }
              const o = row.o;
              return (
                <li key={o.value} role="option" aria-selected={o.value === value} onMouseEnter={() => setHighlight(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => choose(o.value)} className={cn("flex cursor-pointer items-center justify-between gap-2 px-3 py-2", active && "bg-navy-50")}>
                  <span className="min-w-0">
                    <span className="block truncate text-slate-800">{o.label}</span>
                    {o.hint && <span className="block truncate text-xs text-slate-400">{o.hint}</span>}
                  </span>
                  {o.value === value && <Check size={14} className="shrink-0 text-brand" />}
                </li>
              );
            })}
          </ul>
          {error && <p className="border-t border-red-100 bg-red-50 px-3 py-1.5 text-xs text-red-700">{error}</p>}
        </div>
      )}
    </div>
  );
}
