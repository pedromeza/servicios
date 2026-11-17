"use client";

import { ChevronRight, KeyRound, Pencil, Plus, ShieldCheck, Trash2, Undo2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useCallback, useState, useTransition } from "react";
import { deleteAccount, purgeAccount, restoreAccount } from "@/lib/actions";
import { daysUntil, fmtDate, fmtDateTime } from "@/lib/format";
import { renewalTone } from "@/lib/renewal";
import { ACCOUNT_ROLES, type Account, type Option } from "@/lib/types";
import { termLabel } from "@/lib/terms";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui/Card";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";
import { FilterBar } from "@/components/ui/FilterBar";
import { Pagination } from "@/components/ui/Pagination";
import type { Page } from "@/lib/paging";
import { SecretField } from "@/components/ui/SecretField";
import { AccountForm } from "./AccountForm";

export function AccountsManager({
  accounts,
  paging,
  total,
  admins,
  clients,
  providers,
}: {
  accounts: Account[];
  paging: Page;
  total: number;
  providers: string[];
  admins: Option[];
  clients: Option[];
}) {
  const [editing, setEditing] = useState<Account | "new" | null>(null);
  const [deleting, setDeleting] = useState<Account | null>(null);
  const [purging, setPurging] = useState<Account | null>(null);
  const inTrash = useSearchParams().get("estado") === "eliminadas";
  const [nonce, setNonce] = useState(0);
  const [pending, start] = useTransition();
  const open = (a: Account | "new") => {
    setNonce((n) => n + 1);
    setEditing(a);
  };
  const close = useCallback(() => setEditing(null), []);

  return (
    <>
      <PageHeader
        title="Cuentas"
        description={`${total} cuenta${total === 1 ? "" : "s"} · usuarios y contraseñas cifrados`}
        action={
          <Button onClick={() => open("new")}>
            <Plus size={16} /> Nueva cuenta
          </Button>
        }
      />
      <FilterBar
        placeholder="Buscar por nombre, correo, cliente…"
        filters={[
          { name: "estado", label: "Mostrar", options: [{ value: "eliminadas", label: "Eliminadas (papelera)" }] },
          { name: "provider", label: "Proveedor", options: providers.map((p) => ({ value: p, label: p })) },
          { name: "role", label: "Tipo", options: Object.entries(ACCOUNT_ROLES).map(([k, v]) => ({ value: k, label: v })) },
        ]}
      />
      <Card>
        {accounts.length === 0 ? (
          <EmptyState
            icon={<KeyRound size={24} />}
            title={inTrash ? "La papelera está vacía" : total === 0 ? "Aún no tienes cuentas" : "Sin resultados"}
            description={total === 0 ? "Registra tus cuentas de Autodesk, Microsoft, Adobe… con su usuario y contraseña cifrados." : "Prueba con otros filtros."}
            action={total === 0 ? <Button onClick={() => open("new")}>Crear la primera</Button> : undefined}
          />
        ) : (
          <>
          <Table>
            <thead className="border-b border-navy-100">
              <tr>
                <Th>Cuenta</Th>
                <Th>Acceso</Th>
                <Th>Tipo</Th>
                <Th>Cliente</Th>
                <Th>Suscrip.</Th>
                <Th className="w-28" />
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-100">
              {accounts.map((a) => (
                <tr key={a.id} className={`group hover:bg-navy-50/60 ${a.deleted_at ? "bg-slate-50 text-slate-400" : ""}`}>
                  <Td>
                    {a.deleted_at && (
                      <Badge tone="danger" className="mb-1">
                        <Trash2 size={11} /> Eliminada {fmtDateTime(a.deleted_at)}
                      </Badge>
                    )}
                    <Link href={`/cuentas/${a.id}`} className={`font-medium hover:text-brand ${a.deleted_at ? "text-slate-500 line-through decoration-slate-300" : "text-navy-900"}`}>
                      {a.label}
                    </Link>
                    <div className="text-xs text-slate-400">{a.provider}</div>
                  </Td>
                  <Td>
                    <div className="text-slate-800">{a.username}</div>
                    {a.has_password ? (
                      <SecretField entity="account_password" id={a.id} className="mt-1" />
                    ) : (
                      <span className="text-xs text-slate-400">Sin contraseña guardada</span>
                    )}
                  </Td>
                  <Td>
                    {a.role === "admin" ? (
                      <Badge tone="navy">
                        <ShieldCheck size={11} /> Admin{a.children_count ? ` · ${a.children_count} usuarios` : ""}
                      </Badge>
                    ) : (
                      <div className="flex flex-col gap-0.5">
                        <Badge>Usuario</Badge>
                        {a.parent_label && <span className="text-xs text-slate-400">de {a.parent_label}</span>}
                      </div>
                    )}
                  </Td>
                  <Td>
                    {a.client_name ?? <span className="text-slate-400">Propia</span>}
                    {!a.client_id && a.term_months && (
                      <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-slate-400">
                        <span>{termLabel(a.term_months)}</span>
                        {a.expires_at && (
                          <>
                            <span>· vence {fmtDate(a.expires_at)}</span>
                            <Badge tone={renewalTone(daysUntil(a.expires_at)).tone}>{renewalTone(daysUntil(a.expires_at)).label}</Badge>
                          </>
                        )}
                      </div>
                    )}
                  </Td>
                  <Td>{a.subscriptions_count}</Td>
                  <Td>
                    {a.deleted_at ? (
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="secondary" disabled={pending} onClick={() => start(() => restoreAccount(a.id).then(() => undefined))}>
                          <Undo2 size={14} /> Restaurar
                        </Button>
                        <Button size="icon" variant="ghost" aria-label="Eliminar definitivamente" className="hover:text-red-600" onClick={() => setPurging(a)}>
                          <Trash2 size={15} />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-1 opacity-70 transition group-hover:opacity-100">
                        <Button size="icon" variant="ghost" aria-label="Editar" onClick={() => open(a)}>
                          <Pencil size={15} />
                        </Button>
                        <Button size="icon" variant="ghost" aria-label="Eliminar" className="hover:text-red-600" onClick={() => setDeleting(a)}>
                          <Trash2 size={15} />
                        </Button>
                        <Link href={`/cuentas/${a.id}`} aria-label="Ver detalle" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-navy-700 hover:bg-navy-100/70">
                          <ChevronRight size={16} />
                        </Link>
                      </div>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pagination paging={paging} label="cuentas" />
          </>
        )}
      </Card>

      <Dialog open={editing !== null} onClose={close} title={editing === "new" ? "Nueva cuenta" : "Editar cuenta"} wide>
        <AccountForm key={nonce} account={editing === "new" ? null : editing} admins={admins} clients={clients} providers={providers} onDone={close} onCancel={close} />
      </Dialog>
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        pending={pending}
        title="Eliminar cuenta"
        description={`"${deleting?.label}" pasará a la papelera. Sus ${deleting?.subscriptions_count ?? 0} suscripciones se conservan. Podrás restaurarla desde Mostrar → Eliminadas.`}
        onConfirm={() => {
          if (!deleting) return;
          start(async () => {
            const res = await deleteAccount(deleting.id);
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
        description={`Se borrará para siempre "${purging?.label}" junto con sus ${purging?.subscriptions_count ?? 0} suscripciones. Esta acción no se puede deshacer.`}
        onConfirm={() => {
          if (!purging) return;
          start(async () => {
            await purgeAccount(purging.id);
            setPurging(null);
          });
        }}
      />
    </>
  );
}
