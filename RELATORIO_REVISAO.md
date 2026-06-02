# 🌿 Sanova — Briefing para IA Revisora

**Data:** 02 de junho de 2026
**Versão:** v3.9.2 (app) · v1.0.2 (Worker)
**Produção:** https://sanovaapp.github.io/sanova
**Repositório:** https://github.com/sanovaapp/sanova
**Stack:** PWA single-file + Supabase + Cloudflare Worker + Gemini 2.5 Flash

---

## 0. Como usar este documento

Você é uma IA revisora chamada para análise técnica e/ou clínica do Sanova. Este documento é seu briefing completo — leia inteiro antes de opinar. As perguntas específicas para você estão na **seção 12**.

**Você pode (e deve) ser direta.** Bruno valoriza honestidade clínica acima de engajamento. Se algo está clinicamente questionável, fora do escopo, ou tecnicamente arriscado, aponte sem rodeios. Discorde com argumento. Não adule.

---

## 1. Identidade do Produto

**Sanova** é um PWA (Progressive Web App) educativo para pacientes brasileiros em tratamento com agonistas de GLP-1 (Tirzepatida/Mounjaro, Semaglutida/Ozempic/Wegovy, Liraglutida/Saxenda).

**Tese central:** o tratamento com GLP-1 abre uma "janela terapêutica" rara — saciedade reduzida, food noise diminuído, álcool cai naturalmente. O Sanova ajuda o paciente a **construir hábitos duradouros nessa janela**, com foco clínico em **"não murchar"** (preservar massa magra enquanto perde gordura).

**Posicionamento de marca (Aline, médica validadora):**
> "Acompanhamento terapêutico contínuo entre uma consulta e outra"

**Posicionamento regulatório:**
- ❌ NÃO é dispositivo médico ANVISA
- ❌ NÃO prescreve nem ajusta doses
- ✅ É **app educativo** de auto-acompanhamento
- ✅ Para tratamento **já prescrito** por profissional habilitado

**Fundador:** Bruno Ambrozim — médico, founder solo, **mobile-only** (trabalha exclusivamente pelo celular Android). Não é programador. Eu (Claude Code) sou o executor técnico integral.

---

## 2. Restrições Inegociáveis (Bruno cravou)

Estas regras vêm de decisões clínicas, jurídicas ou pragmáticas. Não sugira mudar nenhuma sem justificativa muito forte:

| Regra | Razão |
|---|---|
| **PWA single-file** (`index.html` com todo HTML/CSS/JS inline) | Founder solo, mobile-only, deploy via `git push`. Modularizar = perder velocidade de iteração. |
| **GitHub Pages como hosting do app** | Gratuito, atualização automática via merge na `main`. Não vamos mover. |
| **NÃO modularizar em framework** (React/Vue/Svelte) | Bruno cravou. Edições cirúrgicas no `index.html`. |
| **NÃO renomear `S.caneta`** | Schema legacy. Quebra dados salvos de pacientes ativos. |
| **NÃO restaurar foto do frasco manipulado** | Decisão clínica: letras pequenas = risco erro de dose. |
| **Manter Liraglutida no código** | Saxenda existe; remover excluiria pacientes que usam. |
| **`skipWaiting()` no Service Worker** | Garante que paciente sempre pega versão nova. |
| **Logo emoji 🌿 no header + ícones PNG** | Identidade visual. |
| **Bloqueio F12** | Valor jurídico no Brasil (dificultar engenharia reversa). |
| **Login obrigatório + Supabase sync** (v3.2.0+) | LGPD + recuperação multi-device. |
| **SEMPRE bumpar versão** no `SANOVA_VERSION` (index.html) E `VERSION` (sw.js) | Caso contrário paciente fica no cache antigo. |
| **SEMPRE validar HTML balanceado + sintaxe JS** antes de finalizar | Já tivemos regressões. |

---

## 3. Arquitetura Técnica

