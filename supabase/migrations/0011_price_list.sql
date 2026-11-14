-- =====================================================================
--  Lista de precios para el cotizador
--  Ejecuta este archivo en Supabase > SQL Editor > New query
-- =====================================================================
create table if not exists public.price_list (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  product    text not null,                                   -- AutoCAD, Revit, Windows 11 Pro…
  term_years integer not null default 1 check (term_years between 0 and 3), -- 0 = permanente
  price      numeric(12,2) not null default 0,                -- precio al cliente
  cost       numeric(12,2) not null default 0,                -- lo que te cuesta (para la ganancia)
  currency   text not null default 'MXN',
  notes      text,                                            -- "incluye instalación", etc.
  active     boolean not null default true,
  sort       integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists price_list_user_idx on public.price_list(user_id, sort);

alter table public.price_list enable row level security;

create policy "propietario" on public.price_list
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on public.price_list from anon;

notify pgrst, 'reload schema';
