-- =====================================================================
--  Papelera en clientes, cuentas y licencias (deleted_at) e historial
--  de cambios en audit_log (detalle legible de cada acción).
--  Ejecuta este archivo en Supabase > SQL Editor > New query
-- =====================================================================
alter table public.clients  add column if not exists deleted_at timestamptz;
alter table public.accounts add column if not exists deleted_at timestamptz;
alter table public.licenses add column if not exists deleted_at timestamptz;

alter table public.audit_log add column if not exists detail text;      -- p. ej. "Edgar Nayar" o "AutoCAD · 1 año"

create index if not exists clients_deleted_idx  on public.clients(deleted_at)  where deleted_at is not null;
create index if not exists accounts_deleted_idx on public.accounts(deleted_at) where deleted_at is not null;
create index if not exists licenses_deleted_idx on public.licenses(deleted_at) where deleted_at is not null;

notify pgrst, 'reload schema';
