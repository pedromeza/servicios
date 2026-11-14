-- =====================================================================
--  Automatizaciones:
--  - recordatorios automáticos (settings.auto_remind, auto_days)
--  - plantilla de WhatsApp (settings.whatsapp_body)
--  - recordatorios enviados por el cron (reminders.kind = 'auto')
--  - importación de Mercado Libre sin duplicados (subscriptions.ml_sale_id)
--  Ejecuta este archivo en Supabase > SQL Editor > New query
-- =====================================================================
alter table public.settings
  add column if not exists auto_remind   boolean not null default false,
  add column if not exists auto_days     text    not null default '30,15,3',   -- días antes del vencimiento en que se avisa
  add column if not exists whatsapp_body text;

alter table public.reminders drop constraint if exists reminders_kind_check;
alter table public.reminders add constraint reminders_kind_check check (kind in ('client','test','auto'));

alter table public.subscriptions
  add column if not exists ml_sale_id text;                                   -- "# de venta" de Mercado Libre

create unique index if not exists subscriptions_ml_sale_idx on public.subscriptions(user_id, ml_sale_id) where ml_sale_id is not null;

notify pgrst, 'reload schema';
