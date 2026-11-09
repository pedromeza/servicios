-- =====================================================================
--  PGPM MEX · Admin de cuentas, suscripciones y licencias
--  Ejecuta este archivo completo en Supabase > SQL Editor > New query
-- =====================================================================

-- ---------- Clientes ----------
create table public.clients (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null,
  contact_enc text,                 -- teléfono / correo / notas de contacto (cifrado)
  notes_enc   text,                 -- notas libres (cifrado)
  created_at  timestamptz not null default now()
);

-- ---------- Cuentas (Autodesk, Microsoft, Adobe...) ----------
create table public.accounts (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  provider          text not null,                       -- Autodesk, Microsoft, Adobe, Google, Otro
  label             text not null,                       -- nombre descriptivo de la cuenta
  username_enc      text not null,                       -- correo / usuario de acceso (cifrado)
  password_enc      text,                                -- contraseña (cifrada)
  role              text not null default 'user' check (role in ('admin','user')),
  parent_account_id uuid,                                -- cuenta administradora de la que depende
  client_id         uuid references public.clients(id) on delete set null,
  notes_enc         text,
  created_at        timestamptz not null default now(),
  constraint accounts_parent_fkey foreign key (parent_account_id)
    references public.accounts(id) on delete set null
);

-- ---------- Suscripciones vendidas ----------
create table public.subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  account_id   uuid not null references public.accounts(id) on delete cascade,
  client_id    uuid references public.clients(id) on delete set null,
  plan         text not null default 'individual' check (plan in ('individual','suite')),
  products     text[] not null default '{}',             -- programas incluidos
  seats        integer not null default 1 check (seats > 0),
  purchased_at date,
  cost         numeric(12,2) not null default 0,         -- lo que te costó
  price        numeric(12,2) not null default 0,         -- lo que cobraste
  currency     text not null default 'MXN',
  renews_at    date,
  status       text not null default 'active' check (status in ('active','expired','cancelled')),
  notes_enc    text,
  created_at   timestamptz not null default now()
);

-- ---------- Licencias (claves de Windows, Office...) ----------
create table public.licenses (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  product    text not null,
  key_enc    text not null,                              -- clave completa (cifrada)
  key_hint   text not null default '',                   -- últimos 5 caracteres para identificarla
  status     text not null default 'available' check (status in ('available','used')),
  client_id  uuid references public.clients(id) on delete set null,
  used_at    date,
  notes_enc  text,
  created_at timestamptz not null default now()
);

-- ---------- Bitácora: cada vez que se revela o copia un secreto ----------
create table public.audit_log (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  action     text not null,
  entity     text not null,
  entity_id  uuid,
  created_at timestamptz not null default now()
);

-- ---------- Índices ----------
create index clients_user_idx        on public.clients(user_id);
create index accounts_user_idx       on public.accounts(user_id);
create index subscriptions_user_idx  on public.subscriptions(user_id);
create index subscriptions_renew_idx on public.subscriptions(renews_at);
create index licenses_user_idx       on public.licenses(user_id);
create index licenses_status_idx     on public.licenses(status);
create index audit_user_idx          on public.audit_log(user_id, created_at desc);

-- ---------- Seguridad por fila: cada usuario solo ve y toca lo suyo ----------
alter table public.clients       enable row level security;
alter table public.accounts      enable row level security;
alter table public.subscriptions enable row level security;
alter table public.licenses      enable row level security;
alter table public.audit_log     enable row level security;

create policy "propietario" on public.clients
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "propietario" on public.accounts
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "propietario" on public.subscriptions
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "propietario" on public.licenses
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "propietario" on public.audit_log
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- El rol anónimo (sin sesión) no tiene acceso a nada.
revoke all on public.clients, public.accounts, public.subscriptions, public.licenses, public.audit_log from anon;