```
┌──────────────────────────────────────────────────────────────────┐
│  PACIENTE (Android, Chrome)                                      │
│  abre https://sanovaapp.github.io/sanova                        │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  GITHUB PAGES — index.html (21.478 linhas, ~1MB)                │
│  Tudo inline: HTML + CSS + JS. Service Worker (sw.js, 75 linhas)│
│  Estado local: localStorage chave "equilibra_v5" (objeto S)     │
└──┬────────────────────────────────────┬──────────────────────────┘
   │ (sync opcional)                    │ (análise de prato)
   ▼                                    ▼
┌──────────────────────────┐  ┌──────────────────────────────────┐
│  SUPABASE                │  │  Cloudflare Worker               │
│  - Auth (email/senha)    │  │  sanova-api.contatosanovaapp    │
│  - Tabela app_state      │  │  .workers.dev                    │
│    (JSONB do S inteiro)  │  │  191 linhas (worker/src/)       │
│  - Tabela subscriptions  │  │  Endpoints:                     │
│  - RLS habilitado        │  │   POST /api/analyze-photo        │
│                          │  │   POST /api/analyze-text         │
│                          │  │   GET /api/health                │
│                          │  │   GET /api/debug-gemini          │
└──────────────────────────┘  └────────────┬─────────────────────┘
                                           │ (chave escondida no Worker)
                                           ▼
                              ┌──────────────────────────────────┐
                              │  Google Gemini 2.5 Flash         │
                              │  Conta: contatosanovaapp@gmail   │
                              │  Plano: PAGO (LGPD compliant)    │
                              └──────────────────────────────────┘
```

**Características importantes:**
- Estado do paciente vive primariamente no `localStorage` do celular. Supabase é backup/sync.
- Worker isola a `GEMINI_API_KEY` — paciente nunca vê a chave.
- Worker tem **fallback** no client: se cair, `estimarPratoLocal()` faz estimativa heurística no celular.
- Deploy do Worker: GitHub Actions automático em qualquer push em `worker/**`.
- Deploy do app: GitHub Pages automático em merge na `main`.

---

## 4. Estrutura de Dados (objeto `S`)

```js
// localStorage chave "equilibra_v5", schema_version: 31
S = {
  profile: {
    name, age, sex, weightKg, heightCm,
    weightStartKg,           // peso inicial pra cálculo de evolução
    atividade,               // 'sedentario'|'leve'|'moderado'|'alto'
    exercicioResistido,      // bool — pega últimos 14 dias dos checkins
    objetivo,                // 'emagrecer'|'reconstruir'|'manter' (v3.8.4)
    comorbidades: []
  },
  caneta: {                  // legacy name, NUNCA renomear
    tipo,                    // 'caneta'|'frasco'
    farmaco,                 // 'tirzepa'|'sema'|'lira'
    dose,                    // mg ou UI dependendo do tipo
    estoque, ...
  },
  daily: [{                  // checkins diários
    date, saciedade, fome, peso, sintomas:[], notas, aplicouHoje,
    waterMl, proteinG, kcal, carboG, gorduraG, ...
  }],
  ciclo: {                   // menstrual (opcional, ativável)
    ultimaMenstr, duracao, durMenstr, usaAnticonc
  },
  progressao: {              // Jornada Sanova
    camadasDesbloqueadas: [1,2,3,4],
    modoAvancadoAtivado: false,
    diasAtivos, checkinsTotais
  },
  assinatura: { plano, status, ... },
  _meta: { schemaVersion, ... }
}
```

---

## 5. Mapeamento Crítico do Código

Pontos-chave do `index.html` (21.478 linhas):

