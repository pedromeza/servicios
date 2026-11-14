"use client";

import { AlertTriangle, CheckCircle2, FileSpreadsheet, Upload } from "lucide-react";
import { useActionState, useMemo, useState } from "react";
import { commitMlImport, previewMlImport, type MlImportResult, type MlPreviewState } from "@/lib/actions";
import { fmtDate, fmtMoney } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, PageHeader, Table, Td, Th } from "@/components/ui/Card";
import { Field, FormError, Select } from "@/components/ui/Fields";
import { SubmitButton } from "@/components/ui/SubmitButton";

export function ImportManager() {
  const [preview, analyze, analyzing] = useActionState<MlPreviewState, FormData>(previewMlImport, null);
  const [result, commit, committing] = useActionState<MlImportResult | null, FormData>(commitMlImport, null);
  const [fileName, setFileName] = useState("");

  const rows = useMemo(() => (preview?.ok ? preview.rows : []), [preview]);
  const stats = useMemo(() => {
    const valid = rows.filter((r) => r.ok);
    return {
      total: rows.length,
      toCreate: valid.filter((r) => !r.imported).length,
      imported: valid.filter((r) => r.imported).length,
      invalid: rows.length - valid.length,
      noYears: valid.filter((r) => !r.years && !r.imported).length,
      newClients: new Set(valid.filter((r) => !r.imported && !r.client_exists).map((r) => r.buyer.toLowerCase())).size,
      amount: valid.filter((r) => !r.imported).reduce((n, r) => n + r.unit_price * r.units, 0),
    };
  }, [rows]);

  return (
    <>
      <PageHeader title="Importar ventas de Mercado Libre" description="Sube el reporte de Ventas (.xlsx) y crea clientes y suscripciones de golpe, sin duplicar lo ya importado." />

      <Card className="mb-6">
        <CardHeader
          title="1. Elige el archivo"
          description="En Mercado Libre: Ventas → Descargar reporte → Ventas (Excel). El archivo se llama algo como “Ventas_MX_Mercado_Libre…xlsx”."
        />
        <form action={analyze} className="flex flex-wrap items-end gap-3 px-5 py-4">
          <label className="flex min-w-[260px] flex-1 cursor-pointer items-center gap-3 rounded-lg border border-dashed border-navy-200 bg-navy-50 px-4 py-3 text-sm text-slate-600 hover:bg-navy-100/60">
            <FileSpreadsheet size={20} className="shrink-0 text-navy-700" />
            <span className="truncate">{fileName || "Selecciona el reporte .xlsx"}</span>
            <input type="file" name="file" accept=".xlsx" className="sr-only" onChange={(ev) => setFileName(ev.target.files?.[0]?.name ?? "")} required />
          </label>
          <SubmitButton>{analyzing ? "Analizando…" : "Analizar"}</SubmitButton>
        </form>
        {preview && !preview.ok && (
          <div className="px-5 pb-4">
            <FormError message={preview.error} />
          </div>
        )}
      </Card>

      {preview?.ok && (
        <Card className="mb-6">
          <CardHeader
            title="2. Revisa y confirma"
            description={`${stats.total} ventas en la hoja “${preview.sheet}” · ${stats.toCreate} por importar · ${stats.imported} ya importadas · ${stats.invalid} canceladas o reembolsadas (se omiten)`}
          />
          <form action={commit} className="space-y-4 px-5 py-4">
            <input type="hidden" name="rows" value={JSON.stringify(rows)} />
            {preview.migrationPending && (
              <p className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" /> Falta aplicar la migración 0010 (columna ml_sale_id). Hasta entonces no se puede importar sin riesgo de duplicar.
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Cuenta a la que se asignan" hint="El reporte no dice qué cuenta de Autodesk se usó. Puedes reasignar cada suscripción después.">
                <Select name="account_id" defaultValue="__new__">
                  <option value="__new__">Crear/usar cuenta “Ventas Mercado Libre”</option>
                  {preview.accounts.map((a) => (
                    <option key={a.value} value={a.value}>
                      {a.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="rounded-lg bg-navy-50 px-3 py-2 text-xs text-slate-600">
                <p>
                  <strong className="text-navy-900">Se crearán:</strong> {stats.toCreate} suscripciones por {fmtMoney(stats.amount)} y {stats.newClients} cliente
                  {stats.newClients === 1 ? "" : "s"} nuevo{stats.newClients === 1 ? "" : "s"} (los demás ya existen y se reutilizan).
                </p>
                <p className="mt-1">
                  Precio = precio unitario × unidades. Comisión y neto quedan en las notas. Renovación = compra + vigencia del título
                  {stats.noYears > 0 ? ` (${stats.noYears} sin vigencia: se asume 1 año)` : ""}. Las que ya vencieron entran como vencidas.
                </p>
              </div>
            </div>
            {result && (
              <div className={`rounded-lg border px-3 py-2 text-sm ${result.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"}`}>
                {result.ok ? (
                  <p className="flex items-center gap-1.5">
                    <CheckCircle2 size={15} /> Importadas {result.created} suscripciones y {result.clients_created} clientes nuevos en “{result.account_label}”.{" "}
                    {result.skipped_imported > 0 ? `${result.skipped_imported} ya existían. ` : ""}
                    {result.skipped_invalid > 0 ? `${result.skipped_invalid} omitidas por cancelación o reembolso.` : ""}
                  </p>
                ) : (
                  <p className="flex items-center gap-1.5">
                    <AlertTriangle size={15} /> {result.error} Se importaron {result.created} antes del error; vuelve a analizar y reintenta: no se duplican.
                  </p>
                )}
              </div>
            )}
            <div className="flex justify-end">
              <Button type="submit" disabled={committing || preview.migrationPending || stats.toCreate === 0}>
                <Upload size={15} /> {committing ? "Importando…" : `Importar ${stats.toCreate} venta${stats.toCreate === 1 ? "" : "s"}`}
              </Button>
            </div>
          </form>

          <Table>
            <thead className="border-b border-navy-100">
              <tr>
                <Th>Fecha</Th>
                <Th>Comprador</Th>
                <Th>Programas</Th>
                <Th>Vigencia</Th>
                <Th>Renueva</Th>
                <Th className="text-right">Precio</Th>
                <Th>Resultado</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-100">
              {rows.map((r) => (
                <tr key={r.sale_id} className={!r.ok ? "bg-red-50/40 text-slate-400" : r.imported ? "text-slate-400" : ""}>
                  <Td className="whitespace-nowrap">{fmtDate(r.date)}</Td>
                  <Td>
                    <div className={r.ok && !r.imported ? "font-medium text-navy-900" : ""}>{r.buyer}</div>
                    <div className="text-xs text-slate-400">#{r.sale_id}{r.client_exists ? " · cliente existente" : ""}</div>
                  </Td>
                  <Td>
                    <div>{r.products.join(", ")}</div>
                    <div className="max-w-[260px] truncate text-xs text-slate-400" title={r.title}>
                      {r.title}
                    </div>
                  </Td>
                  <Td className="whitespace-nowrap">{r.years ? `${r.years} año${r.years === 1 ? "" : "s"}` : <span className="text-amber-700">no dice → 1 año</span>}</Td>
                  <Td className="whitespace-nowrap">{r.date ? fmtDate(addYears(r.date, r.years ?? 1)) : "—"}</Td>
                  <Td className="whitespace-nowrap text-right">{fmtMoney(r.unit_price * r.units)}{r.units > 1 ? ` (${r.units} u.)` : ""}</Td>
                  <Td>
                    {!r.ok ? <Badge tone="danger">{r.status}</Badge> : r.imported ? <Badge>Ya importada</Badge> : <Badge tone="success">Se importará</Badge>}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </>
  );
}

function addYears(iso: string, years: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y + years, m - 1, d);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
