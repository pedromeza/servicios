"use client";

import { AlertTriangle, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useState, useTransition } from "react";
import { deleteSubscription, setSubscriptionStatus } from "@/lib/actions";
import { daysUntil, fmtDate, fmtMoney } from "@/lib/format";
import { renewalTone } from "@/lib/renewal";
import { SUB_PLANS, SUB_STATUS, type Option, type Subscription } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui/Card";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";
import { FilterBar } from "@/components/ui/FilterBar";
import { SubscriptionForm } from "./SubscriptionForm";

export function SubscriptionsManager({
  subscriptions,
  total,
  accounts,
  clients,
}: {
  subscriptions: Subscription[];
  total: number;
  accounts: Option[];
  clients: Option[];
}) {
  const [editing, setEditing] = useState<Subscription | "new" | null>(null);
  const [deleting, setDeleting] = useState<Subscription | null>(null);
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
        placeholder="Buscar por cliente, cuenta o programa…"
        filters={[{ name: "status", label: "Estado", options: Object.entries(SUB_STATUS).map(([k, v]) => ({ value: k, label: v })) }]}
      />
      <Card>
        {subscriptions.length === 0 ? (
          <EmptyState
            icon={<RefreshCw size={24} />}
            title={total === 0 ? "Aún no registras suscripciones" : "Sin resultados"}
            description={
              total === 0
                ? "Anota qué vendiste, de qué cuenta, a quién, cuánto costó y cuándo renueva."
                : "Prueba con otros filtros."
            }
            action={total === 0 && accounts.length > 0 ? <Button onClick={() => open("new")}>Registrar la primera</Button> : undefined}
          />
        ) : (
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
                <Th className="w-24" />
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-100">
              {subscriptions.map((s) => {
                const days = daysUntil(s.renews_at);
                const t = renewalTone(days);
                return (
                  <tr key={s.id} className="group hover:bg-navy-50/60">
                    <Td className="font-medium text-navy-900">{s.client_name ?? <span className="font-normal text-slate-400">—</span>}</Td>
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
                      <div className="flex justify-end gap-1 opacity-70 transition group-hover:opacity-100">
                        <Button size="icon" variant="ghost" aria-label="Editar" onClick={() => open(s)}>
                          <Pencil size={15} />
                        </Button>
                        <Button size="icon" variant="ghost" aria-label="Eliminar" className="hover:text-red-600" onClick={() => setDeleting(s)}>
                          <Trash2 size={15} />
                        </Button>
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      <Dialog open={editing !== null} onClose={close} title={editing === "new" ? "Nueva suscripción" : "Editar suscripción"} wide>
        <SubscriptionForm key={nonce} subscription={editing === "new" ? null : editing} accounts={accounts} clients={clients} onDone={close} onCancel={close} />
      </Dialog>
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        pending={pending}
        title="Eliminar suscripción"
        description={`Se eliminará la suscripción de ${deleting?.products.join(", ")} (${deleting?.account_label}). Esta acción no se puede deshacer.`}
        onConfirm={() => {
          if (!deleting) return;
          start(async () => {
            await deleteSubscription(deleting.id);
            setDeleting(null);
          });
        }}
      />
    </>
  );
}