| Linha | O que é |
|---|---|
| 82 | CSP (Content Security Policy) |
| 5823 | `SANOVA_API_URL` = URL do Worker |
| 5827 | `SANOVA_VERSION = '3.9.2'` |
| 5836 | `SCHEMA_VERSION = 31` |
| 5858 | `migrarDados()` — migrações de schema |
| 5925-6309 | Bloco do ciclo menstrual |
| 6427-6471 | Modo dev (senha SHA-256) |
| 6943 | `var CAMADAS` — critérios de desbloqueio das camadas |
| 7114-7118 | `OBJETIVOS` — config dos 3 objetivos (emagrecer/reconstruir/manter) |
| 8843-8895 | `calcProteinaMeta()` — fórmula de proteína por objetivo + atividade + resistido |
| 9078-9079 | Aplicação do piso de proteína por objetivo |
| 9166 | `calcMetrics()` — métricas globais (TDEE, meta calórica, etc) |
| 9305-9347 | `CAMADAS_DETALHE` — itens prometidos em cada camada (com selo "Bônus em breve") |
| 9486-9610 | `renderJornada()` — UI da Minha Jornada |
| 12569-12690 | Barra de calorias dinâmica por objetivo (v3.8.8/v3.8.9) |
| 12697 | `abrirInfoProteina()` — modal educativo de proteína |
| 15968 | `fetch` da `analyze-photo` (chamada Worker) |
| 17861 | `fetch` da `analyze-text` (chamada Worker) |
| 18570-18933 | `renderRelatorio()` — narrativa semanal completa |
| 18616-18661 | `setObjetivo()` — troca de objetivo + toast educativo |
| 18635-18652 | `renderCardObjetivoPainel()` — card do objetivo no Painel |
| 19803 | `window.SANOVA_API_URL` (fallback) |

---

## 6. Versões Recentes (changelog técnico)

### v3.9.x — Infra própria + reframe positivo

| Versão | Commit | O que mudou |
|---|---|---|
| **v3.9.2** | `00dc6c6` | Selo "🛠️ Em construção" → **"🎁 Bônus em breve"** (amber → verde). Framing positivo de gaps conhecidos. |
| **v3.9.1** | `c3c4d5e` | **Cutover** `sanovaai-ep4phnhk.manus.space` → `sanova-api.contatosanovaapp.workers.dev`. SW bumped. Fallback local intacto. |
| **v3.9.0** | `bc6c284` | **Selo "Em construção"** em 8 itens das C2/C3/C4 (auditoria honesta). `CAMADAS_DETALHE.itens` aceita `string` OU `{txt, emConstrucao:true}`. |
| `1.0.2` (Worker) | `58f64a3` | **Fix crítico de compat de schema:** Worker aceita `imageBase64` (legado) E `image` (novo); `description` E `text`. |
| `1.0.1` (Worker) | `5237135` | Endpoint `GET /api/debug-gemini` pra diagnosticar billing/quota/modelo. Mascara API key. |
| Worker deploy | `f2741e4` | GitHub Action `.github/workflows/deploy-worker.yml` — deploy automático em push em `worker/**`. |

### v3.8.x — Objetivos + recalibragem clínica

| Versão | Commit | O que mudou |
|---|---|---|
| **v3.8.9** | `77e1b09` | **Recalibragem da barra de calorias em Reconstruir** (faixas honestas para GLP-1) + toast educativo quando proteína já saturada + Modo avançado clarificado. |
| **v3.8.8** | `38f3ed6` | Barra de calorias **dinâmica por objetivo** (faixas + cores + mensagens diferentes). Bug clínico crítico — antes mostrava sempre as faixas de Emagrecer. |
| **v3.8.7** | `7296638` | **Visibilidade do objetivo**: step na anamnese + card sempre visível no Painel + função `renderCardObjetivoPainel()`. |
| v3.8.6 | `de28b06` | Fix: subtítulo do gráfico de peso reflete histórico completo. |
| v3.8.5 | `f41fc61` | Fix: contraste dos cards de objetivo no fundo claro. |
| **v3.8.4** | `585de8c` | **Feature: 3 objetivos** (emagrecer/reconstruir/manter) com multiplicadores próprios de proteína e calorias. |
| v3.8.3 | `b322d5d` | Fix: persistência da anamnese em tempo real (bug levantado pelo Lucas Judice). |
| v3.8.2 | `6675526` | Relatório clínico profissional completo. |

### Características importantes da v3.8.9 (recalibragem de Reconstruir)

A barra anterior tinha 4 faixas para o objetivo *Reconstruir*:
- Déficit: 0 → GET (ocupava 77% da barra)
- Ideal: GET → GET×1.10 (janela de só 251 kcal, 7.7% da barra)
- Excesso: GET×1.10 → GET×1.20
- Muito alto: > GET×1.20

