-- ════════════════════════════════════════════════════════════════════
-- Painel Profissional Sanova — Fase 1
-- ════════════════════════════════════════════════════════════════════
-- Cria:
--   · public.professionals  — nutrólogos/nutricionistas/médicos cadastrados
--   · public.patient_links  — vínculos paciente ↔ profissional (LGPD)
--   · storage.buckets entry — pro-assets (foto/logo do profissional)
--
-- Regra de seguranca:
--   · Escrita SEMPRE passa pelo Worker (service_role).
--   · RLS abaixo eh defesa em profundidade pra leitura via publishable key.
--   · NAO criar policy permitindo o profissional ler app_state direto.
--     O profissional so enxerga dados do paciente atraves do Worker, que
--     valida o vinculo ativo.
-- ════════════════════════════════════════════════════════════════════

-- ─── Profissionais ──────────────────────────────────────────────────
create table public.professionals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  nome text not null,
  tipo text not null check (tipo in ('medico', 'nutricionista', 'outro')),
  registro text,                       -- CRM/CRN texto livre, sem validacao na Fase 1
  invite_code text not null unique,    -- formato SAN-XXXX (4 chars, A-Z2-9, sem 0/O/1/I)
  -- Co-branding (§10 do HANDOFF):
  titulo_exibido text,                 -- ex: 'Nutricionista · CRN-3 12345'
  foto_url text,                       -- Supabase Storage, bucket pro-assets
  logo_url text,                       -- idem; opcional
  created_at timestamptz not null default now()
);

create index professionals_invite_code_idx on public.professionals (invite_code);

-- ─── Vinculo paciente ↔ profissional ───────────────────────────────
create table public.patient_links (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals(id) on delete cascade,
  patient_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'revoked')),
  consent_version text not null,       -- ex: 'v1-2026-06'
  consented_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (professional_id, patient_user_id)
);

create index patient_links_pro_status_idx
  on public.patient_links (professional_id, status);
create index patient_links_patient_status_idx
  on public.patient_links (patient_user_id, status);

-- ─── RLS ────────────────────────────────────────────────────────────
alter table public.professionals enable row level security;
alter table public.patient_links enable row level security;

-- Profissional le o proprio cadastro
create policy "pro reads self" on public.professionals
  for select using (auth.uid() = user_id);

-- Profissional le os proprios vinculos; paciente le os vinculos dele
create policy "pro reads own links" on public.patient_links
  for select using (
    professional_id in (
      select id from public.professionals where user_id = auth.uid()
    )
    or patient_user_id = auth.uid()
  );

-- Paciente pode revogar o proprio vinculo (UPDATE apenas; insert e via Worker)
create policy "patient revokes own link" on public.patient_links
  for update using (patient_user_id = auth.uid())
  with check (patient_user_id = auth.uid());

-- ─── Storage bucket pra co-branding ─────────────────────────────────
-- Bucket publico (leitura livre por URL — fotos sao exibidas no app do
-- paciente). Escrita SO via Worker com service_role. Por isso nao criamos
-- policies de insert/update pra authenticated.
insert into storage.buckets (id, name, public)
  values ('pro-assets', 'pro-assets', true)
  on conflict (id) do nothing;
