"use client";

import { Check, Copy, CreditCard, Download, ExternalLink, MessageCircle, Pencil, Plus, ShoppingCart, Trash2, Undo2, X } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { cancelPaymentLink, createPaymentLink, deleteSale, purgeSale, restoreSale } from "@/lib/actions";
import { fmtDate, fmtDateTime, fmtMoney } from "@/lib/format";
import type { Page } from "@/lib/paging";
import { SALE_KINDS, type LedgerMonth, type LedgerRow, type Option, type PaymentLink, type Sale } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui/Card";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";
import { ComboSelect } from "@/components/ui/ComboSelect";
import { Field, Input } from "@/components/ui/Fields";
import { FilterBar } from "@/components/ui/FilterBar";
import { Pagination } from "@/components/ui/Pagination";
import { SaleForm } from "./SaleForm";

const KIND_TONE: Record<LedgerRow["kind"], "success" | "warning" | "neutral" | "danger"> = { subscription: "success", renewal: "warning", license: "neutral", other: "neutral" };

export function SalesManager({
  rows,
  paging,
  months,
  totals,
  sales,
  trash,
  clients,
  platforms,
  migrationPending,
  links = [],
  mpReady = false,
}: {
  rows: LedgerRow[];
  paging: Page;
  months: LedgerMonth[];
  totals: { count: number; price: number; cost: number; month: LedgerMonth | null; year: { price: number; cost: number; count: number } };
  sales: Sale[]; // otras ventas (para editar)
  trash: Sale[]; // otras ventas en la papelera
  clients: Option[];
  platforms: string[];
  migrationPending: boolean;
  links?: PaymentLink[]; // links de pago de Mercado Pago recientes
  mpReady?: boolean;
}) {
  // Cobro suelto con link de Mercado Pago.
  const [charging, setCharging] = useState(false);
  const [chargeConcept, setChargeConcept] = useState("");
  const [chargeAmount, setChargeAmount] = useState("");
  const [chargeClient, setChargeClient] = useState("");
  const [chargeError, setChargeError] = useState<string | null>(null);
  const [chargeUrl, setChargeUrl] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  /** WhatsApp con el link escrito: al número del cliente si lo tiene, o para elegir el contacto. */
  const waHref = (l: { phone?: string | null; client_name?: string | null; concept: string; amount: number; currency?: string; url: string }) => {
    const text = `Hola${l.client_name ? ` ${l.client_name}` : ""}, te saludamos de PGPM MEX. Aquí tienes tu link de pago (${l.concept}, ${fmtMoney(l.amount, l.currency ?? "MXN")}):\n${l.url}`;
    return `https://wa.me/${l.phone ?? ""}?text=${encodeURIComponent(text)}`;
  };
  const [charged, setCharged] = useState<{ concept: string; amount: number; client_id: string } | null>(null);
  const copyUrl = async (id: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
    } catch {
      window.prompt("Copia el link:", url);
    }
  };
  const params = useSearchParams();
  const inTrash = params.get("tipo") === "deleted";
  const [editing, setEditing] = useState<Sale | "new" | null>(null);
  const [deleting, setDeleting] = useState<Sale | null>(null);
  const [purging, setPurging] = useState<Sale | null>(null);
  const [nonce, setNonce] = useState(0);
  const [pending, start] = useTransition();
  const open = (s: Sale | "new") => {
    setNonce((n) => n + 1);
    setEditing(s);
  };
  const close = useCallback(() => setEditing(null), []);
  const saleOf = (r: LedgerRow) => sales.find((s) => s.id === r.ref_id) ?? null;
  const exportHref = `/api/ventas/export${params.toString() ? `?${params.toString()}` : ""}`;

  return (
    <>
      <PageHeader
        title="Ventas"
        description={`${totals.count} venta${totals.count === 1 ? "" : "s"} · cobrado ${fmtMoney(totals.price)} · ganancia ${fmtMoney(totals.price - totals.cost)} · este mes ${fmtMoney(totals.month?.price ?? 0)} (${totals.month?.count ?? 0}) · este año ${fmtMoney(totals.year.price)}`}
        action={
          <div className="flex flex-wrap gap-2">
            <a
              href={exportHref}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-navy-200 bg-white px-4 text-sm font-medium text-navy-900 transition-colors hover:bg-navy-50"
            >
              <Download size={16} /> Exportar a Excel
            </a>
            {mpReady && (
              <Button
                variant="secondary"
                onClick={() => {
                  setChargeError(null);
                  setChargeUrl(null);
                  setCharging(true);
                }}
              >
                <CreditCard size={16} /> Cobrar con link
              </Button>
            )}
            <Button onClick={() => open("new")} disabled={migrationPending} title={migrationPending ? "Falta aplicar la migración 0018" : undefined}>
              <Plus size={16} /> Otra venta
            </Button>
          </div>
        }
      />
      {migrationPending && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Falta aplicar la migración 0018 para registrar otras ventas y el precio de las licencias. Mientras tanto se muestran suscripciones y renovaciones. Aplícala desde el aviso amarillo del panel.
        </p>
      )}
      <FilterBar
        placeholder="Buscar por cliente, concepto o programa…"
        filters={[
          {
            name: "tipo",
            label: "Tipo",
            options: [...Object.entries(SALE_KINDS).map(([k, v]) => ({ value: k, label: v })), { value: "deleted", label: "Otras ventas eliminadas (papelera)" }],
          },
          { name: "mes", label: "Mes", options: months.map((m) => ({ value: m.month, label: `${m.label} · ${fmtMoney(m.price)}` })) },
          { name: "plataforma", label: "Plataforma", options: platforms.map((p) => ({ value: p, label: p })) },
        ]}
      />

      {!inTrash && months.length > 0 && !params.get("mes") && (
        <Card className="mb-4">
          <CardHeader title="Por mes" description="Cobrado, costo y ganancia de todo lo vendido. Pulsa un mes para ver solo sus ventas." />
          <div className="grid gap-px bg-navy-100 sm:grid-cols-3 lg:grid-cols-6">
            {months.slice(0, 12).map((m) => (
              <Link key={m.month} href={`/ventas?mes=${m.month}`} className="bg-white px-4 py-3 text-sm hover:bg-navy-50/60">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{m.label}</div>
                <div className="mt-1 text-lg font-bold text-navy-900">{fmtMoney(m.price)}</div>
                <div className="text-xs text-slate-500">
                  {m.count} venta{m.count === 1 ? "" : "s"} · ganancia {fmtMoney(m.price - m.cost)}
                </div>
              </Link>
            ))}
          </div>
        </Card>
      )}

      {!inTrash && links.length > 0 && (
        <Card className="mb-4">
          <CardHeader
            title="Links de pago de Mercado Pago"
            description={`${links.filter((l) => l.status === "pending").length} pendiente${links.filter((l) => l.status === "pending").length === 1 ? "" : "s"} · ${links.filter((l) => l.status === "paid").length} pagado${links.filter((l) => l.status === "paid").length === 1 ? "" : "s"}. Al pagarse, la renovación o la venta se registra sola.`}
          />
          <ul className="max-h-72 divide-y divide-navy-100 overflow-y-auto text-sm">
            {links.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5">
                <div className="min-w-0">
                  <div className="truncate font-medium text-navy-900">{l.concept}</div>
                  <div className="text-xs text-slate-500">
                    {l.client_name ?? "Sin cliente"} · creado {fmtDateTime(l.created_at)}
                    {l.paid_at ? ` · pagado ${fmtDateTime(l.paid_at)}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="whitespace-nowrap font-semibold text-navy-900">{fmtMoney(l.amount, l.currency)}</span>
                  <Badge tone={l.status === "paid" ? "success" : l.status === "pending" ? "warning" : "neutral"}>{l.status === "paid" ? "Pagado" : l.status === "pending" ? "Pendiente" : "Cancelado"}</Badge>
                  {l.status === "pending" && l.url && (
                    <>
                      <a
                        href={waHref({ ...l, url: l.url })}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={l.phone ? "Mandar el link al WhatsApp del cliente" : "Abrir WhatsApp y elegir a quién mandarlo"}
                        className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#25D366] px-2.5 text-xs font-medium text-white hover:bg-[#1ebe5d]"
                      >
                        <MessageCircle size={13} /> WhatsApp
                      </a>
                      <a href={l.url} target="_blank" rel="noopener noreferrer" aria-label="Abrir link" title="Abrir el link" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-navy-700 hover:bg-navy-100/70">
                        <ExternalLink size={15} />
                      </a>
                      <Button size="sm" variant="secondary" onClick={() => copyUrl(l.id, l.url!)}>
                        {copiedId === l.id ? <Check size={13} /> : <Copy size={13} />} {copiedId === l.id ? "Copiado" : "Copiar"}
                      </Button>
                      <Button size="icon" variant="ghost" aria-label="Cancelar link" className="hover:text-red-600" disabled={pending} onClick={() => start(() => cancelPaymentLink(l.id).then(() => undefined))}>
                        <X size={15} />
                      </Button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Dialog open={charging} onClose={() => setCharging(false)} title="Cobrar con link de Mercado Pago" description="Genera un link para cualquier cobro. Al pagarse se registra solo como otra venta.">
        {chargeUrl ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-lg border border-navy-200 bg-navy-50 px-3 py-2 text-sm">
              <input readOnly value={chargeUrl} className="min-w-0 flex-1 bg-transparent text-slate-700 outline-none" onFocus={(ev) => ev.currentTarget.select()} />
              <Button size="sm" variant="secondary" onClick={() => copyUrl("new", chargeUrl)}>
                {copiedId === "new" ? <Check size={13} /> : <Copy size={13} />} {copiedId === "new" ? "Copiado" : "Copiar"}
              </Button>
            </div>
            <p className="text-xs text-slate-500">Queda en la lista “Links de pago” de esta página, donde verás cuando pase a Pagado.</p>
            <div className="flex flex-wrap justify-end gap-2">
              {charged && (
                <a
                  href={waHref({ ...charged, url: chargeUrl, phone: links.find((l) => l.client_id === charged.client_id && l.phone)?.phone ?? null, client_name: clients.find((c) => c.value === charged.client_id)?.label ?? null })}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#25D366] px-4 text-sm font-medium text-white hover:bg-[#1ebe5d]"
                >
                  <MessageCircle size={15} /> Mandar por WhatsApp
                </a>
              )}
              <Button onClick={() => setCharging(false)}>Listo</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Field label="Concepto">
              <Input value={chargeConcept} onChange={(ev) => setChargeConcept(ev.target.value)} placeholder="Office 2021 Professional Plus" autoFocus />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Monto (MXN)">
                <Input type="number" min={1} step="0.01" inputMode="decimal" value={chargeAmount} onChange={(ev) => setChargeAmount(ev.target.value)} placeholder="0.00" />
              </Field>
              <Field label="Cliente">
                <ComboSelect name="charge_client" value={chargeClient} onChange={setChargeClient} options={clients} emptyLabel="Sin cliente" placeholder="Buscar cliente…" />
              </Field>
            </div>
            {chargeError && <p className="text-sm text-red-600">{chargeError}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setCharging(false)}>
                Cancelar
              </Button>
              <Button
                disabled={pending || !chargeConcept.trim() || !(Number(chargeAmount) > 0)}
                onClick={() =>
                  start(async () => {
                    const res = await createPaymentLink({ concept: chargeConcept, amount: Number(chargeAmount), client_id: chargeClient || undefined });
                    if (!res.ok || !res.url) {
                      setChargeError(res.error ?? "No se pudo generar el link.");
                      return;
                    }
                    setChargeUrl(res.url);
                    setCharged({ concept: chargeConcept.trim(), amount: Number(chargeAmount), client_id: chargeClient });
                    setChargeConcept("");
                    setChargeAmount("");
                  })
                }
              >
                {pending ? "Generando…" : "Generar link"}
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      <Card>
        {inTrash ? (
          trash.length === 0 ? (
            <EmptyState icon={<Trash2 size={24} />} title="La papelera está vacía" description="Las otras ventas que elimines aparecerán aquí y podrás restaurarlas." />
          ) : (
            <Table>
              <thead className="border-b border-navy-100">
                <tr>
                  <Th>Fecha</Th>
                  <Th>Cliente</Th>
                  <Th>Concepto</Th>
                  <Th className="text-right">Precio</Th>
                  <Th className="w-40" />
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-100">
                {trash.map((s) => (
                  <tr key={s.id} className="bg-slate-50 text-slate-400">
                    <Td className="whitespace-nowrap">{fmtDate(s.sold_at)}</Td>
                    <Td>{s.client_name ?? "—"}</Td>
                    <Td>
                      <div className="line-through decoration-slate-300">{s.concept}</div>
                      <Badge tone="danger" className="mt-0.5">
                        <Trash2 size={11} /> Eliminada {fmtDateTime(s.deleted_at ?? "")}
                      </Badge>
                    </Td>
                    <Td className="whitespace-nowrap text-right">{fmtMoney(s.price, s.currency)}</Td>
                    <Td>
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="secondary" disabled={pending} onClick={() => start(() => restoreSale(s.id).then(() => undefined))}>
                          <Undo2 size={14} /> Restaurar
                        </Button>
                        <Button size="icon" variant="ghost" aria-label="Borrar definitivamente" className="hover:text-red-600" onClick={() => setPurging(s)}>
                          <Trash2 size={15} />
                        </Button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<ShoppingCart size={24} />}
            title={totals.count === 0 ? "Aún no hay ventas" : "Sin resultados"}
            description={
              totals.count === 0
                ? "Aquí se juntan las suscripciones, renovaciones y licencias con precio. Lo que no encaje en esas secciones regístralo con “Otra venta”."
                : "Prueba con otra búsqueda o quita los filtros."
            }
          />
        ) : (
          <>
            <Table>
              <thead className="border-b border-navy-100">
                <tr>
                  <Th>Fecha</Th>
                  <Th>Cliente</Th>
                  <Th>Concepto</Th>
                  <Th>Tipo</Th>
                  <Th>Plataforma</Th>
                  <Th className="text-right">Costo / venta</Th>
                  <Th className="text-right">Ganancia</Th>
                  <Th className="w-24" />
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-100">
                {rows.map((r) => {
                  const own = r.kind === "other" ? saleOf(r) : null;
                  return (
                    <tr key={r.key} className="group hover:bg-navy-50/60">
                      <Td className="whitespace-nowrap">{fmtDate(r.date)}</Td>
                      <Td>
                        {r.client_id ? (
                          <Link href={`/clientes/${r.client_id}`} className="font-medium text-navy-900 hover:underline">
                            {r.client_name}
                          </Link>
                        ) : (
                          <span className="text-slate-400">{r.client_name ?? "Sin cliente"}</span>
                        )}
                      </Td>
                      <Td>
                        <div className="text-slate-800">{r.concept}</div>
                        {r.detail && <div className="max-w-xs truncate text-xs text-slate-400">{r.detail}</div>}
                      </Td>
                      <Td>
                        <Badge tone={KIND_TONE[r.kind]}>{SALE_KINDS[r.kind]}</Badge>
                      </Td>
                      <Td className="text-slate-600">{r.platform ?? <span className="text-slate-400">—</span>}</Td>
                      <Td className="whitespace-nowrap text-right">
                        <div className="text-xs text-slate-400">{fmtMoney(r.cost, r.currency)}</div>
                        <div className="font-semibold text-navy-900">{fmtMoney(r.price, r.currency)}</div>
                      </Td>
                      <Td className={`whitespace-nowrap text-right font-medium ${r.price - r.cost < 0 ? "text-red-600" : "text-emerald-700"}`}>{fmtMoney(r.price - r.cost, r.currency)}</Td>
                      <Td>
                        <div className="flex justify-end gap-1">
                          {own ? (
                            <>
                              <Button size="icon" variant="ghost" aria-label="Editar" onClick={() => open(own)}>
                                <Pencil size={15} />
                              </Button>
                              <Button size="icon" variant="ghost" aria-label="Eliminar" className="hover:text-red-600" onClick={() => setDeleting(own)}>
                                <Trash2 size={15} />
                              </Button>
                            </>
                          ) : (
                            <Link href={r.href} aria-label="Ver en su sección" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-navy-700 hover:bg-navy-100/70">
                              <ExternalLink size={15} />
                            </Link>
                          )}
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            <Pagination paging={paging} label="ventas" />
          </>
        )}
      </Card>

      <Dialog open={editing !== null} onClose={close} title={editing === "new" ? "Otra venta" : "Editar venta"} description="Servicios, hardware o cualquier cobro que no sea licencia ni suscripción.">
        <SaleForm key={nonce} sale={editing === "new" ? null : editing} clients={clients} onDone={close} onCancel={close} />
      </Dialog>
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        pending={pending}
        title="Eliminar venta"
        description={`“${deleting?.concept}” pasará a la papelera. Podrás restaurarla desde el filtro Tipo → Otras ventas eliminadas.`}
        onConfirm={() => {
          if (!deleting) return;
          start(async () => {
            const res = await deleteSale(deleting.id);
            if (res && !res.ok && res.error) window.alert(res.error);
            setDeleting(null);
          });
        }}
      />
      <ConfirmDialog
        open={purging !== null}
        onClose={() => setPurging(null)}
        pending={pending}
        title="Eliminar definitivamente"
        confirmLabel="Borrar para siempre"
        description={`Se borrará para siempre “${purging?.concept}”. Esta acción no se puede deshacer.`}
        onConfirm={() => {
          if (!purging) return;
          start(async () => {
            await purgeSale(purging.id);
            setPurging(null);
          });
        }}
      />
    </>
  );
}
