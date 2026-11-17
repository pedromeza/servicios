"use client";

import { AlertTriangle, CheckCircle2, FileSpreadsheet, Upload } from "lucide-react";
import { useActionState, useMemo, useState } from "react";
import { commitMlImport, previewMlImport, type MlImportResult, type MlPreviewRow, type MlPreviewState } from "@/lib/actions";
import { addMonthsISO, fmtDate, fmtMoney } from "@/lib/format";
import { termLabel } from "@/lib/terms";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, PageHeader, Table, Td, Th } from "@/components/ui/Card";
import { Field, FormError, Select } from "@/components/ui/Fields";
import { SubmitButton } from "@/components/ui/SubmitButton";

export function ImportManager() {
  const [preview, analyze, analyzing] = useActionState<MlPreviewState, FormData>(previewMlImport, null);
  const [result, commit, committing] = useActionState<MlImportResult | null, FormData>(commitMlImport, null);
  const [fileName, setFileName] = useState("");
  const [includeSimilar, setIncludeSimilar] = useState(false);
  // Selección manual. Por defecto entran las válidas; las canceladas/reembolsadas o
  // "ya existe a mano" se pueden marcar a mano. Los cambios se guardan junto con la
  // referencia del análisis al que pertenecen, así un análisis nuevo empieza limpio.
  const keyOf = (r: MlPreviewRow) => r.sale_id || `${r.buyer}|${r.date}|${r.title}`;
  const [overrides, setOverrides] = useState<{ for: MlPreviewState; keys: Set<string> }>({ for: null, keys: new Set() });
  const flipped = overrides.for === preview ? overrides.keys : new Set<string>();
  const rows = useMemo(() => (preview?.ok ? preview.rows : []), [preview]);
  const selectable = (r: MlPreviewRow) => !r.imported;
  const byDefault = (r: MlPreviewRow) => r.ok && !r.imported && (includeSimilar || !r.similar);
  const isChecked = (r: MlPreviewRow) => selectable(r) && byDefault(r) !== flipped.has(keyOf(r));
  const chosen = useMemo(
    () => rows.filter(isChecked).map((r) => ({ ...r, force: !byDefault(r) })),
    [rows, flipped, includeSimilar], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const stats = useMemo(() => {
    const valid = rows.filter((r) => r.ok);
    const similar = valid.filter((r) => !r.imported && r.similar).length;
    return {
      total: rows.length,
      toCreate: chosen.length,
      forced: chosen.filter((r) => r.force).length,
      selectable: rows.filter(selectable).length,
      imported: valid.filter((r) => r.imported).length,
      similar,
      invalid: rows.length - valid.length,
      noYears: valid.filter((r) => r.months === null && !r.imported).length,
      noSaleId: valid.filter((r) => !r.sale_id && !r.imported).length,
      newClients: new Set(valid.filter((r) => !r.imported && !r.client_exists).map((r) => r.buyer.toLowerCase())).size,
      amount: chosen.reduce((n, r) => n + r.unit_price * r.units, 0),
    };
  }, [rows, chosen]);
  const toggleRow = (r: MlPreviewRow) => {
    const k = keyOf(r);
    const n = new Set(flipped);
    if (n.has(k)) n.delete(k);
    else n.add(k);
    setOverrides({ for: preview, keys: n });
  };
  const allSelected = stats.selectable > 0 && chosen.length === stats.selectable;
  // Marcar todas = invertir las que por defecto no entran; desmarcar todas = invertir las que sí.
  const toggleAll = () => setOverrides({ for: preview, keys: new Set(rows.filter((r) => selectable(r) && byDefault(r) === allSelected).map(keyOf)) });

  return (
    <>
      <PageHeader
        title="Importar ventas"
        description="Sube el reporte de Ventas de Mercado Libre o la hoja de captura (Cliente, Programas, Correo, Vigencia, Fecha de compra, Precio…). Verás cómo quedaría cada venta antes de guardar nada."
      />

      <Card className="mb-6">
        <CardHeader
          title="1. Elige el archivo"
          description="Acepta el reporte de Mercado Libre (Ventas → Descargar reporte → Ventas) o una hoja .xlsx con encabezados Cliente, Programas, Correo, Vigencia, Fecha de compra, Precio unitario, Puestos, Adicional y Fecha de renovación. Los demás encabezados se ignoran."
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
            description={`${preview.format === "ml" ? "Reporte de Mercado Libre" : "Hoja de captura"} · ${stats.total} ventas en “${preview.sheet}” · ${stats.toCreate} por importar · ${stats.imported} ya importadas · ${stats.similar} ya registradas a mano · ${stats.invalid} canceladas o reembolsadas (se omiten)`}
          />
          <form action={commit} className="space-y-4 px-5 py-4">
            <input type="hidden" name="rows" value={JSON.stringify(chosen)} />
            {stats.similar > 0 && (
              <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <input type="checkbox" name="include_similar" checked={includeSimilar} onChange={(ev) => setIncludeSimilar(ev.target.checked)} className="mt-0.5 accent-brand" />
                <span>
                  <strong>{stats.similar} venta{stats.similar === 1 ? "" : "s"} parece{stats.similar === 1 ? "" : "n"} ya registrada{stats.similar === 1 ? "" : "s"} a mano</strong> (mismo cliente, misma fecha de compra y mismo
                  programa). Se omiten para no duplicar. Marca esta casilla solo si quieres importarlas de todos modos.
                </span>
              </label>
            )}
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
                  Precio = precio unitario × puestos. Los correos de la columna Correo quedan en la suscripción. Renovación = la de la hoja o compra + vigencia
                  {stats.noYears > 0 ? ` (${stats.noYears} sin vigencia: se asume 1 año)` : ""}. Las que ya vencieron entran como vencidas.
                  {stats.noSaleId > 0 ? ` ${stats.noSaleId} sin # de venta: no se puede detectar si ya estaban; revisa que no se dupliquen.` : ""}
                </p>
              </div>
            </div>
            {result && (
              <div className={`rounded-lg border px-3 py-2 text-sm ${result.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"}`}>
                {result.ok ? (
                  <p className="flex items-center gap-1.5">
                    <CheckCircle2 size={15} /> Importadas {result.created} suscripciones y {result.clients_created} clientes nuevos en “{result.account_label}”.{" "}
                    {result.skipped_imported > 0 ? `${result.skipped_imported} ya existían. ` : ""}
                    {result.skipped_similar > 0 ? `${result.skipped_similar} omitidas por estar registradas a mano. ` : ""}
                    {result.skipped_invalid > 0 ? `${result.skipped_invalid} omitidas por cancelación o reembolso.` : ""}
                  </p>
                ) : (
                  <p className="flex items-center gap-1.5">
                    <AlertTriangle size={15} /> {result.error} Se importaron {result.created} antes del error; vuelve a analizar y reintenta: no se duplican.
                  </p>
                )}
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-slate-500">
                {stats.toCreate} de {stats.selectable} seleccionadas. Desmarca en la tabla las que no quieras subir; también puedes marcar una cancelada o reembolsada si sí se entregó.
                {stats.forced > 0 ? ` ${stats.forced} marcada${stats.forced === 1 ? "" : "s"} a mano.` : ""}
              </p>
              <Button type="submit" disabled={committing || preview.migrationPending || stats.toCreate === 0}>
                <Upload size={15} /> {committing ? "Importando…" : `Importar ${stats.toCreate} venta${stats.toCreate === 1 ? "" : "s"}`}
              </Button>
            </div>
          </form>

          <Table>
            <thead className="border-b border-navy-100">
              <tr>
                <Th className="w-10">
                  <input
                    type="checkbox"
                    aria-label="Seleccionar todas"
                    className="accent-brand"
                    checked={allSelected}
                    onChange={toggleAll}
                  />
                </Th>
                <Th>Fecha</Th>
                <Th>Comprador</Th>
                <Th>Programas</Th>
                <Th>Correo</Th>
                <Th>Vigencia</Th>
                <Th>Renueva</Th>
                <Th className="text-right">Precio</Th>
                <Th>Resultado</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-100">
              {rows.map((r) => (
                <tr
                  key={keyOf(r)}
                  className={isChecked(r) ? (r.ok ? "" : "bg-amber-50/40") : !r.ok ? "bg-red-50/40 text-slate-400" : "text-slate-400"}
                >
                  <Td>
                    <input
                      type="checkbox"
                      aria-label={`Importar ${r.buyer}`}
                      className="accent-brand"
                      disabled={!selectable(r)}
                      checked={isChecked(r)}
                      onChange={() => toggleRow(r)}
                    />
                  </Td>
                  <Td className="whitespace-nowrap">{fmtDate(r.date)}</Td>
                  <Td>
                    <div className={isChecked(r) ? "font-medium text-navy-900" : ""}>{r.buyer}</div>
                    <div className="text-xs text-slate-400">
                      {r.sale_id ? `#${r.sale_id}` : "sin # de venta"}
                      {r.client_exists ? " · cliente existente" : ""}
                      {r.extra ? ` · ${r.extra}` : ""}
                    </div>
                  </Td>
                  <Td>
                    <div>{r.products.join(", ")}</div>
                    <div className="max-w-[260px] truncate text-xs text-slate-400" title={r.title}>
                      {r.title}
                    </div>
                  </Td>
                  <Td className="max-w-[200px] break-all text-xs text-slate-600">{r.emails || <span className="text-slate-400">—</span>}</Td>
                  <Td className="whitespace-nowrap">{r.months !== null ? termLabel(r.months) : <span className="text-amber-700">no dice → 1 año</span>}</Td>
                  <Td className="whitespace-nowrap">{r.renews_at ? fmtDate(r.renews_at) : r.date && (r.months ?? 12) > 0 ? fmtDate(addMonthsISO(r.date, r.months ?? 12)) : "—"}</Td>
                  <Td className="whitespace-nowrap text-right">{fmtMoney(r.unit_price * r.units)}{r.units > 1 ? ` (${r.units} u.)` : ""}</Td>
                  <Td>
                    {r.imported ? (
                      <Badge>Ya importada</Badge>
                    ) : isChecked(r) ? (
                      <span title={!r.ok ? `Estado en ML: ${r.status}` : r.similar ?? undefined}>
                        <Badge tone={r.ok && !r.similar ? "success" : "warning"}>{r.ok && !r.similar ? "Se importará" : "Se importará (marcada a mano)"}</Badge>
                      </span>
                    ) : !r.ok ? (
                      <Badge tone="danger">{r.status}</Badge>
                    ) : r.similar ? (
                      <span title={r.similar}>
                        <Badge tone="warning">Ya existe (a mano)</Badge>
                      </span>
                    ) : (
                      <Badge>Sin marcar</Badge>
                    )}
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

