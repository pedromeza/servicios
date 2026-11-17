-- =====================================================================
--  Links de pago: reembolsos y contracargos.
--  Se guarda qué registró cada pago para poder deshacerlo si Mercado
--  Pago avisa que el dinero se devolvió.
--  Ejecuta este archivo en Supabase > SQL Editor > New query
-- =====================================================================
alter table public.payment_links drop constraint if exists payment_links_status_check;
alter table public.payment_links add constraint payment_links_status_check check (status in ('pending','paid','cancelled','refunded'));

alter table public.payment_links add column if not exists renewal_event_id uuid references public.renewal_events(id) on delete set null;  -- renovación que registró el pago
alter table public.payment_links add column if not exists sale_id          uuid references public.sales(id) on delete set null;           -- venta suelta que registró el pago
alter table public.payment_links add column if not exists prev_renews_at   date;         -- vencimiento antes del pago
alter table public.payment_links add column if not exists new_renews_at    date;         -- vencimiento que dejó el pago
alter table public.payment_links add column if not exists prev_plan        text;         -- alcance antes del pago
alter table public.payment_links add column if not exists prev_products    text[];
alter table public.payment_links add column if not exists refunded_at      timestamptz;

notify pgrst, 'reload schema';
