-- ============================================================
-- Sanova — Migration: criar tabela subscriptions
-- Semana 1: Infraestrutura de assinatura (trial + paywall)
-- Autor: Claude (arquiteto-executor) + Bruno (founder)
-- ============================================================

-- 1) Tabela principal: 1 row por paciente
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('trial','active','expired','canceled')),
  trial_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  trial_ends_at TIMESTAMPTZ NOT NULL,
  subscription_started_at TIMESTAMPTZ,
  subscription_ends_at TIMESTAMPTZ,
  mp_subscription_id TEXT,
  mp_preapproval_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- 2) RLS ligado desde o nascimento
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- 3) Paciente so le a propria assinatura
CREATE POLICY "own_subscription_select"
  ON public.subscriptions FOR SELECT
  TO public
  USING (auth.uid() = user_id);

-- 4) Trigger: cria trial de 7 dias automaticamente no signup
CREATE OR REPLACE FUNCTION public.create_trial_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.subscriptions (user_id, status, trial_ends_at)
  VALUES (NEW.id, 'trial', NOW() + INTERVAL '7 days');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_trial_on_signup();

-- 5) Backfill: 14 dias de trial pros pacientes que ja existem
--    (gesto de boa-fe com a base atual da Dra. Aline)
INSERT INTO public.subscriptions (user_id, status, trial_ends_at)
SELECT id, 'trial', NOW() + INTERVAL '14 days'
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.subscriptions);
