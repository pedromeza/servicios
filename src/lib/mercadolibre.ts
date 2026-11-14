import "server-only";
import ExcelJS from "exceljs";

/** Una venta del reporte "Ventas" de Mercado Libre, ya interpretada. */
export type MlSale = {
  sale_id: string;
  date: string | null; // YYYY-MM-DD
  status: string;
  ok: boolean; // entregada o concretada (no cancelada ni reembolsada)
  buyer: string; // nombre del comprador (o "Público general · #venta")
  title: string;
  sku: string;
  products: string[];
  years: number | null; // vigencia leída del título
  units: number;
  unit_price: number;
  gross: number; // ingresos por productos
  fee: number; // comisión de Mercado Libre (positiva)
  net: number; // total recibido
  city: string;
};

const MESES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

function cellText(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if ("text" in v) return String(v.text);
    if ("result" in v) return cellText(v.result as ExcelJS.CellValue);
    if (v instanceof Date) return v.toISOString();
  }
  return String(v).trim();
}

function num(v: ExcelJS.CellValue): number {
  if (typeof v === "number") return v;
  const t = cellText(v).replace(/[^0-9.-]/g, "");
  const n = Number.parseFloat(t);
  return Number.isFinite(n) ? n : 0;
}

/** "26 de enero de 2026 22:36 hs." → "2026-01-26" */
export function parseMlDate(s: string): string | null {
  const m = s.match(/(\d{1,2}) de (\p{L}+) de (\d{4})/u);
  if (!m) return null;
  const month = MESES[m[2].toLowerCase()];
  if (!month) return null;
  return `${m[3]}-${String(month).padStart(2, "0")}-${String(Number(m[1])).padStart(2, "0")}`;
}

/** Vigencia en años leída del título: "(1 Año)", "2 Años", "3 Años". */
export function parseYears(title: string): number | null {
  const m = title.match(/(\d)\s*a[ñn]os?/i);
  return m ? Number(m[1]) : null;
}

/** Programas deducidos del título. */
export function parseProducts(title: string): string[] {
  const t = title.toLowerCase();
  const out: string[] = [];
  const known: [RegExp, string][] = [
    [/autocad\s*lt/, "AutoCAD LT"],
    [/autocad/, "AutoCAD"],
    [/revit/, "Revit"],
    [/civil\s*3d/, "Civil 3D"],
    [/inventor/, "Inventor"],
    [/3ds\s*max/, "3ds Max"],
    [/maya/, "Maya"],
    [/navisworks/, "Navisworks Manage"],
    [/fusion/, "Fusion"],
    [/colecci[oó]n\s*aec|aec collection/, "Colección AEC"],
    [/office/, "Office"],
    [/windows/, "Windows"],
  ];
  for (const [re, name] of known) if (re.test(t) && !out.includes(name)) out.push(name);
  if (out.includes("AutoCAD LT") && out.includes("AutoCAD") && !/autocad[^l]*autocad/.test(t)) out.splice(out.indexOf("AutoCAD"), 1);
  if (out.length === 0) out.push("Autodesk (sin especificar)");
  if (/\bedu\b|educativ/.test(t)) out[0] += " (Edu)";
  return out;
}

const OK_STATUS = /entregad|concretad|en camino|listo para|pendiente de env|enviado/i;

/** Lee el Excel de ventas de Mercado Libre y devuelve una venta por fila. */
export async function parseMlWorkbook(buffer: ArrayBuffer): Promise<{ sales: MlSale[]; sheet: string }> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.getWorksheet("Ventas MX") ?? wb.worksheets[0];
  if (!ws) throw new Error("El archivo no tiene hojas.");

  // Fila de encabezados: la que contiene "# de venta".
  let headerRow = 0;
  const headers = new Map<string, number>();
  ws.eachRow((row, n) => {
    if (headerRow) return;
    row.eachCell((cell, col) => {
      const t = cellText(cell.value);
      if (t && !headers.has(t)) headers.set(t, col);
    });
    if (headers.has("# de venta")) headerRow = n;
    else headers.clear();
  });
  if (!headerRow) throw new Error("No encontré la fila de encabezados con “# de venta”. ¿Es el reporte de Ventas de Mercado Libre?");

  const col = (name: string) => headers.get(name);
  const need = ["# de venta", "Fecha de venta", "Estado", "Título de la publicación"];
  for (const n of need) if (!col(n)) throw new Error(`Falta la columna “${n}” en el reporte.`);

  const sales: MlSale[] = [];
  ws.eachRow((row, n) => {
    if (n <= headerRow) return;
    const get = (name: string) => (col(name) ? row.getCell(col(name)!).value : null);
    const sale_id = cellText(get("# de venta"));
    if (!sale_id || !/^\d{6,}$/.test(sale_id)) return;
    const title = cellText(get("Título de la publicación"));
    const status = cellText(get("Estado"));
    const buyerRaw = cellText(get("Comprador")) || cellText(get("Datos personales o de empresa"));
    const buyer = !buyerRaw || /^p[uú]blico general$/i.test(buyerRaw) ? `Público general · #${sale_id}` : buyerRaw;
    const address = cellText(get("Dirección"));
    const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
    const city = parts.length >= 3 ? parts.slice(-3, -1).join(", ") : parts.slice(0, 2).join(", ");
    const units = Math.max(1, Math.round(num(get("Unidades")) || 1));
    sales.push({
      sale_id,
      date: parseMlDate(cellText(get("Fecha de venta"))),
      status,
      ok: OK_STATUS.test(status) && !/cancel|reembols|devoluci/i.test(status),
      buyer,
      title,
      sku: cellText(get("SKU")),
      products: parseProducts(`${title} ${cellText(get("SKU"))}`),
      years: parseYears(title),
      units,
      unit_price: num(get("Precio unitario de venta de la publicación (MXN)")) || num(get("Ingresos por productos (MXN)")) / units,
      gross: num(get("Ingresos por productos (MXN)")),
      fee: Math.abs(num(get("Cargo por venta e impuestos (MXN)"))),
      net: num(get("Total (MXN)")),
      city,
    });
  });
  sales.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "") || a.sale_id.localeCompare(b.sale_id));
  return { sales, sheet: ws.name };
}