**Problema clínico:** paciente em GLP-1 com saciedade reduzida ficava o dia inteiro no vermelho ("Déficit + treino = perda muscular") mesmo em déficit pequeno de 1 dia. Demoralizante e clinicamente exagerado.

**Recalibragem:**
- Muito baixo: 0 → GET×0.85 (vermelho)
- Subótimo: GET×0.85 → GET (amarelo — "manutenção, não constrói")
- ✅ Ideal: GET → GET×1.20 (verde — janela de 501 kcal, 14.8% da barra)
- Excesso: GET×1.20 → GET×1.35 (vermelho)

E a label central deixou de ser "X kcal meta" (ambígua: era `idealMax`, mas o resto do app usa `M.meta = GET×1.05`) e virou **"X–Y kcal · zona ideal"**.

---

## 7. Funcionalidades por Camada (estado atual)

### Camada 1 — Essencial (100% entregue)
- Registro de medicação (caneta industrial ou frasco manipulado)
- Calculadora de dose mL/UI para frasco manipulado
- Check-in diário (saciedade, sintomas, notas, água, peso opcional)
- Biblioteca de sintomas com orientações educativas
- Acompanhamento de peso com tendência (média móvel 7 dias)

### Camada 2 — Análise educativa (75% entregue)
- ✅ Padrões da semana cruzados automaticamente (`renderRelatorio()`)
- 🎁 Bônus em breve: Leitura por fase da medicação (sabe "semana N", não educa o que esperar)
- ✅ Sugestões educativas (lógica if/else cobrindo proteína/água/exercício/sintomas)
- ✅ Relatório semanal personalizado (narrativa com 7 pilares + insights clínicos)

### Camada 3 — Preservação (25% entregue)
- 🎁 Bônus em breve: Estimativa de gordura × massa magra (perímetros) — **zero código hoje**
- 🎁 Bônus em breve: Fotos de progresso (rosto, corpo) — **zero código hoje**
- 🎁 Bônus em breve: Protocolo de proteína refinado pelo treino — cálculo OK, educação contextual falta
- ✅ Ciclo menstrual integrado (`cicloAtivo`, `calcularFaseCiclo`, `getFaseEducacao` com 5 fases)

### Camada 4 — Avançado (0% entregue, todos como "Bônus em breve")
- 🎁 Detecção automática de platôs (28+ dias)
- 🎁 Plano de transição ao parar a medicação
- 🎁 Rastreamento de lote e farmácia (paciente de manipulado)
- 🎁 Personalização de cards do painel

---

## 8. Compliance e Privacidade

**LGPD:**
- Dados do paciente ficam exclusivamente no `localStorage` do celular
- Sync opcional via Supabase com Row-Level Security (RLS)
- Login obrigatório (email/senha) com recuperação multi-device
- Análise de prato via **Gemini pago** (não usa dados para treinar IA do Google)
- Sem ads, sem rastreamento, sem venda de dados

**Aviso legal:**
- Termos de uso v1.1 com aceite explícito (campo `_meta.termoAceitoEm`)
- Não é dispositivo médico, não prescreve, não atende emergência
- Bloqueio F12 (DevTools) — proteção jurídica BR

**Próximos requisitos legais (pendentes):**
- CNAE 6202-3/00 na empresa antes do Mercado Pago em produção
- Backup semanal automatizado do Supabase (boa prática, ainda manual)

---

## 9. Decisões de Produto Notáveis

### Decisão 1 — "Bônus em breve" em vez de "Em construção"
**Contexto:** auditoria de 02/06/2026 revelou 8 features prometidas mas não entregues. Risco de *bait-and-switch* legal. Decisão Bruno: **Opção C** (selo de transparência + construir antes do paywall, em vez de remover do copy ou construir tudo agora).

**v3.9.2 reframe:** o selo virou positivo (🎁 verde) em vez de avisador (🛠️ amber). Mesma transparência, framing oposto: "olha o que vem a mais" em vez de "olha o que falta".

