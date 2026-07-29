-- ════════════════════════════════════════════════════════════════════
-- Fase 2 Alertas — schema + policies
-- ════════════════════════════════════════════════════════════════════
-- Contexto Fable T49.1 + T50:
--   · 10 alertas totais — 5 imediatos (🔴, sem opt-out) + 5 configuráveis
--     (🟡, opt-in pelo pro)
--   · Framing best-effort, SEM garantia. Linguagem = limiar factual
--     ("kcal < piso por 7d"), não conclusão clínica.
--   · Alertas de emergência (hipoglicemia, dor abdominal severa) — o
--     futuro job emitirá TAMBÉM mensagem ao paciente ("procure
--     atendimento agora"), não só evento pro pro.
-- ════════════════════════════════════════════════════════════════════

-- ─── Preferências por profissional ─────────────────────────────────
-- 1 row por (professional_id, alert_key). Alertas 🔴 (crit_kcal_piso,
-- sintomas_gi, sinais_raros_graves, perda_rapida, dose_atrasada) são
-- sempre 'imediato' — worker ignora tentativas de sobrescrever essas
-- chaves pra 'off'.
create table if not exists public.professional_alert_prefs (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals(id) on delete cascade,
  alert_key text not null,
  frequencia text not null default 'imediato' check (frequencia in ('off','imediato','diario','semanal','mensal')),
  updated_at timestamptz not null default now(),
  unique (professional_id, alert_key)
);

create index if not exists prof_alert_prefs_pro_idx
  on public.professional_alert_prefs (professional_id);

-- ─── Log de eventos de alerta ─────────────────────────────────────
-- Cada deteccao vira 1 row. dedup_key evita re-disparo pra o mesmo
-- limiar dentro de uma janela (definida no worker, ex: 24h pra
-- alertas 🟡 diarios). severity = red|yellow. delivered_via segue
-- multi-valor separado por virgula: 'log', 'push', 'email', 'in_app'.
create table if not exists public.alert_events (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals(id) on delete cascade,
  patient_user_id uuid not null references auth.users(id) on delete cascade,
  alert_key text not null,
  severity text not null check (severity in ('red','yellow')),
  factual_message text not null,
  dedup_key text,
  triggered_at timestamptz not null default now(),
  dismissed_at timestamptz,
  delivered_via text default 'log'
);

create index if not exists alert_events_pro_time_idx
  on public.alert_events (professional_id, triggered_at desc);
create index if not exists alert_events_patient_key_idx
  on public.alert_events (patient_user_id, alert_key);
create index if not exists alert_events_dedup_idx
  on public.alert_events (dedup_key);

-- ─── RLS ──────────────────────────────────────────────────────────
alter table public.professional_alert_prefs enable row level security;
alter table public.professional_alert_prefs force row level security;
alter table public.alert_events enable row level security;
alter table public.alert_events force row level security;

-- Pro le e edita as proprias prefs (o worker impoe as regras
-- adicionais — bloqueia 'off' pras chaves 🔴).
drop policy if exists "pro_reads_own_alert_prefs" on public.professional_alert_prefs;
create policy "pro_reads_own_alert_prefs"
  on public.professional_alert_prefs
  for select
  using (
    professional_id in (
      select id from public.professionals where user_id = auth.uid()
    )
  );

drop policy if exists "pro_upserts_own_alert_prefs" on public.professional_alert_prefs;
create policy "pro_upserts_own_alert_prefs"
  on public.professional_alert_prefs
  for insert
  with check (
    professional_id in (
      select id from public.professionals where user_id = auth.uid()
    )
  );

drop policy if exists "pro_updates_own_alert_prefs" on public.professional_alert_prefs;
create policy "pro_updates_own_alert_prefs"
  on public.professional_alert_prefs
  for update
  using (
    professional_id in (
      select id from public.professionals where user_id = auth.uid()
    )
  )
  with check (
    professional_id in (
      select id from public.professionals where user_id = auth.uid()
    )
  );

-- Pro le eventos dos proprios pacientes vinculados. Escrita SO via
-- Worker (service_role) — nenhuma policy de insert/update pra
-- authenticated.
drop policy if exists "pro_reads_own_alert_events" on public.alert_events;
create policy "pro_reads_own_alert_events"
  on public.alert_events
  for select
  using (
    professional_id in (
      select id from public.professionals where user_id = auth.uid()
    )
  );

-- Pro pode dismissar (marcar dismissed_at) mas so os proprios.
drop policy if exists "pro_dismisses_own_alert_events" on public.alert_events;
create policy "pro_dismisses_own_alert_events"
  on public.alert_events
  for update
  using (
    professional_id in (
      select id from public.professionals where user_id = auth.uid()
    )
  )
  with check (
    professional_id in (
      select id from public.professionals where user_id = auth.uid()
    )
  );

-- Paciente le eventos que citam ele proprio (transparencia LGPD —
-- pode ver o que o pro esta sendo alertado sobre ele).
drop policy if exists "patient_reads_own_alert_events" on public.alert_events;
create policy "patient_reads_own_alert_events"
  on public.alert_events
  for select
  using (patient_user_id = auth.uid());

-- ─── Comentarios permanentes ──────────────────────────────────────
comment on table public.professional_alert_prefs is
  'Preferencias por profissional pra cada chave de alerta. Alertas 🔴 (crit_kcal_piso, sintomas_gi, sinais_raros_graves, perda_rapida, dose_atrasada) sao sempre imediato — worker rejeita off. Ver Fable T49.1 + T50 + migration 20260729010000.';

comment on table public.alert_events is
  'Log de eventos de alerta disparados. severity red|yellow. factual_message = limiar factual (nao conclusao clinica). dedup_key evita re-disparo. Ver migration 20260729010000.';
