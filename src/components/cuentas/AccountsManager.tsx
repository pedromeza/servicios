"use client";

import { ChevronRight, KeyRound, Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useState, useTransition } from "react";
import { deleteAccount } from "@/lib/actions";
import { ACCOUNT_ROLES, PROVIDERS, type Account, type Option } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui/Card";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";
import { FilterBar } from "@/components/ui/FilterBar";
import { SecretField } from "@/components/ui/SecretField";
import { AccountForm } from "./AccountForm";

export function AccountsManager({
  accounts,
  total,
  admins,
  clients,
}: {
  accounts: Account[];
  total: number;
  admins: Option[];
  clients: Option[];
}) {
  const [editing, setEditing] = useState<Account | "new" | null>(null);
  const [deleting, setDeleting] = useState<Account | null>(null);
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
          { name: "provider", label: "Proveedor", options: PROVIDERS.map((p) => ({ value: p, label: p })) },
          { name: "role", label: "Tipo", options: Object.entries(ACCOUNT_ROLES).map(([k, v]) => ({ value: k, label: v })) },
        ]}
      />
      <Card>
        {accounts.length === 0 ? (
          <EmptyState
            icon={<KeyRound size={24} />}
            title={total === 0 ? "Aún no tienes cuentas" : "Sin resultados"}
            description={total === 0 ? "Registra tus cuentas de Autodesk, Microsoft, Adobe… con su usuario y contraseña cifrados." : "Prueba con otros filtros."}
            action={total === 0 ? <Button onClick={() => open("new")}>Crear la primera</Button> : undefined}
          />
        ) : (
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
                <tr key={a.id} className="group hover:bg-navy-50/60">
                  <Td>
                    <Link href={`/cuentas/${a.id}`} className="font-medium text-navy-900 hover:text-brand">
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
                  <Td>{a.client_name ?? <span className="text-slate-400">Propia</span>}</Td>
                  <Td>{a.subscriptions_count}</Td>
                  <Td>
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
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Dialog open={editing !== null} onClose={close} title={editing === "new" ? "Nueva cuenta" : "Editar cuenta"} wide>
        <AccountForm key={nonce} account={editing === "new" ? null : editing} admins={admins} clients={clients} onDone={close} onCancel={close} />
      </Dialog>
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        pending={pending}
        title="Eliminar cuenta"
        description={`Se eliminará "${deleting?.label}" junto con sus ${deleting?.subscriptions_count ?? 0} suscripciones. Esta acción no se puede deshacer.`}
        onConfirm={() => {
          if (!deleting) return;
          start(async () => {
            await deleteAccount(deleting.id);
            setDeleting(null);
          });
        }}
      />
    </>
  );
}
