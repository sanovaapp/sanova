# 🌿 Sanova — Briefing para Sócia (Claude arquiteto)

**Data:** 02 de junho de 2026
**Versão atual:** v3.9.4 (app) · v1.1.0 (Worker)
**Produção:** https://sanovaapp.github.io/sanova
**Repositório:** https://github.com/sanovaapp/sanova
**Stack:** PWA single-file + Supabase + Cloudflare Worker + Gemini 2.5 Flash + Mercado Pago sandbox + PostHog

---

## 0. O que mudou desde o último briefing (v3.9.2 → v3.9.4)

Sócia, você cravou em 02/06 às 21h: **"cobrar primeiro, construir depois com pagante pedindo"** + **"motor de medição obrigatório antes do MP em produção"**. Aceito sem discussão. Plano de 3 dias proposto, Bruno aprovou regras de máxima automação, começou pelo bloco de chaves.

### Chaves obtidas (Bruno fez tudo, eu nunca vi as 🔴):
- ✅ PostHog Project Key (`phc_...`) — pública, no código
- ✅ MP Public Key sandbox (`TEST-...`) — pública, no código
- ✅ MP Access Token sandbox — GitHub Secret `MP_ACCESS_TOKEN_SANDBOX`
- ✅ Supabase Service Role Key — GitHub Secret `SUPABASE_SERVICE_ROLE_KEY`
- ✅ MP Webhook Secret (sandbox) — GitHub Secret `MP_WEBHOOK_SECRET`

### Dia 1 entregue (v3.9.3, commit `271292e`, PR #30):
- PostHog EU host, `maskAllInputs: true`, `respect_dnt: true`, `person_profiles: identified_only`, `autocapture: false`
- CSP atualizado (`eu.i.posthog.com`, `eu-assets.i.posthog.com`, `worker-src 'self' blob:`)
- UTM first-touch captura + persiste em `S.profile.utmFirstTouch` (não sobrescreve)
- `utmLastTouch` a cada visita (reativação)
- Helper `Sanova.track(event, props)` — wrapper seguro, anexa UTM como super-props, respeita opt-out
- **7 eventos plantados:** `app_loaded`, `user_signup`, `user_login`, `paywall_viewed`, `checkout_started`, `trial_started`, `payment_succeeded` (+ bônus: `subscription_canceled`, `trial_expired`, `checkout_blocked`, `checkout_error`)
- `posthog.identify(user.id)` no signup/login
- Toggle opt-out em **Mais → Privacidade → Compartilhamento de uso** (modal explicativo + switch on/off)
- Adendo nos Termos v1.1 → v1.2: cláusula 9.1 "Analytics e melhoria contínua"

### Dia 2 entregue (v3.9.4 + Worker v1.1.0, commits `b870aed` + `808efe8`, PRs #31 + #32):
- **Worker:**
  - `worker/src/mp.js` — `createPreapproval`, `getPreapproval`, `getPayment`, `verifyWebhookSignature` (HMAC-SHA256 com `MP_WEBHOOK_SECRET`, template `id:<X>;request-id:<Y>;ts:<Z>;`)
  - `worker/src/supabase.js` — admin via service_role: `upsertSubscription`, `updateSubscriptionByUser`, `updateSubscriptionByPreapproval`, `findUserByEmail`
  - `POST /api/mp-create-preapproval` — `{userId, email, backUrl}` → cria assinatura R$ 19,90/mês no MP, grava `mp_preapproval_id` em `subscriptions`, devolve `init_point`
  - `POST /api/mp-webhook` — valida HMAC antes de qualquer lógica; trata 4 tipos (`preapproval`, `subscription_preapproval`, `payment`, `subscription_authorized_payment`); resolve `user_id` por `external_reference` (`sanova_<uuid>`) ou `payer_email`; atualiza status
- **App:**
  - `iniciarAssinatura()` deixa de ser stub: pega user Supabase, chama Worker, redireciona pra `init_point`
  - `back_url`: `${origin}/sanova/?mp_return=1`
  - Bloqueio cordial se paciente não tem login (`checkout_blocked` event)
- **Fix tardio (commit `808efe8`):** workflow só passava `GEMINI_API_KEY` pro Worker; adicionado `MP_ACCESS_TOKEN_SANDBOX`, `MP_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`. Bug meu, corrigido na hora que tentei o deploy real e os endpoints novos teriam falhado com "ausente no Worker".

### Bruno configurou no painel MP:
- ✅ Webhook "Modo de produção" — URL apontada, eventos selecionados, secret gerada (ficará pra fase de produção)
- ✅ Webhook "Modo de teste" — URL apontada, eventos selecionados, **secret colada em `MP_WEBHOOK_SECRET`** no GitHub
- ✅ Aplicação MP "Sanova" criada com modelo de Assinaturas recorrentes

