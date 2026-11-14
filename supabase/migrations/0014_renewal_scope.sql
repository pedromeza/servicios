-- =====================================================================
--  Qué se renovó: alcance (suite o individual) y programas de cada cobro de renovación
--  Ejecuta este archivo en Supabase > SQL Editor > New query
-- =====================================================================
alter table public.renewal_events
  add column if not exists plan     text check (plan in ('individual','suite')),
  add column if not exists products text[];

notify pgrst, 'reload schema';
