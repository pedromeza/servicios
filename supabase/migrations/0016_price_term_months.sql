-- =====================================================================
--  Lista de precios: vigencia en meses (0 = permanente), cualquier plazo
--  Ejecuta este archivo en Supabase > SQL Editor > New query
-- =====================================================================
alter table public.price_list
  add column if not exists term_months integer check (term_months between 0 and 120);

update public.price_list set term_months = term_years * 12 where term_months is null;

notify pgrst, 'reload schema';
