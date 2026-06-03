-- ============================================================
-- Sanova — Migration: tabela admins (controle de acesso ao painel /admin)
-- Adicionado em 03/06/2026 — Dia 3 do roadmap pre-cobranca
-- ============================================================

-- 1) Tabela: 1 row por admin autorizado
CREATE TABLE public.admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT
);

-- 2) RLS ligado desde o nascimento
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

-- 3) Admin so le se ele mesmo for admin (visivel apenas pra admins)
CREATE POLICY "admin_self_read"
  ON public.admins FOR SELECT
  TO public
  USING (auth.uid() = user_id);

-- 4) Helper: function is_admin(uuid) com SECURITY DEFINER pra ser chamada
--    via SELECT sem precisar passar pela RLS recursiva.
CREATE OR REPLACE FUNCTION public.is_admin(check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.admins WHERE user_id = check_user_id);
END;
$$;

-- 5) View admin_metrics: dashboard pre-agregado.
--    Acessivel via SECURITY DEFINER pra qualquer authenticated user;
--    o WHERE is_admin() filtra quem realmente ve.
CREATE OR REPLACE VIEW public.admin_metrics_v1 AS
SELECT
  (SELECT COUNT(*) FROM auth.users) AS total_usuarios,
  (SELECT COUNT(*) FROM auth.users WHERE created_at >= NOW() - INTERVAL '7 days') AS cadastros_7d,
  (SELECT COUNT(*) FROM auth.users WHERE created_at >= NOW() - INTERVAL '30 days') AS cadastros_30d,
  (SELECT COUNT(*) FROM public.subscriptions WHERE status = 'trial' AND trial_ends_at > NOW()) AS trial_ativos,
  (SELECT COUNT(*) FROM public.subscriptions WHERE status = 'trial' AND trial_ends_at <= NOW()) AS trial_expirados,
  (SELECT COUNT(*) FROM public.subscriptions WHERE status = 'active') AS pagantes_ativos,
  (SELECT COUNT(*) FROM public.subscriptions WHERE status = 'canceled') AS cancelados,
  (SELECT COUNT(*) FROM public.subscriptions WHERE status = 'active') * 19.90 AS mrr_estimado_brl,
  NOW() AS calculado_em;

-- 6) Para Bruno conceder admin a si mesmo apos rodar essa migration:
--    INSERT INTO public.admins (user_id) SELECT id FROM auth.users WHERE email = 'SEU-EMAIL-AQUI';
