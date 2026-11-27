-- Sanova — de onde o profissional veio (27/11/2026)
-- Leigo: guarda qual anuncio trouxe cada profissional (parametros utm_* do
-- primeiro acesso e o botao clicado). Nenhum dado pessoal. Aditiva.
ALTER TABLE public.professionals ADD COLUMN IF NOT EXISTS origem JSONB;
COMMENT ON COLUMN public.professionals.origem IS
  'De onde o profissional veio (utm_* do primeiro acesso e botao clicado). Sem dado pessoal. Ver migration 20261127010000.';
