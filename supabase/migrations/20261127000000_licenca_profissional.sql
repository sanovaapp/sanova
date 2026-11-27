-- ============================================================
-- Sanova — Licenca profissional (27/11/2026)
--
-- Leigo: ate aqui so existia assinatura de paciente. Esta migration cria o
-- "plano pro" (licenca do medico) e a regra que da Premium ao paciente
-- vinculado a um profissional com licenca em dia (ate 30 por profissional).
--
-- Tudo aditivo e idempotente. Nenhuma linha existente perde acesso.
-- ============================================================

-- 1) Tipo de plano em cada assinatura. Padrao: paciente.
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS plano TEXT NOT NULL DEFAULT 'paciente';

ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plano_check;
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_plano_check CHECK (plano IN ('paciente', 'pro'));

-- 2) Plano 'pro' no cadastro de planos do Mercado Pago.
ALTER TABLE public.mp_plans DROP CONSTRAINT IF EXISTS mp_plans_tipo_check;
ALTER TABLE public.mp_plans
  ADD CONSTRAINT mp_plans_tipo_check CHECK (tipo IN ('mensal', 'anual', 'pro'));

-- 3) Quem ja e profissional cadastrado passa a ter a assinatura marcada como
--    'pro'. O status e as datas nao mudam: quem estava sem acesso continua
--    sem acesso e ve a oferta do teste gratis.
UPDATE public.subscriptions s
   SET plano = 'pro'
  FROM public.professionals p
 WHERE p.user_id = s.user_id
   AND s.plano <> 'pro';

-- 4) Premium por vinculo: o paciente tem acesso se estiver entre os 30
--    primeiros vinculos ativos de um profissional com licenca em dia.
--    SECURITY DEFINER porque o paciente nao pode (nem deve) ler a assinatura
--    do profissional; a funcao responde so sim/nao sobre quem pergunta.
CREATE OR REPLACE FUNCTION public.acesso_via_profissional()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.patient_links l
      JOIN public.professionals p ON p.id = l.professional_id
      JOIN public.subscriptions s ON s.user_id = p.user_id
     WHERE l.patient_user_id = (SELECT auth.uid())
       AND l.status = 'active'
       AND s.plano = 'pro'
       AND (
            (s.status = 'active' AND s.subscription_ends_at > now())
         OR (s.status = 'trial'  AND s.trial_ends_at > now())
       )
       AND l.id IN (
         SELECT l2.id
           FROM public.patient_links l2
          WHERE l2.professional_id = p.id
            AND l2.status = 'active'
          ORDER BY l2.consented_at NULLS LAST, l2.id
          LIMIT 30
       )
  );
$$;

REVOKE ALL ON FUNCTION public.acesso_via_profissional() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.acesso_via_profissional() TO authenticated;

COMMENT ON FUNCTION public.acesso_via_profissional() IS
  'true se quem chama e paciente vinculado (entre os 30 primeiros) a profissional com licenca pro em dia. Ver migration 20261127000000.';
