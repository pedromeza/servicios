-- =====================================================================
--  Papelera de suscripciones: al eliminar se marca deleted_at y se oculta;
--  se puede restaurar o borrar definitivamente desde el filtro "Eliminadas".
--  Ejecuta este archivo en Supabase > SQL Editor > New query
-- =====================================================================
alter table public.subscriptions
  add column if not exists deleted_at timestamptz;

create index if not exists subscriptions_deleted_idx on public.subscriptions(deleted_at) where deleted_at is not null;

notify pgrst, 'reload schema';
