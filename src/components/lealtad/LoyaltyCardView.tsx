"use client";

import { Check, Gift, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { deleteReward } from "@/lib/actions";
import { daysUntil, fmtDate } from "@/lib/format";
import { LOYALTY, type LoyaltyCard, type Stamp } from "@/lib/loyalty";
import { renewalTone } from "@/lib/renewal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/Dialog";

const KIND_LABEL: Record<Stamp["kind"], string> = {
  subscription: "Suscripción",
  renewal: "Renovación",
  license: "Licencia",
  seat: "Puesto",
};

export function LoyaltyCardView({ card, onGrant }: { card: LoyaltyCard; onGrant: () => void }) {
  const per = LOYALTY.stampsPerReward;
  const ready = card.rewards_available > 0;
  const [showHistory, setShowHistory] = useState(false);
  const [deleting, setDeleting] = useState<LoyaltyCard["rewards"][number] | null>(null);
  const [pending, start] = useTransition();
  const missing = ready ? 0 : per - card.progress;
  const activeRewards = card.rewards.filter((r) => !r.expires_at || (daysUntil(r.expires_at) ?? 0) >= 0);

  return (
    <Card className={`flex flex-col overflow-hidden ${ready ? "border-brand ring-2 ring-brand/30" : ""}`}>
      <div className={`px-5 py-4 ${ready ? "bg-brand-light" : "bg-navy-50"}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-semibold text-navy-900">{card.client_name}</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              {card.total_stamps} sello{card.total_stamps === 1 ? "" : "s"} en total · {card.rewards.length} premio{card.rewards.length === 1 ? "" : "s"} otorgado
              {card.rewards.length === 1 ? "" : "s"}
            </p>
          </div>
          {ready ? (
            <Badge tone="brand">
              <Gift size={11} /> {card.rewards_available} premio{card.rewards_available === 1 ? "" : "s"} disponible{card.rewards_available === 1 ? "" : "s"}
            </Badge>
          ) : (
            <Badge tone="navy">
              Falta{missing === 1 ? "" : "n"} {missing}
            </Badge>
          )}
        </div>

        {/* Sellos de la tarjeta en curso */}
        <div className="mt-4 flex items-center gap-2">
          {Array.from({ length: per }).map((_, i) => {
            const filled = i < card.progress;
            return (
              <div
                key={i}
                aria-label={filled ? "Sello" : "Pendiente"}
                className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-bold transition ${
                  filled ? "border-brand bg-brand text-white shadow" : "border-dashed border-slate-300 bg-white text-slate-300"
                }`}
              >
                {filled ? <Check size={18} strokeWidth={3} /> : i + 1}
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {ready ? `¡Tarjeta completa! Toca para otorgar: ${LOYALTY.rewardLabel}.` : `Al llegar a ${per} sellos: ${LOYALTY.rewardLabel}.`}
        </p>
      </div>

      <div className="flex flex-1 flex-col gap-3 px-5 py-4 text-sm">
        {activeRewards.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Premios vigentes</p>
            <ul className="mt-1 space-y-1.5">
              {activeRewards.map((r) => {
                const days = daysUntil(r.expires_at);
                const t = renewalTone(days);
                return (
                  <li key={r.id} className="flex items-start justify-between gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-emerald-900">
                    <div className="min-w-0">
                      <div className="font-medium">{r.description}</div>
                      <div className="text-xs text-emerald-700">
                        desde {fmtDate(r.granted_at)}
                        {r.expires_at ? ` · vence ${fmtDate(r.expires_at)}` : " · sin vencimiento"}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {r.expires_at && <Badge tone={t.tone}>{t.label}</Badge>}
                      <Button size="icon" variant="ghost" aria-label="Eliminar premio" className="hover:text-red-600" onClick={() => setDeleting(r)}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <button type="button" onClick={() => setShowHistory((v) => !v)} className="text-xs text-navy-700 underline-offset-2 hover:underline">
            {showHistory ? "Ocultar sellos" : `Ver los ${card.total_stamps} sellos`}
          </button>
          <Button size="sm" onClick={onGrant} variant={ready ? "primary" : "secondary"}>
            <Gift size={14} /> {ready ? "Otorgar premio" : "Otorgar manual"}
          </Button>
        </div>

        {showHistory && (
          <ul className="divide-y divide-navy-100 rounded-lg border border-navy-100 text-xs">
            {card.stamps.length === 0 && <li className="px-3 py-2 text-slate-400">Sin compras registradas todavía.</li>}
            {card.stamps.map((s, i) => (
              <li key={i} className="flex items-center justify-between gap-2 px-3 py-1.5">
                <span className="truncate text-slate-700">
                  <span className="mr-1 inline-block w-5 text-center font-semibold text-brand">{i + 1}</span>
                  {s.label}
                </span>
                <span className="shrink-0 text-slate-400">
                  {KIND_LABEL[s.kind]} · {fmtDate(s.date)}
                </span>
              </li>
            ))}
            {card.rewards.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 bg-emerald-50/60 px-3 py-1.5 text-emerald-800">
                <span className="truncate">
                  <Gift size={11} className="mr-1 inline" />
                  {r.description}
                </span>
                <span className="shrink-0">
                  {r.stamps_used} sellos · {fmtDate(r.granted_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        pending={pending}
        title="Eliminar premio"
        description={`Se eliminará "${deleting?.description}" y los sellos que consumió volverán a contar.`}
        onConfirm={() => {
          if (!deleting) return;
          start(async () => {
            await deleteReward(deleting.id);
            setDeleting(null);
          });
        }}
      />
    </Card>
  );
}
