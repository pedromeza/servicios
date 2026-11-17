"use client";

import { AlertTriangle, History, Layers, Pencil, Plus, RefreshCw, Trash2, Undo2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteSubscription, markAsRenewal, markGenericAsSuite, purgeSubscription, restoreSubscription, setSubscriptionStatus } from "@/lib/actions";
import type { RenewalMoney } from "@/lib/types";
import { RenewDialog } from "./RenewDialog";
import { daysUntil, fmtDate, fmtDateTime, fmtMoney } from "@/lib/format";
import { renewalTone } from "@/lib/renewal";
import { SUB_PLANS, SUB_STATUS, type Option, type Subscription } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Fields";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";
import { FilterBar } from "@/components/ui/FilterBar";
import { Pagination } from "@/components/ui/Pagination";
import { PayLinkButton } from "@/components/ui/PayLinkButton";
import type { Page } from "@/lib/paging";
import { productsText } from "@/lib/products";
import { SubscriptionForm } from "./SubscriptionForm";

export function SubscriptionsManager({
  subscriptions,
  paging,
  total,
  money,
  accounts,
  clients,
  genericCount = 0,
  mpReady = false,
}: {
  subscriptions: Subscription[];
  paging: Page;
  total: number;
  money: RenewalMoney;
  accounts: Option[];
  clients: Option[];
  /** Suscripciones activas con solo “Autodesk (sin especificar)” como producto individual. */
  genericCount?: number;
  /** Mercado Pago conectado: se muestra el botón de link de pago en cada fila. */
  mpReady?: boolean;
}) {
  const [bulkSuite, setBulkSuite] = useState(false);
  // Selección para acciones en bloque (solo fuera de la papelera).
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [asRenewal, setAsRenewal] = useState(false);
  const [originalDate, setOriginalDate] = useState("");
  const [renewalError, setRenewalError] = useState<string | null>(null);
  const toggleSel = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const pageIds = subscriptions.map((s) => s.id);
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const chosen = subscriptions.filter((s) => selected.has(s.id));
  const [editing, setEditing] = useState<Subscription | "new" | null>(null);
  const [deleting, setDeleting] = useState<Subscription | null>(null);
  const [renewing, setRenewing] = useState<Subscription | null>(null);
  const [purging, setPurging] = useState<Subscription | null>(null);
  const inTrash = useSearchParams().get("status") === "deleted";
  const [nonce, setNonce] = useState(0);
  const [pending, start] = useTransition();
  const open = (s: Subscription | "new") => {
    setNonce((n) => n + 1);
    setEditing(s);
  };
  // Sin useCallback: el compilador de React memoriza solo y así no se queja al añadir estado nuevo.
  const close = () => setEditing(null);
  const closeRenew = () => setRenewing(null);

  return (
    <>
      <PageHeader
        title="Suscripciones"
        description={`${total} registrada${total === 1 ? "" : "s"} · ventas ${fmtMoney(money.sales)} · cobrado en renovaciones ${fmtMoney(money.renewals_collected)} (${money.renewals_count}) · por renovar en 30 días ${fmtMoney(money.upcoming_30)} · en 90 días ${fmtMoney(money.upcoming_90)}`}
        action={
          <Button onClick={() => open("new")} disabled={accounts.length === 0} title={accounts.length === 0 ? "Primero crea una cuenta" : undefined}>
            <Plus size={16} /> Nueva suscripción
          </Button>
        }
      />
      <FilterBar
        placeholder="Buscar por cliente, correo, cuenta o programa…"
        filters={[
          {
            name: "status",
            label: "Estado",
            options: [...Object.entries(SUB_STATUS).map(([k, v]) => ({ value: k, label: v })), { value: "deleted", label: "Eliminadas (papelera)" }],
          },
        ]}
      />
      {genericCount > 0 && !inTrash && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span className="flex items-center gap-2">
            <Layers size={16} className="shrink-0" />
            <span>
              <strong>{genericCount} suscripci{genericCount === 1 ? "ón" : "ones"}</strong> tiene{genericCount === 1 ? "" : "n"} “Autodesk (sin especificar)” como producto individual. Si lo que vendes en Mercado Libre es la suite completa, márcalas todas de una vez.
            </span>
          </span>
          <Button variant="secondary" onClick={() => setBulkSuite(true)} disabled={pending}>
            Marcar {genericCount === 1 ? "la" : `las ${genericCount}`} como suite completa
          </Button>
        </div>
      )}
      {selected.size > 0 && !inTrash && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-navy-200 bg-navy-50 px-4 py-3 text-sm text-navy-900">
          <span>
            <strong>{selected.size} seleccionada{selected.size === 1 ? "" : "s"}</strong>. Si la fecha de compra que tienen es en realidad la de su última renovación, corrígelas aquí.
          </span>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => setSelected(new Set())}>
              Quitar selección
            </Button>
            <Button size="sm" onClick={() => { setRenewalError(null); setAsRenewal(true); }} disabled={pending}>
              <History size={14} /> Fue renovación, la venta fue antes
            </Button>
          </div>
        </div>
      )}
      <Dialog open={asRenewal} onClose={() => setAsRenewal(false)} title="Fue renovación, la venta fue antes" description={`${chosen.length} suscripci${chosen.length === 1 ? "ón" : "ones"} seleccionada${chosen.length === 1 ? "" : "s"}.`}>
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            La fecha de compra actual pasará a ser una <strong>renovación</strong> (con el precio y costo que tiene la suscripción), y la <strong>venta</strong> se moverá a la fecha que indiques. Así en Ventas cuenta una venta en esa fecha y una renovación en la actual. Las que ya tengan fecha de compra anterior o igual no cambian.
          </p>
          <Field label="Fecha de la venta original" hint="Si no la sabes exacta, pon el mismo día y mes del año anterior.">
            <Input type="date" value={originalDate} onChange={(ev) => setOriginalDate(ev.target.value)} />
          </Field>
          {chosen.length > 0 && (
            <ul className="max-h-40 overflow-y-auto rounded-lg border border-navy-100 text-xs text-slate-600">
              {chosen.map((s) => (
                <li key={s.id} className="flex justify-between gap-2 px-3 py-1.5">
                  <span className="truncate">{s.client_name ?? "Sin cliente"} · {s.products.join(", ")}</span>
                  <span className="whitespace-nowrap">compra {fmtDate(s.purchased_at)} · {fmtMoney(s.price, s.currency)}</span>
                </li>
              ))}
            </ul>
          )}
          {renewalError && <p className="text-sm text-red-600">{renewalError}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setAsRenewal(false)}>
              Cancelar
            </Button>
            <Button
              disabled={pending || !originalDate}
              onClick={() =>
                start(async () => {
                  const res = await markAsRenewal([...selected], originalDate);
                  if (!res.ok) {
                    setRenewalError(res.error ?? "No se pudo aplicar.");
                    return;
                  }
                  setAsRenewal(false);
                  setSelected(new Set());
                })
              }
            >
              {pending ? "Aplicando…" : `Aplicar a ${chosen.length}`}
            </Button>
          </div>
        </div>
      </Dialog>
      <ConfirmDialog
        open={bulkSuite}
        onClose={() => setBulkSuite(false)}
        pending={pending}
        tone="primary"
        title="Marcar como suite completa"
        confirmLabel="Sí, marcar todas"
        pendingLabel="Marcando…"
        description={`${genericCount} suscripci${genericCount === 1 ? "ón" : "ones"} con “Autodesk (sin especificar)” pasarán de producto individual a suite / colección completa. El programa y lo demás no cambian; puedes editarlas después una por una.`}
        onConfirm={() =>
          start(async () => {
            const res = await markGenericAsSuite();
            if (!res.ok && res.error) window.alert(res.error);
            setBulkSuite(false);
          })
        }
      />
      <Card>
        {subscriptions.length === 0 ? (
          <EmptyState
            icon={<RefreshCw size={24} />}
            title={inTrash ? "La papelera está vacía" : total === 0 ? "Aún no registras suscripciones" : "Sin resultados"}
            description={
              inTrash
                ? "Las suscripciones que elimines aparecerán aquí y podrás restaurarlas."
                : total === 0
                  ? "Anota qué vendiste, de qué cuenta, a quién, cuánto costó y cuándo renueva."
                  : "Prueba con otros filtros."
            }
            action={total === 0 && accounts.length > 0 ? <Button onClick={() => open("new")}>Registrar la primera</Button> : undefined}
          />
        ) : (
          <>
          <Table>
            <thead className="border-b border-navy-100">
              <tr>
                {!inTrash && (
                  <Th className="w-8">
                    <input
                      type="checkbox"
                      aria-label="Seleccionar las de esta página"
                      className="accent-brand"
                      checked={allOnPage}
                      onChange={() =>
                        setSelected((s) => {
                          const n = new Set(s);
                          for (const id of pageIds) {
                            if (allOnPage) n.delete(id);
                            else n.add(id);
                          }
                          return n;
                        })
                      }
                    />
                  </Th>
                )}
                <Th>Cliente</Th>
                <Th>Cuenta</Th>
                <Th>Programas</Th>
                <Th>Compra</Th>
                <Th>Renueva</Th>
                <Th className="text-right">Costo / Venta</Th>
                <Th>Estado</Th>
                <Th className="w-40" />
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-100">
              {subscriptions.map((s) => {
                const days = daysUntil(s.renews_at);
                const t = renewalTone(days);
                return (
                  <tr key={s.id} className={`group hover:bg-navy-50/60 ${s.deleted_at ? "bg-slate-50 text-slate-400" : selected.has(s.id) ? "bg-brand-light/40" : ""}`}>
                    {!inTrash && (
                      <Td>
                        <input type="checkbox" aria-label={`Seleccionar ${s.client_name ?? "suscripción"}`} className="accent-brand" checked={selected.has(s.id)} onChange={() => toggleSel(s.id)} />
                      </Td>
                    )}
                    <Td>
                      <div className={`font-medium ${s.deleted_at ? "text-slate-500 line-through decoration-slate-300" : "text-navy-900"}`}>
                        {s.client_name ?? <span className="font-normal text-slate-400">—</span>}
                      </div>
                      {s.deleted_at && (
                        <Badge tone="danger" className="mt-0.5">
                          <Trash2 size={11} /> Eliminada {fmtDateTime(s.deleted_at)}
                        </Badge>
                      )}
                      {s.emails.map((e) => (
                        <div key={e} className="text-xs text-slate-400">
                          {e}
                        </div>
                      ))}
                    </Td>
                    <Td>
                      <div className="text-slate-800">{s.account_label}</div>
                      <div className="text-xs text-slate-400">{s.account_provider}</div>
                    </Td>
                    <Td>
                      <div className="max-w-[220px] text-slate-800" title={s.products.join(", ")}>
                        {productsText(s.plan, s.products, s.account_provider)}
                      </div>
                      <div className="text-xs text-slate-400">
                        {SUB_PLANS[s.plan]} · {s.seats} puesto{s.seats === 1 ? "" : "s"}
                      </div>
                    </Td>
                    <Td className="whitespace-nowrap">{fmtDate(s.purchased_at)}</Td>
                    <Td>
                      <div className="whitespace-nowrap text-slate-800">{fmtDate(s.renews_at)}</div>
                      {s.renewals > 0 && (
                        <div className="text-xs text-slate-400">
                          renovada {s.renewals} vez{s.renewals === 1 ? "" : "es"}
                        </div>
                      )}
                      {s.promo_months > 0 && (
                        <div className="text-xs text-emerald-600">
                          +{s.promo_months} mes{s.promo_months === 1 ? "" : "es"} gratis
                        </div>
                      )}
                      {s.status === "active" && (
                        <Badge tone={t.tone} className="mt-1">
                          {days !== null && days <= 7 && <AlertTriangle size={11} />}
                          {t.label}
                        </Badge>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap text-right">
                      <div className="text-xs text-slate-400">{fmtMoney(s.cost, s.currency)}</div>
                      <div className="font-medium text-navy-900">{fmtMoney(s.price, s.currency)}</div>
                    </Td>
                    <Td>
                      <select
                        aria-label="Cambiar estado"
                        disabled={s.deleted_at !== null}
                        value={s.status}
                        onChange={(ev) =>
                          start(async () => {
                            const res = await setSubscriptionStatus(s.id, ev.target.value as Subscription["status"]);
                            if (res && !res.ok && res.error) window.alert(res.error);
                          })
                        }
                        className={`rounded-full border-0 py-0.5 pl-2 pr-6 text-xs font-medium focus:ring-2 focus:ring-brand/50 ${
                          s.status === "active" ? "bg-emerald-50 text-emerald-700" : s.status === "expired" ? "bg-red-50 text-red-700" : s.status === "not_renewed" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {Object.entries(SUB_STATUS).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </Td>
                    <Td>
                      {s.deleted_at ? (
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="secondary" disabled={pending} onClick={() => start(() => restoreSubscription(s.id).then(() => undefined))}>
                            <Undo2 size={14} /> Restaurar
                          </Button>
                          <Button size="icon" variant="ghost" aria-label="Eliminar definitivamente" className="hover:text-red-600" onClick={() => setPurging(s)}>
                            <Trash2 size={15} />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-1 opacity-70 transition group-hover:opacity-100">
                          {mpReady && (
                            <PayLinkButton
                              iconOnly
                              subscriptionId={s.id}
                              renewal={{ price: s.price, currency: s.currency, plan: s.plan, products: s.products, provider: s.account_provider, purchased_at: s.purchased_at, renews_at: s.renews_at }}
                              waIntro={`Hola ${s.client_name ?? ""}, te saludamos de PGPM MEX. Aquí tienes tu link para renovar ${productsText(s.plan, s.products, s.account_provider)}`}
                            />
                          )}
                          <Button size="icon" variant="ghost" aria-label="Renovar" title="Renovar un periodo más (suma un sello de lealtad)" onClick={() => setRenewing(s)}>
                            <RefreshCw size={15} />
                          </Button>
                          <Button size="icon" variant="ghost" aria-label="Editar" onClick={() => open(s)}>
                            <Pencil size={15} />
                          </Button>
                          <Button size="icon" variant="ghost" aria-label="Eliminar" className="hover:text-red-600" onClick={() => setDeleting(s)}>
                            <Trash2 size={15} />
                          </Button>
                        </div>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          <Pagination paging={paging} label="suscripciones" />
          </>
        )}
      </Card>

      <Dialog open={editing !== null} onClose={close} title={editing === "new" ? "Nueva suscripción" : "Editar suscripción"} wide>
        <SubscriptionForm key={nonce} subscription={editing === "new" ? null : editing} accounts={accounts} clients={clients} onDone={close} onCancel={close} />
      </Dialog>
      {renewing && <RenewDialog key={renewing.id} subscription={renewing} onClose={closeRenew} />}
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        pending={pending}
        title="Eliminar suscripción"
        description={`La suscripción de ${deleting ? productsText(deleting.plan, deleting.products, deleting.account_provider) : ""} (${deleting?.account_label}) pasará a la papelera. Podrás restaurarla desde el filtro Estado → Eliminadas.`}
        onConfirm={() => {
          if (!deleting) return;
          start(async () => {
            const res = await deleteSubscription(deleting.id);
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
        description={`Se borrará para siempre la suscripción de ${purging ? productsText(purging.plan, purging.products, purging.account_provider) : ""} de ${purging?.client_name ?? "sin cliente"}. Esta acción no se puede deshacer.`}
        onConfirm={() => {
          if (!purging) return;
          start(async () => {
            await purgeSubscription(purging.id);
            setPurging(null);
          });
        }}
      />
    </>
  );
}
