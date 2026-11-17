-- =====================================================================
--  Estado "No renovada" en suscripciones (el cliente decidió no renovar)
--  Ejecuta este archivo en Supabase > SQL Editor > New query
-- =====================================================================
alter table public.subscriptions drop constraint if exists subscriptions_status_check;
alter table public.subscriptions add constraint subscriptions_status_check check (status in ('active','expired','cancelled','not_renewed'));

notify pgrst, 'reload schema';
