-- =====================================================================
--  Tarjeta de lealtad: renovaciones contadas por suscripción y premios otorgados
--  Ejecuta este archivo en Supabase > SQL Editor > New query
-- =====================================================================
alter table public.subscriptions
  add column if not exists renewals integer not null default 0 check (renewals >= 0);   -- veces que se ha renovado (cada una = 1 sello)

create table if not exists public.rewards (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id   uuid not null references public.clients(id) on delete cascade,
  description text not null,                               -- qué se le dio: "1 mes gratis de AutoCAD"
  stamps_used integer not null default 5,                  -- sellos que consumió este premio
  granted_at  date not null default current_date,
  expires_at  date,                                        -- hasta cuándo dura el beneficio
  notes_enc   text,
  created_at  timestamptz not null default now()
);

create index if not exists rewards_user_idx   on public.rewards(user_id);
create index if not exists rewards_client_idx on public.rewards(client_id);

alter table public.rewards enable row level security;

create policy "propietario" on public.rewards
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on public.rewards from anon;

notify pgrst, 'reload schema';
