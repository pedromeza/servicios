-- =====================================================================
--  Links de pago de Mercado Pago: cada link generado y si ya se pagó.
--  Cuando Mercado Pago avisa el pago (webhook), la app registra sola la
--  renovación o la venta.
--  Ejecuta este archivo en Supabase > SQL Editor > New query
-- =====================================================================
create table if not exists public.payment_links (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default public.app_owner() references auth.users(id) on delete cascade,
  subscription_id  uuid references public.subscriptions(id) on delete set null,  -- si es para renovar
  client_id        uuid references public.clients(id) on delete set null,
  concept          text not null,
  amount           numeric(12,2) not null default 0,
  currency         text not null default 'MXN',
  months           integer not null default 0,         -- meses que renueva (0 = venta suelta)
  mp_preference_id text,
  url              text,
  status           text not null default 'pending' check (status in ('pending','paid','cancelled')),
  mp_payment_id    text unique,
  paid_at          timestamptz,
  created_at       timestamptz not null default now()
);
create index if not exists payment_links_user_idx on public.payment_links(user_id, created_at desc);
create index if not exists payment_links_sub_idx  on public.payment_links(subscription_id);

alter table public.payment_links enable row level security;
drop policy if exists "equipo_lee" on public.payment_links;
drop policy if exists "equipo_inserta" on public.payment_links;
drop policy if exists "equipo_edita" on public.payment_links;
drop policy if exists "dueno_borra" on public.payment_links;
create policy "equipo_lee"     on public.payment_links for select to authenticated using (user_id = public.app_owner());
create policy "equipo_inserta" on public.payment_links for insert to authenticated with check (user_id = public.app_owner());
create policy "equipo_edita"   on public.payment_links for update to authenticated using (user_id = public.app_owner()) with check (user_id = public.app_owner());
create policy "dueno_borra"    on public.payment_links for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.payment_links from anon;

notify pgrst, 'reload schema';
