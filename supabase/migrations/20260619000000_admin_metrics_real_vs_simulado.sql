-- ============================================================
-- Sanova — Migration: admin_metrics_v1 amplia pra separar pagantes reais
-- vs simulados/demo/fixture (Bruno cravou 19/06/2026: "o admin nao pode mentir").
-- ============================================================
--
-- Problema: a v1 contava `pagantes_ativos = COUNT(status='active')` sem
-- distinguir pagamento real (webhook MP) de simulacoes (admin-simulated-*,
-- demo-*, fixture-simulated-*). Painel mostrava 6 pagantes ativos quando o
-- numero REAL eh 0 (ate hoje — Claudia paga mas webhook nao reconciliou).
--
-- Fix idempotente (CREATE OR REPLACE): v1 ganha colunas novas, mantém
-- compatibilidade com o frontend antigo. Coluna `pagantes_ativos` agora
-- conta SO pagantes reais; total fica em `pagantes_total` (inclui simulados).
-- Frontend antigo passa a mostrar a verdade automaticamente; frontend novo
-- ganha visibilidade extra dos simulados.

CREATE OR REPLACE VIEW public.admin_metrics_v1 AS
WITH active_subs AS (
  SELECT mp_preapproval_id,
    (mp_preapproval_id IS NOT NULL
      AND mp_preapproval_id NOT LIKE 'admin-simulated-%'
      AND mp_preapproval_id NOT LIKE 'demo-%'
      AND mp_preapproval_id NOT LIKE 'fixture-simulated-%') AS eh_real
  FROM public.subscriptions
  WHERE status = 'active'
)
SELECT
  (SELECT COUNT(*) FROM auth.users) AS total_usuarios,
  (SELECT COUNT(*) FROM auth.users WHERE created_at >= NOW() - INTERVAL '7 days') AS cadastros_7d,
  (SELECT COUNT(*) FROM auth.users WHERE created_at >= NOW() - INTERVAL '30 days') AS cadastros_30d,
  (SELECT COUNT(*) FROM public.subscriptions WHERE status = 'trial' AND trial_ends_at > NOW()) AS trial_ativos,
  (SELECT COUNT(*) FROM public.subscriptions WHERE status = 'trial' AND trial_ends_at <= NOW()) AS trial_expirados,
  -- Pagantes REAIS apenas (mp_preapproval_id de pagamento real, nao simulado)
  (SELECT COUNT(*) FROM active_subs WHERE eh_real) AS pagantes_ativos,
  -- Pagantes SIMULADOS / demo / fixture (usado pra debug e visibilidade)
  (SELECT COUNT(*) FROM active_subs WHERE NOT eh_real) AS pagantes_simulados,
  -- Total active (compat: soma reais + simulados)
  (SELECT COUNT(*) FROM active_subs) AS pagantes_total,
  (SELECT COUNT(*) FROM public.subscriptions WHERE status = 'canceled') AS cancelados,
  -- MRR calculado SO em cima dos reais (R$ 19,90 unitario)
  (SELECT COUNT(*) FROM active_subs WHERE eh_real) * 19.90 AS mrr_estimado_brl,
  NOW() AS calculado_em;

-- Notas:
-- - Padroes de mp_preapproval_id que contam como SIMULADO:
--     admin-simulated-*    (admin-simulate-active do worker)
--     demo-*               (admin-seed-demo fixtures: Mariana/Joao/Carla/Dra. Ana)
--     fixture-simulated-*  (admin-fixture-bootstrap E2E)
-- - Pagamento REAL eh aquele que tem mp_preapproval_id vindo do webhook MP
--   (formato hex tipo ce7d87ef74ea415ea081d5d56387b8a4).
