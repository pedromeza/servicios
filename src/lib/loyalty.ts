/**
 * Reglas de la tarjeta de lealtad (prototipo).
 * Cada compra registrada a un cliente vale 1 sello: una suscripción, cada renovación de esa
 * suscripción, una licencia asignada y cada puesto de licencia asignado. Al juntar
 * `stampsPerReward` sellos, el cliente tiene derecho a un premio que tú otorgas y registras.
 */
export const LOYALTY = {
  stampsPerReward: 5,
  rewardLabel: "1 mes gratis de un programa o cuenta",
  rewardMonths: 1,
} as const;

export type Stamp = { date: string | null; label: string; kind: "subscription" | "renewal" | "license" | "seat" };

export type Reward = {
  id: string;
  description: string;
  stamps_used: number;
  granted_at: string;
  expires_at: string | null;
  notes: string | null;
};

export type LoyaltyCard = {
  client_id: string;
  client_name: string;
  stamps: Stamp[];
  total_stamps: number;
  rewards_earned: number; // premios ganados por sellos acumulados
  rewards: Reward[]; // premios ya otorgados
  rewards_available: number; // ganados - otorgados
  progress: number; // sellos en la tarjeta actual (0..stampsPerReward-1), o stampsPerReward si hay premio pendiente
};

export function buildCard(client_id: string, client_name: string, stamps: Stamp[], rewards: Reward[]): LoyaltyCard {
  const per = LOYALTY.stampsPerReward;
  const sorted = [...stamps].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
  const total = sorted.length;
  const earned = Math.floor(total / per);
  const available = Math.max(0, earned - rewards.length);
  // Si hay premios pendientes la tarjeta se muestra completa; si no, los sellos sobrantes de la tarjeta en curso.
  const progress = available > 0 ? per : total % per;
  return {
    client_id,
    client_name,
    stamps: sorted,
    total_stamps: total,
    rewards_earned: earned,
    rewards,
    rewards_available: available,
    progress,
  };
}