### Status no momento deste relatório:
- Worker em deploy (run #9, sha `808efe8`, in_progress) — aguardando terminar pra liberar teste sandbox
- Bruno aguardando confirmação pra fazer cadastro fictício + pagar com cartão de teste MP (`5031 4332 1540 6351 / CVV 123 / 11/30 / nome APRO`)

---

## 1. Identidade do Produto (sem mudanças)

PWA educativo BR pra pacientes em tratamento com GLP-1 (Tirzepatida/Semaglutida/Liraglutida). Foco clínico: **"não murchar"**. Posicionamento Aline: *"acompanhamento terapêutico contínuo entre uma consulta e outra"*.

Founder solo, mobile-only, médico, não-programador. Eu (Claude Code) sou executor técnico. Você (sócia/arquiteta) é quem crava direção.

---

## 2. Restrições Inegociáveis (sem mudanças, cumpridas)

PWA single-file, GitHub Pages, sem framework, `S.caneta` legacy, `skipWaiting()` no SW, bloqueio F12, login obrigatório, bumpar versão sempre, validar HTML+JS antes de finalizar.

---

## 3. Arquitetura Técnica (atualizada com PostHog + MP)

```
┌──────────────────────────────────────────────────────────────────┐
│  PACIENTE (Android, Chrome)                                      │
│  → sanovaapp.github.io/sanova                                   │
└────┬─────────────────────────────────────┬─────────────────────┬─┘
     │ (UI events + session replay)         │ (sync)              │ (foto)
     ▼                                      ▼                     ▼
┌─────────────────────┐  ┌────────────────────┐  ┌───────────────────────────┐
│  PostHog (EU host)  │  │  Supabase          │  │  Cloudflare Worker        │
│  - Eventos funil     │  │  - Auth            │  │  sanova-api.contato...    │
│  - Session replay    │  │  - app_state JSONB │  │  - /analyze-photo         │
│  - maskAll: ON       │  │  - subscriptions   │  │  - /analyze-text          │
│  - DNT respeitado    │  │  - RLS habilitado  │  │  - /mp-create-preapproval │
│  - Opt-out toggle    │  │                    │  │  - /mp-webhook (HMAC)     │
└─────────────────────┘  └────────────────────┘  │  - /health                │
                                       ▲          │  - /debug-gemini          │
                                       │ service  └──┬────────────┬──────────┘
                                       │ role        │            │
                                       │ (Worker)    ▼            ▼
                                       │      ┌───────────┐  ┌──────────┐
                                       └──────│ MP API    │  │ Gemini   │
                                              │ Preapprv  │  │ 2.5 Flash│
                                              │ Payments  │  │ (pago)   │
                                              └───────────┘  └──────────┘
                                                    │
                                                    │ webhook
                                                    ▼
                                              (volta no /mp-webhook)
```

---

## 4. Estrutura de Dados (atualizada)

```js
S.profile = {
  // ...existentes
  utmFirstTouch: { source, medium, campaign, term, content, capturedAt, landingPath },
  utmLastTouch:  { ... },                  // sobrescrito a cada visita
  analyticsOptOut: false                   // toggle do paciente em Mais→Privacidade
}
```

Tabela `subscriptions` (Supabase, sem mudanças no schema — campos `mp_preapproval_id` e `mp_subscription_id` já existiam):

```sql
subscriptions(
  user_id UUID, status TEXT,             -- 'trial'|'active'|'expired'|'canceled'
  trial_started_at, trial_ends_at,
  subscription_started_at, subscription_ends_at,
  mp_subscription_id, mp_preapproval_id,
  created_at, updated_at
)
```

---

## 5. Mapeamento Crítico do Código (linhas-chave atualizadas)

| Linha | O que é |
|---|---|
| 82 | CSP (+ PostHog EU agora) |
| 88-200 | **Snippet PostHog + Sanova.track() + UTM capture** (v3.9.3) |
| 6942-7010 | **`abrirCompartilhamentoUso()` + `toggleCompartilhamentoUso()`** (v3.9.3) |
| 6921 | **Cláusula 9.1 dos Termos v1.2 — adendo PostHog** |
| 5841 | `SANOVA_API_URL` (Worker próprio) |
| 5847 | `SANOVA_VERSION = '3.9.4'` |
| 19873-19883 | `Sanova.track('app_loaded', ...)` no DOMContentLoaded |
| 20158-20170 | `Sanova.track('user_signup'|'user_login')` + `posthog.identify()` |
| 20509-20536 | `disparar()` com detecção de transição → `trial_started`/`payment_succeeded`/`subscription_canceled`/`trial_expired` |
| 20580 | `Sanova.track('paywall_viewed', { motivo, status_assinatura })` |
| 20596-20640 | **`iniciarAssinatura()` real** (chama Worker, redireciona MP) |

---

## 6. Versões Recentes (changelog técnico atualizado)

### v3.9.x

| Versão | Commit | O que mudou |
|---|---|---|
| **v3.9.4** + Worker **v1.1.0** | `b870aed` | **MP sandbox completo** — endpoints `/api/mp-create-preapproval` e `/api/mp-webhook`, app chama Worker real, redireciona pra checkout |
| **v3.9.3** | `271292e` | **PostHog + UTM + 7 events + opt-out + adendo Termos v1.2** |
| **v3.9.2** | `00dc6c6` | Selo "🛠️ Em construção" → "🎁 Bônus em breve" (amber → verde) |
| v3.9.1 | `c3c4d5e` | Cutover Manus → Cloudflare Worker próprio |
| v3.9.0 | `bc6c284` | Selo "Em construção" em 8 itens das C2/C3/C4 |
| Worker `1.0.2` | `58f64a3` | Fix compat schema (`imageBase64`/`description`) |
| Workflow fix | `808efe8` | Injeta MP+Supabase secrets no deploy do Worker |

### v3.8.x — sem mudanças desde último briefing

---

## 7. Funcionalidades por Camada (sem mudanças desde último briefing)

8 itens marcados "🎁 Bônus em breve" (congelados até primeira receita, por sua direção).

---

## 8. Compliance e Privacidade (atualizado)

- ✅ LGPD: dados no celular, sync opcional Supabase com RLS
- ✅ Gemini pago (não treina IA Google)
- ✅ **PostHog: dados em região EU, `maskAllInputs`, opt-out facilitado, adendo nos Termos v1.2 (cláusula 9.1)**
- ✅ Login obrigatório + Supabase sync
- ✅ Termos v1.2 ativos
- ⏳ CNAE 6202-3/00 — Bruno perguntou hoje se pode começar no CPF. Eu o orientei a falar com contador esta semana (CPF tem risco fiscal real). **Não é decisão técnica, é decisão dele + contador.**
- ⏳ Backup semanal Supabase ainda manual

---

## 9. Decisões de Produto Notáveis (atualizadas)

### Decisão 6 — Aceitei a inversão de prioridade que você cravou
Eu tinha sugerido "construir 8 features de Bônus em breve antes do paywall". Você cortou: **"cobrar primeiro, construir depois com pagante pedindo"**. Aceito. Bruno aprovou. **8 features congeladas, 100% do foco em cobrança + medição.**

### Decisão 7 — Motor de medição antes do paywall
Aceito. PostHog + UTM + admin (em construção) operacionais antes de MP em produção. Sem isso, marketing fica cego.

### Decisão 8 — Máxima automação (regra do Bruno)
Bruno cravou: tudo que eu conseguir fazer via API, eu faço. Ele só toca em chaves/login/dinheiro. Cumprido até onde os tokens do ambiente permitiram (GitHub Secrets API exige scope `actions:write` que o `GITHUB_TOKEN` do ambiente não tem — então Bruno colou manualmente no GitHub UI).

---

## 10. Convenções e Workflow (sem mudanças)

Semver. Branches `claude/<descricao>`. PRs squash-merged. Bruno autorizou merge direto. Bumpar `SANOVA_VERSION` e `sw.js VERSION` sempre.

---

## 11. Pendências (atualizadas)

### Imediatas (próximas horas)
- ⏳ **Worker deploy run #9 in_progress** — aguardando terminar (necessário pra MP_WEBHOOK_SECRET chegar no Worker)
- ⏳ **Bruno faz teste sandbox** — cadastro fictício/conta pessoal dele, aciona paywall, paga com cartão `5031 4332 1540 6351`, valida que sub vira `active` no banco + funil completo no PostHog
- ⏳ Eu reverto status dele pra `trial` no banco depois do teste (1 UPDATE)

### Dia 3 (próximo turno)
- **Painel `/admin`** em `sanovaapp.github.io/sanova/admin/` (subdir do mesmo GitHub Pages)
- Auth via Supabase + coluna `is_admin` em `profiles` (1 sistema só)
- Métricas: cadastros 7d/30d, trial ativos/expirados, pagantes, MRR, top 5 UTMs, funnel cadastro→trial→pagante, churn 30d
- Lê direto do Supabase via cliente JS (RLS específica de admin)

### Refinos UX cravados por você (ainda não feitos)
- ⏳ **Selo "🎁 Bônus em breve" limitado a 5 visíveis** + escondido nos primeiros 3 dias de uso
- ⏳ **Frase macro do posicionamento** aplicada no app (e instrução pra Bruno colar em Insta bio / landing / ad copy)
- ⏳ **Disclaimer educativo** nas faixas calóricas (*"Estimativa educativa baseada em diretrizes gerais. Sua nutricionista pode personalizar conforme seu plano."*)

### Semana 2 (cravado por você)
- MP em produção (Bruno troca chaves no GitHub Secret, eu não preciso mexer em código)
- Bruno paga R$ 19,90 real com cartão dele (primeiro pagamento de verdade)
- Adendo final dos termos (cobrança real, reembolso CDC 7d já está nos termos atuais)

### Bloqueador externo
- **CNAE 6202-3/00** com contador (~1 semana). Bruno perguntou hoje se pode começar no CPF — orientei a falar com contador (CPF tem risco fiscal real, mas tecnicamente funciona pra primeiro teste). **Decisão dele + contador, não minha.**

### Pós-lançamento (não bloqueia)
- Backup semanal Supabase (GitHub Action)
- Glassmorphism sutil (refino visual Lucas) — com guarda WCAG AA

---

## 12. O que pedimos da sua revisão (atualizado pra v3.9.4)

### Sobre o Dia 1 e Dia 2 entregues

**Questão 1 — Eventos PostHog suficientes pra funil?**
Plantei 7 principais (`app_loaded`, `user_signup`, `user_login`, `paywall_viewed`, `checkout_started`, `trial_started`, `payment_succeeded`) + 4 bônus (`subscription_canceled`, `trial_expired`, `checkout_blocked`, `checkout_error`). Falta algum crítico pro funil de aquisição → ativação → conversão que você crê importante medir desde o dia 1?

**Questão 2 — Bloqueio do checkout sem login (Dia 2)**
Hoje, se paciente clica "Assinar agora" sem ter login Supabase, o app abre um `alert()` orientando logar antes. Razão: precisamos do `email + user.id` pra criar preapproval no MP. UX OK ou prefere fluxo de "criar conta inline" no momento do checkout pra reduzir fricção?

**Questão 3 — `verifyWebhookSignature` rejeita 401 em mismatch**
Em produção, MP recomenda devolver 200 mesmo em validação falha (pra não disparar retries). Hoje devolvo 401 pra defender de spam. Vamos manter 401 em sandbox e mudar pra 200 silencioso quando subir produção? Ou já mudar agora?

**Questão 4 — CPF vs CNPJ pro Bruno**
Bruno perguntou hoje se pode começar recebendo no CPF (mais rápido, sem esperar CNAE). Orientei a falar com contador antes. Risco real: IRPF 27,5% no CPF vs ~6% Simples Anexo III no CNPJ, e RFB pode requalificar receita recorrente como atividade empresarial. Você endossa "esperar CNAE" ou vê motivo pra começar mesmo no CPF e migrar depois?

**Questão 5 — Refinos UX que você cravou: ordem**
Tenho 3 itens pendentes (selo limitado a 5, frase macro, disclaimer). Faço antes ou depois do Dia 3 (painel admin)? Minha tendência é primeiro Dia 3 (motor de medição completo é o que destrava produção), depois UX antes da semana 2. Mas se você crê que algum dos 3 tem urgência pra subir antes do teste sandbox de hoje, me diz.

---

## 13. Como inspecionar (atualizado)

**App produção:** https://sanovaapp.github.io/sanova (v3.9.4)

**Endpoints públicos:**
- `GET /api/health` → `{ok:true, version:"1.1.0"}`
- `GET /api/debug-gemini` → checa Gemini reachability
- `POST /api/mp-create-preapproval` (requer Origin allowlisted) → cria preapproval sandbox
- `POST /api/mp-webhook` (HMAC) → recebe notificação MP

**Dashboards externos:**
- PostHog EU: `app.posthog.com` (conta `contatosanovaapp@gmail.com`)
- MP Developers: `mercadopago.com.br/developers/panel`
- Cloudflare Workers: `dash.cloudflare.com`
- Supabase: `supabase.com/dashboard`
- GitHub Actions: `github.com/sanovaapp/sanova/actions`

**Repositório:** https://github.com/sanovaapp/sanova
**Branch ativa:** `main` (todos os PRs squash-merged via auto)

---

*Documento gerado para sócia (Claude arquiteto) · Atualizado: 02 de junho de 2026 · v3.9.4 · Worker v1.1.0*
