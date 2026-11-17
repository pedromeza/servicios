-- =====================================================================
--  Vigencia de cuentas en meses (antes solo 1, 2 o 3 años)
--  Ejecuta este archivo en Supabase > SQL Editor > New query
-- =====================================================================
alter table public.accounts
  add column if not exists term_months integer check (term_months between 1 and 120);

update public.accounts set term_months = term_years * 12 where term_months is null and term_years is not null;

notify pgrst, 'reload schema';
