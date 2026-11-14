-- =====================================================================
--  Equipo: un ayudante con permisos limitados.
--  - members: a qué dueño pertenece cada ayudante.
--  - app_owner(): el dueño de los datos para el usuario actual (él mismo o su dueño).
--  - Políticas: dueño y ayudantes leen/crean/editan los datos del dueño;
--    solo el dueño borra definitivamente. Ver contraseñas y la papelera
--    se restringen en la app.
--  Ejecuta este archivo en Supabase > SQL Editor > New query
-- =====================================================================
create table if not exists public.members (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users(id) on delete cascade,
  member_id  uuid not null unique references auth.users(id) on delete cascade,   -- un ayudante pertenece a un solo dueño
  email      text not null,
  role       text not null default 'helper' check (role in ('helper')),
  created_at timestamptz not null default now()
);

alter table public.members enable row level security;
drop policy if exists "dueno_gestiona" on public.members;
drop policy if exists "ayudante_se_ve" on public.members;
create policy "dueno_gestiona" on public.members
  for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "ayudante_se_ve" on public.members
  for select to authenticated
  using (member_id = (select auth.uid()));
revoke all on public.members from anon;

-- Dueño de los datos del usuario actual: su dueño si es ayudante, o él mismo.
create or replace function public.app_owner() returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce((select owner_id from public.members where member_id = auth.uid() limit 1), auth.uid())
$$;

alter table public.audit_log add column if not exists actor_email text;   -- quién hizo el cambio (dueño o ayudante)

do $$
declare t text;
begin
  foreach t in array array['clients','accounts','subscriptions','licenses','license_seats','rewards','settings','reminders','renewal_events','price_list','audit_log'] loop
    -- lo que inserta un ayudante pertenece al dueño
    execute format('alter table public.%I alter column user_id set default public.app_owner()', t);
    execute format('drop policy if exists "propietario" on public.%I', t);
    execute format('drop policy if exists "equipo_lee" on public.%I', t);
    execute format('drop policy if exists "equipo_inserta" on public.%I', t);
    execute format('drop policy if exists "equipo_edita" on public.%I', t);
    execute format('drop policy if exists "dueno_borra" on public.%I', t);
    execute format('create policy "equipo_lee" on public.%I for select to authenticated using (user_id = public.app_owner())', t);
    execute format('create policy "equipo_inserta" on public.%I for insert to authenticated with check (user_id = public.app_owner())', t);
    execute format('create policy "equipo_edita" on public.%I for update to authenticated using (user_id = public.app_owner()) with check (user_id = public.app_owner())', t);
    execute format('create policy "dueno_borra" on public.%I for delete to authenticated using (user_id = (select auth.uid()))', t);
  end loop;
end $$;

-- settings tiene user_id como clave primaria: el ayudante lee/edita la fila del dueño (ya cubierto arriba).

notify pgrst, 'reload schema';
