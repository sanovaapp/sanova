-- ============================================================
-- Sanova — Seed: conceder admin a Bruno (founder)
-- Roda automaticamente apos a migration anterior (admins table) aplicar.
-- Idempotente: ON CONFLICT DO NOTHING se ja existe.
-- ============================================================

INSERT INTO public.admins (user_id, notes)
SELECT id, 'Bruno founder — bootstrap automatico via migration'
FROM auth.users
WHERE email = 'brunoambrozim@hotmail.com'
ON CONFLICT (user_id) DO NOTHING;
