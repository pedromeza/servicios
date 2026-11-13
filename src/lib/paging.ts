export const PAGE_SIZE = 50;

export type Page = { page: number; pages: number; from: number; to: number; count: number };

/** Devuelve el tramo de `items` para la página pedida (1-based) y los datos para pintar el paginador. */
export function paginate<T>(items: T[], pageParam: string | undefined, size = PAGE_SIZE): { items: T[]; paging: Page } {
  const count = items.length;
  const pages = Math.max(1, Math.ceil(count / size));
  const page = Math.min(pages, Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1));
  const start = (page - 1) * size;
  return {
    items: items.slice(start, start + size),
    paging: { page, pages, from: count === 0 ? 0 : start + 1, to: Math.min(count, start + size), count },
  };
}
