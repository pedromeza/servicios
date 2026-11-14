-- =====================================================================
--  Cobros de renovación: cada vez que se renueva una suscripción se
--  registra cuánto se cobró y qué periodo cubre. Permite separar lo
--  cobrado en ventas, lo cobrado en renovaciones y lo que viene.
--  Ejecuta este archivo en Supabase > SQL Editor > New query
-- =====================================================================
create table if not exists public.renewal_events (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  renewed_at      date not null default current_date,   -- día en que se cobró
  amount          numeric(12,2) not null default 0,      -- lo que se cobró por renovar
  cost            numeric(12,2) not null default 0,      -- lo que te costó renovar
  currency        text not null default 'MXN',
  from_date       date,                                   -- vencimiento anterior
  to_date         date,                                   -- nuevo vencimiento
  created_at      timestamptz not null default now()
);

create index if not exists renewal_events_user_idx on public.renewal_events(user_id, renewed_at desc);
create index if not exists renewal_events_sub_idx  on public.renewal_events(subscription_id);

alter table public.renewal_events enable row level security;

create policy "propietario" on public.renewal_events
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on public.renewal_events from anon;

notify pgrst, 'reload schema';
