-- =====================================================================
--  Meses gratis de promoción en cada suscripción (alargan la renovación)
--  Ejecuta este archivo en Supabase > SQL Editor > New query
-- =====================================================================
alter table public.subscriptions
  add column if not exists promo_months integer not null default 0 check (promo_months >= 0 and promo_months <= 24);
