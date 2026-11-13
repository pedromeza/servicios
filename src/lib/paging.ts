export const PAGE_SIZE = 25;
export const PAGE_SIZES = [10, 25, 50, 100] as const;

export type Page = { page: number; pages: number; from: number; to: number; count: number; size: number };

/** Tamaño de página pedido en la URL (?por=N), acotado a las opciones permitidas. */
export function pageSizeFrom(param: string | undefined): number {
  const n = Number.parseInt(param ?? "", 10);
  return (PAGE_SIZES as readonly number[]).includes(n) ? n : PAGE_SIZE;
}

/** Devuelve el tramo de `items` para la página pedida (1-based) y los datos para pintar el paginador. */
export function paginate<T>(items: T[], pageParam: string | undefined, sizeParam?: string): { items: T[]; paging: Page } {
  const size = pageSizeFrom(sizeParam);
  const count = items.length;
  const pages = Math.max(1, Math.ceil(count / size));
  const page = Math.min(pages, Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1));
  const start = (page - 1) * size;
  return {
    items: items.slice(start, start + size),
    paging: { page, pages, from: count === 0 ? 0 : start + 1, to: Math.min(count, start + size), count, size },
  };
}
