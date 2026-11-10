-- =====================================================================
--  Vigencia de las cuentas propias: por cuánto tiempo se contrató (1, 2 o 3 años)
--  Ejecuta este archivo en Supabase > SQL Editor > New query
-- =====================================================================
alter table public.accounts
  add column if not exists contracted_at date,                                   -- fecha de contratación
  add column if not exists term_years integer check (term_years in (1, 2, 3));   -- años de vigencia
