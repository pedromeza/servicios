-- =====================================================================
--  Links de pago: qué se renueva (suite o programas elegidos).
--  Al pagarse, la suscripción queda con ese alcance.
--  Ejecuta este archivo en Supabase > SQL Editor > New query
-- =====================================================================
alter table public.payment_links add column if not exists plan     text;     -- 'individual' | 'suite' (null = el de la suscripción)
alter table public.payment_links add column if not exists products text[];   -- programas que cubre (null = los de la suscripción)

notify pgrst, 'reload schema';
