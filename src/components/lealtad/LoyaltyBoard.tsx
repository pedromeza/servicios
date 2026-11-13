"use client";

import { Gift, Sparkles, Users } from "lucide-react";
import { useCallback, useState } from "react";
import { LOYALTY, type LoyaltyCard } from "@/lib/loyalty";
import { Card, EmptyState, PageHeader } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { FilterBar } from "@/components/ui/FilterBar";
import { Pagination } from "@/components/ui/Pagination";
import type { Page } from "@/lib/paging";
import { LoyaltyCardView } from "./LoyaltyCardView";
import { RewardForm } from "./RewardForm";

export function LoyaltyBoard({ cards, paging, total }: { cards: LoyaltyCard[]; paging: Page; total: number }) {
  const [granting, setGranting] = useState<LoyaltyCard | null>(null);
  const [nonce, setNonce] = useState(0);
  const open = (c: LoyaltyCard) => {
    setNonce((n) => n + 1);
    setGranting(c);
  };
  const close = useCallback(() => setGranting(null), []);

  const ready = cards.filter((c) => c.rewards_available > 0).length;
  const stamps = cards.reduce((n, c) => n + c.total_stamps, 0);

  return (
    <>
      <PageHeader
        title="Lealtad"
        description={`Cada compra o renovación sella la tarjeta del cliente · ${LOYALTY.stampsPerReward} sellos = ${LOYALTY.rewardLabel}`}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Stat icon={<Users size={18} />} label="Clientes con tarjeta" value={String(total)} />
        <Stat icon={<Sparkles size={18} />} label="Sellos acumulados" value={String(stamps)} />
        <Stat icon={<Gift size={18} />} label="Premios por otorgar" value={String(ready)} accent={ready > 0} />
      </div>

      <FilterBar placeholder="Buscar cliente…" />
      {paging.pages > 1 && (
        <Card className="mb-4">
          <Pagination paging={paging} label="clientes" />
        </Card>
      )}

      {cards.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Gift size={24} />}
            title={total === 0 ? "Aún no hay tarjetas" : "Sin resultados"}
            description={
              total === 0
                ? "Las tarjetas se crean solas al registrar clientes. Cada suscripción, licencia, puesto o renovación que les asignes suma un sello."
                : "Prueba con otra búsqueda."
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((c) => (
            <LoyaltyCardView key={c.client_id} card={c} onGrant={() => open(c)} />
          ))}
        </div>
      )}

      <Dialog open={granting !== null} onClose={close} title={granting ? `Otorgar premio a ${granting.client_name}` : "Otorgar premio"}>
        {granting && <RewardForm key={nonce} card={granting} onDone={close} onCancel={close} />}
      </Dialog>
    </>
  );
}

function Stat({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: boolean }) {
  return (
    <Card className="flex items-center justify-between px-4 py-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-0.5 text-2xl font-bold text-navy-900">{value}</p>
      </div>
      <div className={`rounded-xl p-2.5 ${accent ? "bg-brand text-white" : "bg-navy-100 text-navy-700"}`}>{icon}</div>
    </Card>
  );
}
