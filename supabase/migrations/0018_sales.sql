-- =====================================================================
--  Ventas: precio y costo en licencias + tabla de otras ventas
--  (servicios, hardware, lo que no es licencia ni suscripción).
--  Ejecuta este archivo en Supabase > SQL Editor > New query
-- =====================================================================
alter table public.licenses add column if not exists price    numeric(12,2) not null default 0;   -- lo vendiste en
alter table public.licenses add column if not exists cost     numeric(12,2) not null default 0;   -- te costó
alter table public.licenses add column if not exists currency text not null default 'MXN';
alter table public.licenses add column if not exists platform text;                               -- por dónde se vendió

create table if not exists public.sales (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default public.app_owner() references auth.users(id) on delete cascade,
  client_id  uuid references public.clients(id) on delete set null,
  concept    text not null,                                   -- "Instalación de Windows", "Mouse Logitech"…
  sold_at    date not null default current_date,
  price      numeric(12,2) not null default 0,
  cost       numeric(12,2) not null default 0,
  currency   text not null default 'MXN',
  platform   text,
  notes_enc  text,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists sales_user_idx on public.sales(user_id, sold_at desc);

alter table public.sales enable row level security;
drop policy if exists "equipo_lee" on public.sales;
drop policy if exists "equipo_inserta" on public.sales;
drop policy if exists "equipo_edita" on public.sales;
drop policy if exists "dueno_borra" on public.sales;
create policy "equipo_lee"     on public.sales for select to authenticated using (user_id = public.app_owner());
create policy "equipo_inserta" on public.sales for insert to authenticated with check (user_id = public.app_owner());
create policy "equipo_edita"   on public.sales for update to authenticated using (user_id = public.app_owner()) with check (user_id = public.app_owner());
create policy "dueno_borra"    on public.sales for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.sales from anon;

notify pgrst, 'reload schema';
