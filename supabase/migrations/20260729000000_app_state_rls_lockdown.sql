-- ════════════════════════════════════════════════════════════════════
-- app_state RLS lockdown — trava server-side do espelho profissional
-- ════════════════════════════════════════════════════════════════════
-- Fable T52 pediu confirmacao: mesmo se o pro burlar o CSS (modo dev
-- do browser, DevTools) e chamar supabase.from('app_state').update(...)
-- direto com o JWT dele, o Supabase precisa REJEITAR quando ele tenta
-- escrever no user_id de uma paciente vinculada.
--
-- app_state foi criada direto no dashboard historicamente (nao tem
-- migration commitada). Essa migration eh IDEMPOTENTE: garante RLS
-- ligada + policies estritas mesmo se ja existirem.
--
-- Regra: paciente le/escreve APENAS o proprio row.
--        Pro NAO tem acesso via publishable key — le so via Worker
--        (/api/spectator-state) usando service_role, com validacao
--        do link ativo.
--
-- Se app_state ainda nao existir (setup limpo), a table CREATE cobre.
-- ════════════════════════════════════════════════════════════════════

-- ─── Garante a tabela (no-op se ja existe) ─────────────────────────
create table if not exists public.app_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ─── RLS on ─────────────────────────────────────────────────────────
alter table public.app_state enable row level security;

-- Force RLS mesmo para roles owner (paranoia — impede bypass acidental)
alter table public.app_state force row level security;

-- ─── Policies estritas ────────────────────────────────────────────
-- Cada policy checa auth.uid() = user_id. Pro tem auth.uid() = user_id
-- DELE (na tabela professionals.user_id), nunca da paciente — entao
-- todas as tentativas de INSERT/UPDATE/DELETE sobre patient_user_id
-- retornam 0 rows affected + PGRST116 no PostgREST.

-- DROP + CREATE em vez de "CREATE POLICY IF NOT EXISTS" (nao existe
-- em Postgres <15 e Supabase historico teve versoes assim).

drop policy if exists "own_state_select" on public.app_state;
create policy "own_state_select"
  on public.app_state
  for select
  using (auth.uid() = user_id);

drop policy if exists "own_state_insert" on public.app_state;
create policy "own_state_insert"
  on public.app_state
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "own_state_update" on public.app_state;
create policy "own_state_update"
  on public.app_state
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "own_state_delete" on public.app_state;
create policy "own_state_delete"
  on public.app_state
  for delete
  using (auth.uid() = user_id);

-- ─── Comentario permanente na tabela ────────────────────────────────
-- Serve de documentacao pra quem abrir no dashboard depois.
comment on table public.app_state is
  'RLS estrito: paciente le/escreve so o proprio row. Pro nao tem acesso via publishable key — le via Worker /api/spectator-state (service_role + validacao de link ativo). Ver migration 20260729000000.';

-- ─── Sanity check documentado (nao roda automatico) ────────────────
-- Pra confirmar manualmente no SQL editor do Supabase, logado como pro:
--
--   -- deve retornar 0 rows
--   select count(*) from public.app_state where user_id != auth.uid();
--
--   -- deve falhar com "new row violates row-level security policy"
--   update public.app_state set state = '{"hacked":true}'::jsonb
--     where user_id = '<uuid_de_uma_paciente_vinculada>';
--
--   -- deve falhar do mesmo jeito
--   insert into public.app_state (user_id, state)
--     values ('<uuid_de_uma_paciente>', '{"nope":true}'::jsonb);
