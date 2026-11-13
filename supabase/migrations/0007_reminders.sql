-- =====================================================================
--  Recordatorios de renovación a clientes:
--  - plataforma por la que llegó el cliente (Mercado Libre, WhatsApp…)
--  - plantilla del correo editable (tabla settings, una fila por usuario)
--  - bitácora de recordatorios enviados
--  Ejecuta este archivo en Supabase > SQL Editor > New query
-- =====================================================================
alter table public.clients
  add column if not exists platform     text,            -- Mercado Libre, WhatsApp, Facebook, Directo…
  add column if not exists platform_ref text;            -- usuario o ID del cliente en esa plataforma

create table if not exists public.settings (
  user_id          uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  reminder_subject text,
  reminder_body    text,
  reminder_button  text,
  payment_url      text,                                  -- enlace de pago (publicación de Mercado Libre)
  whatsapp         text,                                  -- número de atención
  logo_url         text,                                  -- opcional: imagen del logo para el correo
  reminder_days    integer not null default 30,           -- ventana de aviso
  updated_at       timestamptz not null default now()
);

create table if not exists public.reminders (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  to_email_enc    text,
  kind            text not null default 'client' check (kind in ('client','test')),
  sent_at         timestamptz not null default now()
);

create index if not exists reminders_user_idx on public.reminders(user_id);
create index if not exists reminders_sub_idx  on public.reminders(subscription_id, sent_at desc);

alter table public.settings  enable row level security;
alter table public.reminders enable row level security;

create policy "propietario" on public.settings
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "propietario" on public.reminders
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on public.settings, public.reminders from anon;

notify pgrst, 'reload schema';
