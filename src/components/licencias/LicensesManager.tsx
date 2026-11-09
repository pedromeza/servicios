"use client";

import { CheckCircle2, Pencil, Plus, Ticket, Trash2, Undo2 } from "lucide-react";
import { useCallback, useState, useTransition } from "react";
import { deleteLicense, toggleLicenseUsed } from "@/lib/actions";
import { fmtDate } from "@/lib/format";
import { LICENSE_STATUS, type License, type Option } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui/Card";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";
import { FilterBar } from "@/components/ui/FilterBar";
import { SecretField } from "@/components/ui/SecretField";
import { LicenseForm } from "./LicenseForm";

export function LicensesManager({ licenses, total, available, clients }: { licenses: License[]; total: number; available: number; clients: Option[] }) {
  const [editing, setEditing] = useState<License | "new" | null>(null);
  const [deleting, setDeleting] = useState<License | null>(null);
  const [nonce, setNonce] = useState(0);
  const [pending, start] = useTransition();
  const open = (l: License | "new") => {
    setNonce((n) => n + 1);
    setEditing(l);
  };
  const close = useCallback(() => setEditing(null), []);

  return (
    <>
      <PageHeader
        title="Licencias"
        description={`${total} clave${total === 1 ? "" : "s"} · ${available} disponible${available === 1 ? "" : "s"} · todas cifradas`}
        action={
          <Button onClick={() => open("new")}>
            <Plus size={16} /> Nueva licencia
          </Button>
        }
      />
      <FilterBar
        placeholder="Buscar por producto, cliente o terminación de la clave…"
        filters={[{ name: "status", label: "Estado", options: Object.entries(LICENSE_STATUS).map(([k, v]) => ({ value: k, label: v })) }]}
      />
      <Card>
        {licenses.length === 0 ? (
          <EmptyState
            icon={<Ticket size={24} />}
            title={total === 0 ? "Aún no guardas licencias" : "Sin resultados"}
            description={total === 0 ? "Guarda tus claves de Windows, Office y más. Márcalas como utilizadas cuando las actives." : "Prueba con otros filtros."}
            action={total === 0 ? <Button onClick={() => open("new")}>Guardar la primera</Button> : undefined}
          />
        ) : (
          <Table>
            <thead className="border-b border-navy-100">
              <tr>
                <Th>Producto</Th>
                <Th>Clave</Th>
                <Th>Estado</Th>
                <Th>Cliente</Th>
                <Th>Utilizada</Th>
                <Th className="w-32" />
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-100">
              {licenses.map((l) => (
                <tr key={l.id} className={`group hover:bg-navy-50/60 ${l.status === "used" ? "text-slate-500" : ""}`}>
                  <Td>
                    <div className={`font-medium ${l.status === "used" ? "text-slate-500 line-through decoration-slate-300" : "text-navy-900"}`}>{l.product}</div>
                    {l.notes && <div className="mt-0.5 max-w-xs truncate text-xs text-slate-400">{l.notes}</div>}
                  </Td>
                  <Td>
                    <SecretField entity="license_key" id={l.id} hint={l.key_hint} />
                  </Td>
                  <Td>
                    {l.status === "available" ? (
                      <Badge tone="success">Disponible</Badge>
                    ) : (
                      <Badge tone="neutral">
                        <CheckCircle2 size={11} /> Utilizada
                      </Badge>
                    )}
                  </Td>
                  <Td>{l.client_name ?? <span className="text-slate-400">—</span>}</Td>
                  <Td className="whitespace-nowrap">{fmtDate(l.used_at)}</Td>
                  <Td>
                    <div className="flex justify-end gap-1 opacity-70 transition group-hover:opacity-100">
                      <Button
                        size="sm"
                        variant={l.status === "available" ? "navy" : "secondary"}
                        disabled={pending}
                        onClick={() => start(() => toggleLicenseUsed(l.id, l.status === "available").then(() => undefined))}
                        title={l.status === "available" ? "Marcar como utilizada" : "Volver a disponible"}
                      >
                        {l.status === "available" ? (
                          <>
                            <CheckCircle2 size={14} /> Usar
                          </>
                        ) : (
                          <>
                            <Undo2 size={14} /> Liberar
                          </>
                        )}
                      </Button>
                      <Button size="icon" variant="ghost" aria-label="Editar" onClick={() => open(l)}>
                        <Pencil size={15} />
                      </Button>
                      <Button size="icon" variant="ghost" aria-label="Eliminar" className="hover:text-red-600" onClick={() => setDeleting(l)}>
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

      <Dialog open={editing !== null} onClose={close} title={editing === "new" ? "Nueva licencia" : "Editar licencia"}>
        <LicenseForm key={nonce} license={editing === "new" ? null : editing} clients={clients} onDone={close} onCancel={close} />
      </Dialog>
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        pending={pending}
        title="Eliminar licencia"
        description={`Se eliminará la clave de ${deleting?.product} que termina en ${deleting?.key_hint}. No podrás recuperarla.`}
        onConfirm={() => {
          if (!deleting) return;
          start(async () => {
            await deleteLicense(deleting.id);
            setDeleting(null);
          });
        }}
      />
    </>
  );
}
