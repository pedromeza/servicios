-- =====================================================================
--  Licencias: tipo (clave o cuenta), vigencia (permanente o anual) y
--  puestos compartidos (p. ej. Microsoft 365 Familia: cuenta principal
--  + hasta 5 usuarios, cada uno con su correo y asignado a un cliente).
--  Ejecuta este archivo en Supabase > SQL Editor > New query
-- =====================================================================
alter table public.licenses
  alter column key_enc drop not null,                                                    -- las de tipo cuenta no tienen clave
  add column if not exists kind text not null default 'key' check (kind in ('key','account')),
  add column if not exists term text not null default 'perpetual' check (term in ('perpetual','annual')),
  add column if not exists purchased_at date,
  add column if not exists expires_at date,                                              -- solo para anuales
  add column if not exists account_email_enc text,                                       -- correo de la cuenta principal (cifrado)
  add column if not exists account_password_enc text,                                    -- contraseña de la cuenta principal (cifrada)
  add column if not exists seats integer not null default 1 check (seats >= 1 and seats <= 50);

create table if not exists public.license_seats (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  license_id uuid not null references public.licenses(id) on delete cascade,
  email_enc  text,                                                                        -- correo del usuario del puesto (cifrado)
  client_id  uuid references public.clients(id) on delete set null,
  position   integer not null default 1,
  created_at timestamptz not null default now()
);

create index if not exists license_seats_user_idx    on public.license_seats(user_id);
create index if not exists license_seats_license_idx on public.license_seats(license_id);

alter table public.license_seats enable row level security;

create policy "propietario" on public.license_seats
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on public.license_seats from anon;
