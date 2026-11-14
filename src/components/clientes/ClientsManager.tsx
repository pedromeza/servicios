"use client";

import { ChevronRight, Pencil, Plus, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { useCallback, useState, useTransition } from "react";
import { deleteClient } from "@/lib/actions";
import { daysUntil, fmtDate } from "@/lib/format";
import { renewalTone } from "@/lib/renewal";
import type { Client } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui/Card";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";
import { FilterBar } from "@/components/ui/FilterBar";
import { Pagination } from "@/components/ui/Pagination";
import type { Page } from "@/lib/paging";
import { ClientForm } from "./ClientForm";

/** Agrupa programas repetidos: ["AutoCAD","AutoCAD","Revit"] → [["AutoCAD",2],["Revit",1]]. */
function summarize(products: string[]): [string, number][] {
  const m = new Map<string, number>();
  for (const p of products) m.set(p, (m.get(p) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

export function ClientsManager({ clients, paging, total, allNames }: { clients: Client[]; paging: Page; total: number; allNames: string[] }) {
  const [editing, setEditing] = useState<Client | "new" | null>(null);
  const [deleting, setDeleting] = useState<Client | null>(null);
  const [nonce, setNonce] = useState(0);
  const [pending, start] = useTransition();

  const open = (c: Client | "new") => {
    setNonce((n) => n + 1);
    setEditing(c);
  };
  const close = useCallback(() => setEditing(null), []);

  return (
    <>
      <PageHeader
        title="Clientes"
        description={total === 1 ? "1 cliente registrado" : `${total} clientes registrados`}
        action={
          <Button onClick={() => open("new")}>
            <Plus size={16} /> Nuevo cliente
          </Button>
        }
      />
      <FilterBar placeholder="Buscar por nombre, contacto o notas…" />
      <Card>
        {clients.length === 0 ? (
          <EmptyState
            icon={<Users size={24} />}
            title={total === 0 ? "Aún no tienes clientes" : "Sin resultados"}
            description={total === 0 ? "Registra a quién le vendes cuentas, suscripciones o licencias." : "Prueba con otra búsqueda."}
            action={total === 0 ? <Button onClick={() => open("new")}>Crear el primero</Button> : undefined}
          />
        ) : (
          <>
          <Table>
            <thead className="border-b border-navy-100">
              <tr>
                <Th>Cliente</Th>
                <Th>Contacto</Th>
                <Th>Licencias activas</Th>
                <Th>Relación</Th>
                <Th className="w-32" />
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-100">
              {clients.map((c) => (
                <tr key={c.id} className="group hover:bg-navy-50/60">
                  <Td>
                    <Link href={`/clientes/${c.id}`} className="font-medium text-navy-900 hover:text-brand">
                      {c.name}
                    </Link>
                    {(c.platform || c.platform_ref) && (
                      <div className="mt-0.5 text-xs text-slate-500">
                        {c.platform}
                        {c.platform_ref && <span className="text-slate-400"> · {c.platform_ref}</span>}
                      </div>
                    )}
                    {c.notes && <div className="mt-0.5 max-w-xs truncate text-xs text-slate-400">{c.notes}</div>}
                  </Td>
                  <Td>{c.contact ?? <span className="text-slate-400">—</span>}</Td>
                  <Td>
                    {c.active_subscriptions === 0 ? (
                      <span className="text-slate-400">Ninguna</span>
                    ) : (
                      <div className="min-w-[160px]">
                        <div className="flex flex-wrap gap-1">
                          {summarize(c.active_products).map(([p, n]) => (
                            <Badge key={p} tone="success">
                              {p}
                              {n > 1 ? ` ×${n}` : ""}
                            </Badge>
                          ))}
                        </div>
                        {c.next_renewal && (
                          <div className="mt-1 text-xs text-slate-500">
                            Próxima: {fmtDate(c.next_renewal)}{" "}
                            <span className={daysUntil(c.next_renewal)! <= 30 ? "font-medium text-amber-700" : ""}>({renewalTone(daysUntil(c.next_renewal)).label})</span>
                          </div>
                        )}
                      </div>
                    )}
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      <Badge tone="navy">{c.accounts_count} cuentas</Badge>
                      <Badge tone="brand">{c.subscriptions_count} suscrip.</Badge>
                      <Badge>{c.licenses_count} licencias</Badge>
                    </div>
                  </Td>
                  <Td>
                    <div className="flex justify-end gap-1 opacity-70 transition group-hover:opacity-100">
                      <Button size="icon" variant="ghost" aria-label="Editar" onClick={() => open(c)}>
                        <Pencil size={15} />
                      </Button>
                      <Button size="icon" variant="ghost" aria-label="Eliminar" className="hover:text-red-600" onClick={() => setDeleting(c)}>
                        <Trash2 size={15} />
                      </Button>
                      <Link href={`/clientes/${c.id}`} aria-label="Ver detalle" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-navy-700 hover:bg-navy-100/70">
                        <ChevronRight size={16} />
                      </Link>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pagination paging={paging} label="clientes" />
          </>
        )}
      </Card>

      <Dialog open={editing !== null} onClose={close} title={editing === "new" ? "Nuevo cliente" : "Editar cliente"}>
        <ClientForm key={nonce} client={editing === "new" ? null : editing} existingNames={allNames} onDone={close} onCancel={close} />
      </Dialog>
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        pending={pending}
        title="Eliminar cliente"
        description={`Se eliminará "${deleting?.name}". Sus cuentas, suscripciones y licencias se conservan pero quedarán sin cliente asignado.`}
        onConfirm={() => {
          if (!deleting) return;
          start(async () => {
            await deleteClient(deleting.id);
            setDeleting(null);
          });
        }}
      />
    </>
  );
}
