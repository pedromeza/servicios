"use client";

import { Check, Copy, Eye, EyeOff, ListOrdered, MessageCircle, Pencil, Plus, Tag, Trash2 } from "lucide-react";
import { useCallback, useMemo, useState, useTransition } from "react";
import { deletePriceItem, togglePriceItem } from "@/lib/actions";
import { fmtMoney } from "@/lib/format";
import { whatsappLink, whatsappNumber } from "@/lib/reminders";
import type { PriceItem } from "@/lib/types";
import { termLabel } from "@/lib/terms";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui/Card";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/Fields";
import { PriceForm } from "./PriceForm";

type Line = { key: number; itemId: string; qty: number };

export function PricesManager({ prices, whatsapp, paymentUrl }: { prices: PriceItem[]; whatsapp: string; paymentUrl: string }) {
  const [editing, setEditing] = useState<PriceItem | "new" | null>(null);
  const [deleting, setDeleting] = useState<PriceItem | null>(null);
  const [nonce, setNonce] = useState(0);
  const [pending, start] = useTransition();
  const open = (p: PriceItem | "new") => {
    setNonce((n) => n + 1);
    setEditing(p);
  };
  const close = useCallback(() => setEditing(null), []);

  // ---- Cotizador
  const active = prices.filter((p) => p.active);
  const [lines, setLines] = useState<Line[]>([]);
  const [client, setClient] = useState("");
  const [phone, setPhone] = useState("");
  const [discount, setDiscount] = useState("");
  const [extra, setExtra] = useState("");
  const [copied, setCopied] = useState(false);
  const addLine = () => setLines((l) => [...l, { key: Date.now(), itemId: active[0]?.id ?? "", qty: 1 }]);
  const upd = (key: number, patch: Partial<Line>) => setLines((l) => l.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  const quote = useMemo(() => {
    const rows = lines
      .map((l) => ({ l, p: prices.find((p) => p.id === l.itemId) }))
      .filter((x): x is { l: Line; p: PriceItem } => Boolean(x.p));
    const subtotal = rows.reduce((n, { l, p }) => n + p.price * l.qty, 0);
    const disc = Math.min(subtotal, Math.max(0, Number(discount) || 0));
    const total = subtotal - disc;
    const cost = rows.reduce((n, { l, p }) => n + p.cost * l.qty, 0);
    const currency = rows[0]?.p.currency ?? "MXN";
    const text = [
      `*Cotización PGPM MEX*${client ? ` · ${client}` : ""}`,
      "",
      ...rows.map(({ l, p }) => `• ${p.product} · ${termLabel(p.term_months)}${l.qty > 1 ? ` × ${l.qty}` : ""}: ${fmtMoney(p.price * l.qty, p.currency)}${p.notes ? ` (${p.notes})` : ""}`),
      disc > 0 ? `• Descuento: -${fmtMoney(disc, currency)}` : "",
      "",
      `*Total: ${fmtMoney(total, currency)}*`,
      extra.trim() ? `\n${extra.trim()}` : "",
      "",
      paymentUrl ? `Pago seguro por Mercado Libre: ${paymentUrl}` : "Pago por Mercado Libre.",
      "Activación el mismo día. Atención por WhatsApp" + (whatsapp ? ` ${whatsapp}` : "") + ".",
    ]
      .filter((s) => s !== "")
      .join("\n");
    return { rows, subtotal, disc, total, cost, currency, text };
  }, [lines, prices, client, discount, extra, paymentUrl, whatsapp]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(quote.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };
  const waNumber = whatsappNumber(phone);

  // ---- Lista completa para enviar
  const [listPhone, setListPhone] = useState("");
  const [listIntro, setListIntro] = useState("Hola, te comparto nuestra lista de precios:");
  const [listCopied, setListCopied] = useState(false);
  const listText = useMemo(() => {
    const byProduct = new Map<string, PriceItem[]>();
    for (const p of active) byProduct.set(p.product, [...(byProduct.get(p.product) ?? []), p]);
    const lines: string[] = ["*Lista de precios PGPM MEX*", ""];
    if (listIntro.trim()) lines.splice(0, 0, listIntro.trim(), "");
    for (const [product, items] of byProduct) {
      lines.push(`*${product}*`);
      for (const p of items.sort((a, b) => a.term_months - b.term_months)) {
        lines.push(`  • ${termLabel(p.term_months)}: ${fmtMoney(p.price, p.currency)}${p.notes ? ` (${p.notes})` : ""}`);
      }
    }
    lines.push("", paymentUrl ? `Pago seguro por Mercado Libre: ${paymentUrl}` : "Pago por Mercado Libre.", "Activación el mismo día. Atención por WhatsApp" + (whatsapp ? ` ${whatsapp}` : "") + ".");
    return lines.join("\n");
  }, [active, listIntro, paymentUrl, whatsapp]);
  const copyList = async () => {
    try {
      await navigator.clipboard.writeText(listText);
      setListCopied(true);
      setTimeout(() => setListCopied(false), 1500);
    } catch {}
  };
  const listWa = whatsappNumber(listPhone);

  return (
    <>
      <PageHeader
        title="Precios y cotizador"
        description={`${prices.length} precio${prices.length === 1 ? "" : "s"} · ${active.length} activo${active.length === 1 ? "" : "s"} en el cotizador`}
        action={
          <Button onClick={() => open("new")}>
            <Plus size={16} /> Nuevo precio
          </Button>
        }
      />

      <div className="grid min-w-0 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Lista de precios" description="Lo que cobras por cada programa y vigencia. Los inactivos no salen en el cotizador." />
          {prices.length === 0 ? (
            <EmptyState icon={<Tag size={24} />} title="Sin precios todavía" description="Agrega AutoCAD 1 año, Revit 1 año, Windows 11 Pro… con su precio." action={<Button onClick={() => open("new")}>Agregar el primero</Button>} />
          ) : (
            <Table>
              <thead className="border-b border-navy-100">
                <tr>
                  <Th>Producto</Th>
                  <Th>Vigencia</Th>
                  <Th className="text-right">Precio</Th>
                  <Th className="text-right">Ganancia</Th>
                  <Th className="w-28" />
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-100">
                {prices.map((p) => (
                  <tr key={p.id} className={`group hover:bg-navy-50/60 ${p.active ? "" : "text-slate-400"}`}>
                    <Td>
                      <div className={`font-medium ${p.active ? "text-navy-900" : ""}`}>{p.product}</div>
                      {p.notes && <div className="text-xs text-slate-400">{p.notes}</div>}
                    </Td>
                    <Td>
                      <Badge tone={p.active ? "navy" : "neutral"}>{termLabel(p.term_months)}</Badge>
                    </Td>
                    <Td className="whitespace-nowrap text-right font-medium text-navy-900">{fmtMoney(p.price, p.currency)}</Td>
                    <Td className="whitespace-nowrap text-right text-xs text-slate-500">{p.cost > 0 ? fmtMoney(p.price - p.cost, p.currency) : "—"}</Td>
                    <Td>
                      <div className="flex justify-end gap-1 opacity-70 transition group-hover:opacity-100">
                        <Button size="icon" variant="ghost" aria-label={p.active ? "Desactivar" : "Activar"} title={p.active ? "Quitar del cotizador" : "Mostrar en el cotizador"} disabled={pending} onClick={() => start(() => togglePriceItem(p.id, !p.active).then(() => undefined))}>
                          {p.active ? <Eye size={15} /> : <EyeOff size={15} />}
                        </Button>
                        <Button size="icon" variant="ghost" aria-label="Editar" onClick={() => open(p)}>
                          <Pencil size={15} />
                        </Button>
                        <Button size="icon" variant="ghost" aria-label="Eliminar" className="hover:text-red-600" onClick={() => setDeleting(p)}>
                          <Trash2 size={15} />
                        </Button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader title="Cotizador" description="Arma la cotización y mándala por WhatsApp o pégala en Mercado Libre." />
          <div className="space-y-4 px-5 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Cliente (opcional)">
                <Input value={client} onChange={(ev) => setClient(ev.target.value)} placeholder="Nombre o empresa" />
              </Field>
              <Field label="WhatsApp del cliente (opcional)" hint={phone && !waNumber ? "Escribe 10 dígitos." : undefined}>
                <Input value={phone} onChange={(ev) => setPhone(ev.target.value)} placeholder="55 1234 5678" inputMode="tel" />
              </Field>
            </div>

            <div className="space-y-2 rounded-lg border border-navy-100 p-3">
              {lines.length === 0 && <p className="text-xs text-slate-400">Agrega líneas con los productos a cotizar.</p>}
              {lines.map((l) => {
                const p = prices.find((x) => x.id === l.itemId);
                return (
                  <div key={l.key} className="grid grid-cols-[1fr_72px_auto] items-center gap-2">
                    <Select value={l.itemId} onChange={(ev) => upd(l.key, { itemId: ev.target.value })} aria-label="Producto">
                      {active.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.product} · {termLabel(p.term_months)} · {fmtMoney(p.price, p.currency)}
                        </option>
                      ))}
                    </Select>
                    <Input type="number" min={1} max={99} value={l.qty} onChange={(ev) => upd(l.key, { qty: Math.max(1, Number(ev.target.value) || 1) })} aria-label="Cantidad" />
                    <div className="flex items-center gap-1">
                      <span className="w-24 text-right text-sm font-medium text-navy-900">{p ? fmtMoney(p.price * l.qty, p.currency) : "—"}</span>
                      <Button size="icon" variant="ghost" aria-label="Quitar" className="hover:text-red-600" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                );
              })}
              <Button size="sm" variant="secondary" onClick={addLine} disabled={active.length === 0}>
                <Plus size={14} /> Agregar línea
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Descuento (monto)">
                <Input type="number" min={0} step="0.01" value={discount} onChange={(ev) => setDiscount(ev.target.value)} placeholder="0.00" />
              </Field>
              <Field label="Texto adicional">
                <Input value={extra} onChange={(ev) => setExtra(ev.target.value)} placeholder="Ej. Precio válido hasta el viernes" />
              </Field>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-navy-50 px-4 py-3">
              <div className="text-sm text-slate-600">
                Subtotal {fmtMoney(quote.subtotal, quote.currency)}
                {quote.disc > 0 ? ` · descuento ${fmtMoney(quote.disc, quote.currency)}` : ""}
                {quote.cost > 0 ? ` · ganancia ${fmtMoney(quote.total - quote.cost, quote.currency)}` : ""}
              </div>
              <div className="text-xl font-bold text-navy-900">{fmtMoney(quote.total, quote.currency)}</div>
            </div>

            <Field label="Mensaje listo para enviar">
              <Textarea readOnly value={quote.text} className="min-h-[200px] font-mono text-[13px]" />
            </Field>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={copy} disabled={quote.rows.length === 0}>
                {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Copiado" : "Copiar texto"}
              </Button>
              {waNumber ? (
                <a
                  href={whatsappLink(waNumber, quote.text)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#25D366] px-4 text-sm font-medium text-white hover:bg-[#1ebe5d]"
                >
                  <MessageCircle size={16} /> Enviar por WhatsApp
                </a>
              ) : (
                <Button disabled title="Escribe el WhatsApp del cliente">
                  <MessageCircle size={16} /> Enviar por WhatsApp
                </Button>
              )}
            </div>
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Lista de precios para enviar" description="Todos los precios activos, agrupados por programa, listos para WhatsApp o para pegar en Mercado Libre." />
        <div className="grid gap-4 px-5 py-4 lg:grid-cols-2">
          <div className="space-y-4">
            <Field label="Texto de inicio (opcional)">
              <Input value={listIntro} onChange={(ev) => setListIntro(ev.target.value)} placeholder="Hola, te comparto nuestra lista de precios:" />
            </Field>
            <Field label="WhatsApp del cliente (opcional)" hint={listPhone && !listWa ? "Escribe 10 dígitos." : "Déjalo vacío si solo vas a copiar el texto."}>
              <Input value={listPhone} onChange={(ev) => setListPhone(ev.target.value)} placeholder="55 1234 5678" inputMode="tel" />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={copyList} disabled={active.length === 0}>
                {listCopied ? <Check size={15} /> : <Copy size={15} />} {listCopied ? "Copiado" : "Copiar lista"}
              </Button>
              {listWa ? (
                <a
                  href={whatsappLink(listWa, listText)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#25D366] px-4 text-sm font-medium text-white hover:bg-[#1ebe5d]"
                >
                  <MessageCircle size={16} /> Enviar por WhatsApp
                </a>
              ) : (
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(listText)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#25D366] px-4 text-sm font-medium text-white hover:bg-[#1ebe5d]"
                  title="Abre WhatsApp para que elijas a quién mandarla"
                >
                  <ListOrdered size={16} /> Elegir contacto en WhatsApp
                </a>
              )}
            </div>
          </div>
          <Field label="Vista previa">
            <Textarea readOnly value={listText} className="min-h-[240px] font-mono text-[13px]" />
          </Field>
        </div>
      </Card>

      <Dialog open={editing !== null} onClose={close} title={editing === "new" ? "Nuevo precio" : "Editar precio"}>
        <PriceForm key={nonce} item={editing === "new" ? null : editing} usedNotes={prices.map((p) => p.notes ?? "").filter(Boolean)} onDone={close} onCancel={close} />
      </Dialog>
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        pending={pending}
        title="Eliminar precio"
        description={`Se eliminará “${deleting?.product} · ${deleting ? termLabel(deleting.term_months) : ""}” de la lista.`}
        onConfirm={() => {
          if (!deleting) return;
          start(async () => {
            await deletePriceItem(deleting.id);
            setDeleting(null);
          });
        }}
      />
    </>
  );
}
