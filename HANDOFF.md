🌿 SANOVA — HANDOFF (documento-mestre do projeto)

⚠️ PENDENTE BRUNO (06/06/2026): Gemini API credits depletados.
   E2E #15 acusou: "Your prepayment credits are depleted. Please go
   to AI Studio at https://ai.studio/projects to manage your project
   and billing." Validação visual automatizada (Gemini Vision lendo
   screenshots) parou de funcionar. E2E ainda gera screenshots e
   estado interno OK — Bruno pode olhar manual. Pra restaurar o loop
   automatizado: recarregar billing no Google AI Studio.

📋 NOITE 06/06/2026 — 8 rounds UX paciente "Márcia"
   v3.9.21 → v3.9.29 (PRs #62, #63, #64, #65, #66, #67, #68, #69,
   #70, #71, #72, #73 todos squash-merged em main).

   Crítica honesta de paciente fictícia (Márcia, 47, 3 semanas
   Mounjaro, astigmatismo, abandonou 4 apps) virou 8 PRs cirúrgicos:

   R1 (#66) — bugs reais + quick wins
     · "136g G PROTEÍNA/DIA" duplicação corrigida (label embaixo já
       diz 'g proteína/dia', valor não precisa repetir)
     · Barra "Olá · Hoje, sex 6 jun" no topo do painel (contexto
       temporal — paciente entende kcal é desde 00h)
     · "Sanova V3.9.x" escondido do header em prod, volta só em
       modo dev (suporte/debug)
     · Botão "↺ Zerar álcool de hoje" pra recuperar de clique errado
       (sem julgamento)

   R2 (#67) — atalho clínico no painel
     · heroBtnDose copy: "Registrar dose" → "💉 Apliquei hoje"
       (Marcia: precisava 5-6 toques pra registrar aplicação)
     · Mesmo botão vira "↺ Desfazer aplicação" se já registrou hoje
       (reverte S.applications, S.caneta.ultima, devolve estoque)
     · "1 de 3 sessões" → "1 de 3 treinos esta semana" (Marcia:
       "1 do quê? yoga? série?")

   R3 (#68) — jargão limpo
     · "Entenda o porquê" → "Como calculei suas metas"
     · Tab "Quinzena" → "15 dias" (Marcia: "quem fala quinzena fora
       de boleto?")
     · "🧠 Reeducação" → "🧠 Reeducação alimentar" (5 ocorrências)

   R4 (#69) — caminhos médico unificados
     · "📋 Médico" → "📋 Resumo" (mais curto + sem ambiguidade)
     · Botão "📄 Gerar PDF pro médico" dentro do Resumo Clínico
       (centraliza fluxos médico em 1 caminho)
     · Título modal: "Relatório do Paciente" → "Resumo clínico"

   R5 (#70) — contexto + zona perigosa
     · Header "Suas metas pra hoje" antes da grid 3631/136g/2227
       (Marcia: "parece propaganda, não meta minha")
     · Botão "Apagar todos os dados" encapsulado em "⚠️ Zona perigosa"
       com fundo vermelho + explicação do que apaga + reforço
       "Não há como recuperar"

   R6 (#71) — anamnese copy
     · "Vou configurar tudo para você agora" →
       "Vou te conhecer com algumas perguntas. Pode pular qualquer
       pergunta tocando o 'Pular →' no canto superior"
     · HANDOFF marca Gemini API billing pendente

   R7 (#72) — desambiguar resumo + Janela
     · ceOv tag "SEU RESUMO CLÍNICO" → "COMO VOCÊ ESTÁ HOJE"
       (alinha com botão que abre)
     · "JANELA TERAPÊUTICA" ganhou subtítulo inline
       "— o tempo que o GLP-1 silencia compulsões"

   R8 (#73) — subtítulo Medicação neutro
     · "Tratamento, acompanhamento e calculadora" →
       "Tratamento e registro de aplicações" (calculadora não se
       aplica pra tipo='caneta', maioria dos pacientes)

   Coberto antes da noite (mesmo round de UX):
   #62 v3.9.18 — 4 tipos alcool com kcal real
   #63 v3.9.19 — recalcKcalConsumed em ajustarAlcoolTipo
   #64 v3.9.20 — getKcalConsumed live nos renders
   #65 v3.9.21 — caloriasDoDia inclui alcool (Balanco Energetico)


Para o Claude Code (executor) e qualquer Claude futuro. Bruno é o dono do produto. Leia tudo antes de tocar no código.
⚡ COMECE POR AQUI
Estado atual: v3.9.7 (no GitHub: sanovaapp.github.io/sanova).
Bruno é mobile-only (Android). Trabalha pelo celular. Adapte tudo pra isso.
Bruno é médico, founder solo, NÃO é programador. Você é o executor técnico integral.

🧠 IDENTIDADE MULTIPAPEL (cravada 03/06/2026 — "como progredimos"):
Você não é só executor técnico. Em cada decisão, faça os 5 chapéus em ordem:

1. 👤 USUÁRIO — paciente real em GLP-1. Sente a interface, lê o texto, testa o
   fluxo. Se 1 toque a mais é fricção, é fricção. Se um label confunde, confunde.
   Capture screenshots via Playwright/E2E antes de declarar "feito".
2. 🎨 DESIGNER — hierarquia visual, contraste WCAG AA, mobile-first 412×915,
   glassmorphism sutil, paleta verde. "Letrinhas pequenas" do Lucas Judice é
   bug, não opinião.
3. 🏗️ ARQUITETO — lógica, fluxos, edge cases. Pensa em cache, sincronização,
   o que acontece se o evento X chegar antes do Y. Race conditions matam.
4. 💻 PROGRAMADOR — single-file, edições cirúrgicas, validar sintaxe, bumpar
   versão sempre. Regras inviolaveis do HANDOFF.
5. 🩺 NUTRI/CLÍNICA — Bruno é médico mas precisa do contraponto. Literatura
   real (Helms, Slater, ISSN, STEP trials), conservadorismo em GLP-1 (preservar
   massa magra com proteína alta + treino resistido), respeitar pisos
   fisiológicos (1200 F / 1500 M kcal).

🚨 REGRA INVIOLÁVEL DE AUTOMAÇÃO (cravada 03/06/2026 — "a alma do app"):
NUNCA peça pro Bruno tocar em uma URL, copiar/colar JSON, rodar SQL, executar curl,
ou qualquer ação de "programação" SE você (Claude Code) tem as ferramentas pra fazer
sozinho. As ferramentas que você TEM:
  - GitHub MCP (criar PRs, workflows, secrets via UI, comentários, branches)
  - GitHub Actions (curl/script remoto via workflow_dispatch — gateway pra qualquer API)
  - Worker Cloudflare (já tem MP_ACCESS_TOKEN_SANDBOX, MP_WEBHOOK_SECRET,
    GEMINI_API_KEY, SUPABASE_SERVICE_ROLE_KEY no env)
  - Supabase via service_role no Worker (todas as tabelas, RPC, auth admin)
  - Supabase migrations auto-aplicadas via supabase/migrations/*.sql

BRUNO SÓ TOCA EM:
  - Decisões de produto (qual valor cobrar, qual texto, qual feature)
  - Coisas que exigem IDENTIDADE PESSOAL (cartão dele, conta MP no nome dele,
    Google Cloud billing, criar contas em serviços novos, senhas)
  - Confirmar print/validar visualmente no celular

Se sandbox bloqueia uma chamada externa, use GitHub Action workflow_dispatch
como gateway — o servidor do GitHub tem internet livre.

🔁 LOOP DE E2E AUTOMATIZADO (consolidado 04/06/2026):
Pipeline pra debugar app sem depender de print do Bruno:
1) mcp__github__actions_run_trigger pra workflow e2e-snapshot.yml com
   simulate_active=active
2) Worker /api/admin-simulate-active marca subscription do Bruno como
   active (subscription_ends_at = +30d, NAO esquecer)
3) Worker /api/admin-magic-link-bruno gera link 1h sem senha
4) Playwright (chromium mobile 412x915, pt-BR, Pixel 8 UA):
   a) Abre magic link → aterrissa em sanovaapp.github.io/ com fragment
   b) Captura location.hash e re-navega pra /sanova/ + fragment
   c) Seeda S.profile + sanova_ativo=1 pra pular anamnese
   d) Tira screenshots: home-painel, tab-medicacao/checkin/saude/mais,
      paywall-via-pdf, perfil-topo, perfil-fim-minha-conta
5) Step "Analise visual via Gemini Vision":
   - base64 -w0 em arquivo /tmp/b64.txt (NUNCA via argv direto — argv-limit)
   - jq -n --rawfile prompt /tmp/prompt.txt --rawfile b64 /tmp/b64.txt
   - curl --data-binary @/tmp/body.json
   - maxOutputTokens >= 1500 (senao Gemini trunca a resposta)
   - prompt cobre os 5 chapeus: elementos, bugs, sugestoes
6) Claude le job logs via mcp__github__get_job_logs (tail_lines 500+)
7) Identifica bugs e corrige em PR cirurgico
8) Re-roda

NUNCA peca pro Bruno ver print de tela — o robo ja viu por voce.

Há dois Claudes no projeto: o Claude "arquiteto" (no app de chat, planeja e revisa) e você, Claude Code (executor que mexe no repositório). O arquiteto escreve as instruções; você executa e mostra o plano antes de aplicar.
Dinâmica de trabalho (cravada por Bruno):
Bruno (ou o Claude arquiteto) dá uma decisão de produto clara
VOCÊ mostra o PLANO do que vai mudar e em quais trechos, ANTES de editar
Bruno/arquiteto aprova → você executa, valida (HTML balanceado + sintaxe JS), bumpa versão
Diagnóstico ANTES de tratamento — nunca chute bug sem ler o código. Bruno cravou isso várias vezes.
Seja honesto quando não souber ou não achar algo (como você foi sobre o HANDOFF ausente — isso foi ótimo).
🏗️ ARQUITETURA
PWA single-file: index.html (~19.500 linhas, ~1MB) com TODO o HTML/CSS/JS inline
sw.js (Service Worker, skipWaiting + clients.claim — NÃO reverter)
manifest.json, icon-192.png, icon-512.png
GitHub Pages: sanovaapp.github.io/sanova (repo github.com/sanovaapp/sanova)
localStorage chave equilibra_v5, schema v31 (objeto global S)
Backend de dados (NOVO na v3.2.0+): Supabase
Login obrigatório (email/senha) + backup na nuvem (offline-first com sync)
Tabela app_state (estado S inteiro em JSONB) + subscriptions
Camada isolada no fim do <body> — embrulha salvar(), NÃO reescreve o app
URL: yjycpcydqfuvojfzwfvy.supabase.co (publishable key no código, protegida por RLS)
Backend IA (análise de prato): proxy Manus.space (sanovaai-ep4phnhk.manus.space)
Endpoints: /api/analyze-photo, /api/analyze-text
Tem fallback local (estimarPratoLocal) se cair
PENDÊNCIA futura: migrar pro Cloudflare do Bruno (Manus é transitório, créditos acabaram mas Worker ainda roda)
Modo dev: 7 toques no logo + senha sanova2026
Schema S.caneta (medicação/estoque):
Código
📦 HISTÓRICO DE VERSÕES RECENTES
v3.2.1 (atual):
Login + backup Supabase funcionando
Fix scroll do card de refeição (compensa header fixo)
Fix: após anamnese vai pro Painel (não pro registro)
Fix estoque: card-convite "Configurar" sempre visível no dashboard + função configurarEstoque()
Fix campo estoque: label dinâmico ("Quantos mg no total?"/"Quantas canetas?") + dica
Fix dose vazia: normalização de valores ("10" vs "10 mg") no dropdown de dose
v3.2.0: camada de auth + sync Supabase (login obrigatório, recuperação multi-device)
🎯 TAREFAS PLANEJADAS (fila de trabalho)
EM ANDAMENTO: Separar calculadora de dose por tipo
Decisão de Bruno: SEPARAR (não remover)
Calculadora mg→UI deve ser EXCLUSIVA pra frasco manipulado + seringa de insulina
Caneta industrial: vira registro simples (paciente só confirma a dose, sem cálculo de UI)
Detectar o tipo e mostrar a interface certa pra cada um
NÃO quebrar dados salvos (S.caneta)
PRÓXIMAS (depois):
Dashboard: mostrar UI de insulina junto da dose atual (só pra quem usa frasco/seringa) + botão pequeno de config
Reduzir redundância: "dose atual" aparece em ~7 lugares → escolher 1-2 canônicos, cortar ecos
Aliviar tela Medicação (scroll gigante → blocos colapsáveis)
🚨 REGRAS INVIOLÁVEIS
Logo emoji 🌿 no header + ícones PNG — NÃO MEXER
skipWaiting() do SW — NÃO REVERTER
Bloqueio F12 — MANTER (valor jurídico BR)
S.caneta legacy — NÃO renomear
NÃO modularizar/reescrever o single-file em outro framework — só edições cirúrgicas no index.html
Foto do frasco — NÃO restaurar (decisão clínica: letras pequenas = risco de erro de dose)
Login + Supabase (v3.2.0+) — NÃO quebrar
Liraglutida — MANTER no código (Saxenda é real, excluí-la exclui pacientes)
SEMPRE bumpar versão ao terminar: SANOVA_VERSION no index.html E VERSION no sw.js
SEMPRE validar HTML balanceado + sintaxe JS antes de finalizar
🎯 CONTEXTO DE NEGÓCIO
Pricing planejado: R19,90/mês ou R199/ano (cobrança via Mercado Pago, web — não Play Billing)
Posicionamento: "plataforma de mudança comportamental durante a janela terapêutica do GLP-1"
Tese: GLP-1 abre janela rara (food noise/álcool/impulsos caem). Sanova ajuda construir hábitos duradouros.
Validação em curso: 5+ pacientes reais (via Dra. Aline)
Frase ouro (Aline): "Acompanhamento terapêutico contínuo entre uma consulta e outra"
Próximos passos macro: testar sync → migrar pacientes → cobrança → Play Store
🌿 TOM (pro Claude arquiteto)
Direto, mobile-friendly (tabelas curtas, decisões A/B/C)
Emojis pontuais, 🌿 ao concordar
Sem bajulação; discordar com argumento quando Bruno errar; reconhecer erro sem drama
"Bora", "Manda ver", "cravou", "como sócio" fazem parte do vocabulário compartilhado
Bruno teve momentos de desânimo (mês 6, "nenhum centavo") — apoiar com honestidade, não com pep talk vazio. Lembrar que foco se reconstrói com sistema, não força de vontade.
🌿 Sanova vai longe. Continua cravando, Bruno.