### Decisão 2 — Worker próprio antes da cobrança
**Motivação:** Manus.space era alugado e transitório. Para LGPD e Mercado Pago, infra precisa ser nossa. Migração completa em 02/06/2026 — sem cair nenhuma feature.

### Decisão 3 — Modo avançado clarificado
**Contexto:** o "Modo avançado" desbloqueia C2+C3+C4 imediatamente (escape hatch pra pacientes experientes). Lucas Judice ativou e não viu diferença porque estava na C1 já. Reescrito o texto pra explicar **o que muda** (libera abas Saúde/Mais) e **o que NÃO muda** (cálculos, metas).

### Decisão 4 — Cobrança por último
**Bruno cravou:** mesmo que tecnicamente o Mercado Pago seja simples de integrar, a ordem agora é:
1. Estrutural do app (infra ✅, gaps reais das camadas)
2. UX/redesign visual
3. Cobrança (Mercado Pago sandbox → produção)

### Decisão 5 — Reframe das faixas de Reconstruir (v3.8.9)
**Origem:** feedback Lucas Judice ("392 kcal aparece como deficitário; ideal deveria ser ~3100"). Recalibrada janela ideal para 501 kcal (era 251) e adicionada zona-buffer amarela "Subótimo" entre GET×0.85 e GET (substitui o vermelho "Déficit" alarmista).

---

## 10. Convenções e Workflow

**Versionamento:** semver simples (`MAJOR.MINOR.PATCH`). Bump em **toda** entrega. Espelhado em `SANOVA_VERSION` (index.html) e `VERSION` (sw.js).

**Branches:** `claude/<descrição-kebab>` para cada PR. Bruno autorizou merge direto pelo executor (sem aprovação manual em cada um) — ele revisa pós-merge no celular, reverte se quebrar.

**Mensagens de commit:** PT-BR direto, escopo no prefixo (`fix(reconstruir):`, `feat(jornada):`, `docs:`, `ci(worker):`, `ux(jornada):`). Corpo explica o **porquê**, não o **o quê**.

**Validação antes de finalizar:**
- HTML balanceado (sem tag aberta sobrando)
- Sintaxe JS válida (rodar `new Function(body)` em cada `<script>`)
- Versão bumpada

**Deploy:**
- App (PWA): merge na `main` → GitHub Pages atualiza em ~1 min
- Worker: push em `worker/**` na `main` → GitHub Action deploya em ~40s

---

## 11. Gaps Conhecidos / Roadmap

### Críticos (LGPD/legal)
- ✅ Gemini pago (LGPD) — feito em 02/06
- ✅ Servidor próprio (Cloudflare) — feito em 02/06
- ⏳ Backup semanal Supabase (boa prática, ainda manual)
- ⏳ CNAE 6202-3/00 antes do MP produção

### Funcionalidades (8 itens "Bônus em breve")
- C2: educação por fase da medicação (~3-5h)
- C3: perímetros + %gordura (~12-18h)
- C3: fotos de progresso (~20-25h)
- C3: protocolo proteína por treino educativo (~6-8h)
- C4: detecção de platôs (~?)
- C4: plano de transição parar medicação (~?)
- C4: rastreamento lote farmácia (~?)
- C4: personalização cards painel (~?)
**Total mínimo da C3 (perímetros + fotos):** ~32-43h.

### Cobrança / Mercado Pago
- Webhook `/api/mp-webhook` no Worker (stub atual retorna 501)
- Integração checkout sandbox → produção
- Cadeados visuais nas 3 features pagas
- Bruno: cravar quando, depois do redesign

### UX / Design
- Redesign visual (Lucas Judice levantou: fontes pequenas, info demais, sem hierarquia)
- Possibilidade de toggle "Clean × Detalhada" (em discussão, ~12-18h)
- Sugestão alternativa: 1 design refinado + atalho "modo compacto" (~6-10h)

---

## 12. O que pedimos da sua revisão

### Para IA com foco clínico

