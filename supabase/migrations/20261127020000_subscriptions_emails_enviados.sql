-- Sanova — controle dos e-mails do teste gratis (27/11/2026)
-- Leigo: anota quais e-mails cada assinante ja recebeu, pra nunca mandar o
-- mesmo duas vezes. Aditiva.
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS emails_enviados JSONB NOT NULL DEFAULT '{}'::jsonb;
COMMENT ON COLUMN public.subscriptions.emails_enviados IS
  'Quais e-mails do teste gratis ja foram enviados (chave -> data). Evita envio repetido. Ver migration 20261127020000.';
