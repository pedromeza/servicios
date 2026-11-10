-- =====================================================================
--  Correo asignado a cada suscripción (el usuario final que usa el puesto)
--  Ejecuta este archivo en Supabase > SQL Editor > New query
-- =====================================================================
alter table public.subscriptions
  add column if not exists email_enc text;               -- correo de la suscripción (cifrado)