**Questão 1 — Recalibragem de Reconstruir (v3.8.9):**
As faixas atuais para o objetivo *Reconstruir* em pacientes em GLP-1 + treino resistido são:
- Muito baixo: < GET×0.85
- Subótimo: GET×0.85 a GET
- ✅ Ideal: GET a GET×1.20
- Excesso: > GET×1.20

A literatura de hipertrofia recomenda superávit de 200-500 kcal/dia. Para um GET de 2.505 (caso Lucas, ativo + resistido), o ideal fica em 2.505-3.006. Isso é apropriado? Há contraindicação clínica em paciente em GLP-1? A zona "Muito baixo" começando em GET×0.85 é razoável?

**Questão 2 — Fórmula de proteína:**
`calcProteinaMeta()` (linha 8843) usa base 1.6-2.0 g/kg de massa magra (LBM via fórmula Boer) por idade, +0.1/0.2/0.3 g/kg por atividade (leve/moderada/alta), +0.2 g/kg se resistido detectado nos últimos 14 dias. Objetivo *Reconstruir* impõe piso de 2.0 g/kg. Está clinicamente bem calibrada? Conservadora demais ou agressiva demais?

**Questão 3 — Educação faltante:**
O app calcula "você está na semana 3 de Tirzepatida" mas **não diz** "náusea e vômito são comuns nessa fase, tende a passar em X semanas". Esse gap (Camada 2, marcado "🎁 Bônus em breve") tem prioridade alta? Que conteúdo específico por fase de medicamento você recomendaria?

**Questão 4 — Camada 3 sem perímetros e fotos:**
Paciente desbloqueia a Camada 3 ("Preservação") com 30 dias + 15 check-ins. Hoje encontra **só ciclo menstrual** entregue; perímetros e fotos estão marcados "🎁 Bônus em breve". Marcar como "em breve" é suficiente clinicamente, ou deveríamos pausar o acesso à Camada 3 até construir essas features?

### Para IA com foco de produto/UX

**Questão 5 — Framing "🎁 Bônus em breve":**
O selo amber "🛠️ Em construção" sugeria gap; o atual verde "🎁 Bônus em breve" sugere promessa positiva. Qual o risco de paciente sentir "comprei algo incompleto" ao ver 8 itens marcados assim em camadas que ele desbloqueou? O reframe funciona ou esconde o problema?

**Questão 6 — Hierarquia visual (feedback Lucas):**
Lucas (designer, paciente real) cravou: "letrinhas muito pequenas (11-12px), 4 estilos diferentes, muita informação, paciente se perde, não tem número herói". Avaliando o Painel atual (4 gauges + barra de calorias + card peso + mini-cards), você recomendaria refatoração radical (1 número herói + 4 KPIs grandes) ou ajuste incremental (fontes maiores, mesmo layout)?

**Questão 7 — Toggle clean vs detalhada:**
Bruno está dividido entre (A) construir 2 versões e A/B testar, (B) construir 1 versão refinada com toggle "modo compacto" opcional, (C) só 1 versão. Argumento técnico contra (A): founder solo, divergência em semanas. Argumento contra (C): perde info sobre preferência. Qual você recomenda e por quê?

**Questão 8 — Sequência pré-lançamento:**
Roadmap atual: (1) Bônus em breve → real, (2) redesign visual, (3) Mercado Pago. Faz sentido para começar a cobrar? Há algo crítico de UX ou clínico que mudaria essa ordem?

---

## 13. Como acessar para teste

**App produção:** https://sanovaapp.github.io/sanova

**Conta de teste:** podemos provisionar sob demanda. Para sentir a Jornada completa, idealmente criar paciente fictício com 30+ dias de check-ins simulados (desbloqueia C2 e C3).

**Endpoints públicos (sem auth) para inspeção:**
- `GET https://sanova-api.contatosanovaapp.workers.dev/api/health` — `{ok:true, version:"1.0.2"}`
- `GET https://sanova-api.contatosanovaapp.workers.dev/api/debug-gemini` — Gemini reachability check

**Repositório completo:** https://github.com/sanovaapp/sanova

---

*Documento gerado para IA revisora · Última atualização: 02 de junho de 2026 · v3.9.2*
