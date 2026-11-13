"use client";

import { AlertTriangle, Pencil, Plus, RefreshCw, Trash2, Undo2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { deleteSubscription, purgeSubscription, renewSubscription, restoreSubscription, setSubscriptionStatus } from "@/lib/actions";
import { daysUntil, fmtDate, fmtDateTime, fmtMoney } from "@/lib/format";
import { renewalTone } from "@/lib/renewal";
import { SUB_PLANS, SUB_STATUS, type Option, type Subscription } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui/Card";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";
import { FilterBar } from "@/components/ui/FilterBar";
import { Pagination } from "@/components/ui/Pagination";
import type { Page } from "@/lib/paging";
import { SubscriptionForm } from "./SubscriptionForm";

export function SubscriptionsManager({
  subscriptions,
  paging,
  total,
  accounts,
  clients,
}: {
  subscriptions: Subscription[];
  paging: Page;
  total: number;
  accounts: Option[];
  clients: Option[];
}) {
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
  const close = useCallback(() => setEditing(null), []);

  const totals = subscriptions.reduce(
    (acc, s) => {
      acc.price += s.price;
      acc.cost += s.cost;
      return acc;
    },
    { price: 0, cost: 0 },
  );

  return (
    <>
      <PageHeader
        title="Suscripciones"
        description={`${total} registrada${total === 1 ? "" : "s"} · ventas ${fmtMoney(totals.price)} · ganancia ${fmtMoney(totals.price - totals.cost)} en la vista actual`}
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
                <Th>Cliente</Th>
                <Th>Cuenta</Th>
                <Th>Programas</Th>
                <Th>Compra</Th>
                <Th>Renueva</Th>
                <Th className="text-right">Costo / Venta</Th>
                <Th>Estado</Th>
                <Th className="w-32" />
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-100">
              {subscriptions.map((s) => {
                const days = daysUntil(s.renews_at);
                const t = renewalTone(days);
                return (
                  <tr key={s.id} className={`group hover:bg-navy-50/60 ${s.deleted_at ? "bg-slate-50 text-slate-400" : ""}`}>
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
                      <div className="max-w-[220px] text-slate-800">{s.products.join(", ")}</div>
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
                        onChange={(ev) => start(() => setSubscriptionStatus(s.id, ev.target.value as Subscription["status"]).then(() => undefined))}
                        className={`rounded-full border-0 py-0.5 pl-2 pr-6 text-xs font-medium focus:ring-2 focus:ring-brand/50 ${
                          s.status === "active" ? "bg-emerald-50 text-emerald-700" : s.status === "expired" ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600"
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
      <ConfirmDialog
        open={renewing !== null}
        onClose={() => setRenewing(null)}
        pending={pending}
        title="Renovar suscripción"
        confirmLabel="Renovar"
        pendingLabel="Renovando…"
        tone="primary"
        description={`Se correrá la fecha de renovación de ${renewing?.products.join(", ")} un periodo más a partir del ${fmtDate(renewing?.renews_at)}, quedará activa y el cliente sumará un sello en su tarjeta de lealtad.`}
        onConfirm={() => {
          if (!renewing) return;
          start(async () => {
            await renewSubscription(renewing.id);
            setRenewing(null);
          });
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        pending={pending}
        title="Eliminar suscripción"
        description={`La suscripción de ${deleting?.products.join(", ")} (${deleting?.account_label}) pasará a la papelera. Podrás restaurarla desde el filtro Estado → Eliminadas.`}
        onConfirm={() => {
          if (!deleting) return;
          start(async () => {
            await deleteSubscription(deleting.id);
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
        description={`Se borrará para siempre la suscripción de ${purging?.products.join(", ")} de ${purging?.client_name ?? "sin cliente"}. Esta acción no se puede deshacer.`}
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
