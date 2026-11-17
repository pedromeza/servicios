import ExcelJS from "exceljs";
import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { salesLedger } from "@/lib/data";
import { todayISO } from "@/lib/format";
import { filterLedger, sortByRenewal } from "@/lib/ledger";
import { SALE_KINDS } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Descarga el libro de ventas (con los mismos filtros de la página) como .xlsx. */
export async function GET(req: NextRequest) {
  try {
    await requireUser();
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const sp = req.nextUrl.searchParams;
  const get = (k: string) => sp.get(k) ?? "";
  const matched = filterLedger(await salesLedger(), { q: get("q"), tipo: get("tipo"), mes: get("mes"), plataforma: get("plataforma") });
  const rows = get("orden") !== "venta" && !get("mes") ? sortByRenewal(matched, todayISO()) : matched;

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Ventas");
  ws.columns = [
    { header: "Fecha de venta", key: "date", width: 14 },
    { header: "Renueva", key: "renews", width: 12 },
    { header: "Cliente", key: "client", width: 30 },
    { header: "Concepto", key: "concept", width: 36 },
    { header: "Detalle", key: "detail", width: 36 },
    { header: "Tipo", key: "kind", width: 14 },
    { header: "Plataforma", key: "platform", width: 16 },
    { header: "Costo", key: "cost", width: 12 },
    { header: "Venta", key: "price", width: 12 },
    { header: "Ganancia", key: "profit", width: 12 },
    { header: "Moneda", key: "currency", width: 8 },
  ];
  ws.getRow(1).font = { bold: true };
  for (const r of rows) {
    ws.addRow({
      date: r.date,
      renews: r.renews_at ?? "",
      client: r.client_name ?? "",
      concept: r.concept,
      detail: r.detail,
      kind: SALE_KINDS[r.kind],
      platform: r.platform ?? "",
      cost: r.cost,
      price: r.price,
      profit: r.price - r.cost,
      currency: r.currency,
    });
  }
  const last = rows.length + 2;
  ws.getCell(`G${last}`).value = "Total";
  ws.getCell(`G${last}`).font = { bold: true };
  ws.getCell(`H${last}`).value = { formula: `SUM(H2:H${last - 1})` };
  ws.getCell(`I${last}`).value = { formula: `SUM(I2:I${last - 1})` };
  ws.getCell(`J${last}`).value = { formula: `SUM(J2:J${last - 1})` };
  for (const col of ["H", "I", "J"]) ws.getColumn(col).numFmt = "#,##0.00";

  const buf = await wb.xlsx.writeBuffer();
  const name = `ventas${get("mes") ? `-${get("mes")}` : ""}.xlsx`;
  return new NextResponse(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}"`,
    },
  });
}
