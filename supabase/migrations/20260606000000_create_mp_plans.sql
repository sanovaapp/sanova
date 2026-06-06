-- 20260606000000_create_mp_plans.sql
-- v3.10.10 / worker v1.9.0
-- Armazena IDs dos preapproval_plans MP (mensal/anual) pra
-- /api/mp-create-preapproval montar URL de checkout publico
-- sem amarrar payer_email (que causava 'email não corresponde').

CREATE TABLE IF NOT EXISTS public.mp_plans (
  tipo TEXT PRIMARY KEY CHECK (tipo IN ('mensal', 'anual')),
  mp_plan_id TEXT NOT NULL,
  init_point TEXT NOT NULL,
  reason TEXT,
  amount NUMERIC(10,2),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.mp_plans ENABLE ROW LEVEL SECURITY;
-- Sem policies pra usuario comum — so service_role (no Worker) le/escreve.

COMMENT ON TABLE public.mp_plans IS
  'Planos preapproval MP. 1 row por tipo. Worker cria via /api/admin-ensure-mp-plans e consulta em /api/mp-create-preapproval.';
