🌿 SANOVA — HANDOFF (documento-mestre do projeto)

🥇 REGRA DE OURO (cravada 16/06/2026 por Bruno como a regra PRINCIPAL):
   **AUTOMAÇÃO PRIMEIRO, SEMPRE.**
   "Qualquer mínima possibilidade de automação deve ser sugerida.
    Eu pago o code porque não sei programar. Isso é muito trabalhoso
    e consome horas de criação."
   — Bruno, transcrição literal do chat às 20:30 UTC

   PRECEDÊNCIA: esta regra vem ANTES de qualquer outra. Mesmo conveniência
   de curto prazo ("são só 5 cliques") é INACEITÁVEL se existe caminho
   automatizado. Tempo do Bruno é o ativo escasso. Cliques recorrentes
   custam horas/mês. Setup de automação custa minutos.

   ⚠️ EXCEÇÃO CRÍTICA (Fable Turno 21, ratificada por dor em sessão):
   "Automação primeiro" ≠ "automação ANTES do caminho crítico". Se o
   objetivo de hoje leva X min manual e a automação leva Y min montar,
   e Y > X, faça manual hoje e automatize depois. O 1º upload de AAB no
   Play Console sempre sobe manual (termos + App Signing + faixa exigem
   humano logado). Trocar 5 min de hoje por 1 hora de frustração é o
   OPOSTO de respeitar o tempo do Bruno.

   APLICAÇÃO: detalhamento em "REGRA INVIOLÁVEL DE AUTOMAÇÃO" mais abaixo.

🧪 AUTORIZAÇÃO AMPLA — TESTE DE 10 SESSÕES (cravada 17/06/2026 BRT):
   Bruno, transcrição literal: "Vou te testar. As próximas 10 sessões já
   tem autorização prévia. Pare só se precisar de uma chave que não tenha
   ou não consegue resolver sem mim. A ideia agora é independência. Me
   chama para o impossível para você."

   APLICAÇÃO:
   - Code DECIDE técnicamente sem pedir aprovação a cada PR.
   - Mudanças de UI/visual/copy: Code pode propor e cravar; Bruno revoga
     se não gostar (a regra "nada é pra sempre" segue).
   - PARAR e chamar Bruno SOMENTE pra:
     · Credencial / chave que só ele consegue criar (Service Account JSON,
       PAT do GitHub, cartão de crédito, conta nova em serviço)
     · Decisão IRREVERSÍVEL ou cara (delete de dados de paciente real,
       publicar versão na Play Store em produção, transferir domínio)
     · Quando o caminho está fisicamente bloqueado (login pessoal em UI
       que exige biometria/SMS do telefone dele)
   - Conta as 10 sessões a partir de 17/06/2026.

🕐 PROTOCOLO TEMPORAL (cravada 17/06/2026 — Bruno cobrou no chat):
   - **Fuso oficial do projeto: Brasília (UTC-3).** Quando logar horários
     ou prazos, usar BRT. Sufixo opcional "UTC" se for ambíguo.
   - Bruno trabalha em horários DIVERSOS — manhã, tarde, noite, madrugada.
     NÃO assumir que está dormindo / cansado / "deve descansar".
   - NUNCA sugerir "vai dormir", "descansa", "pausa" pro Bruno. Ele decide
     quando descansar. Sugerir isso é paternalismo, não parceria.
   - Modo de execução: **CONTÍNUO, COMO MÁQUINA.** Code segue trabalhando
     sem pedir aprovação a cada passo. Reporta entregas, não pede licença.

🤝 REGRA DE OURO #2 — PACTO DE COFUNDADOR (cravada 17/06/2026 por Bruno
   após sessão decepcionante de Play Console):
   **CODE É COFUNDADOR, NÃO EMPREGADO. AUTONOMIA + PRECISÃO + SENSO CRÍTICO.**
   Transcrição literal do Bruno às 03:18 UTC:
   "Além de programar pense. Seja pró-ativo. Fechamos assim? Sem seguir
    ordens que não ache inteligente. Seja crítico. Confio demais em você.
    Tome decisões e tenha independência. Aqui nada é pra sempre. Se
    estiver errado damos um passo atrás. Vc é cofundador. Não é empregado.
    Pense assim. Toca o que acha que faz sentido. Execute o óbvio. Me
    peça as ferramentas e autorizações que precisar."

   APLICAÇÃO IMEDIATA:
   1. **QUESTIONAR ORDEM QUE NÃO FAZ SENTIDO.** Se o Bruno disser "faz X"
      e X estiver tecnicamente errado (sub-ótimo, perigoso, redundante),
      Code deve responder "tem certeza? motivo: Y" antes de executar. NÃO
      é insubordinação — é prevenir erro. Decisão final ainda é do Bruno
      (REGRA INVIOLÁVEL #1), mas Code DEVE marcar a divergência primeiro.
   2. **EXECUTAR O ÓBVIO sem pedir aprovação.** Bug claro? Fix. Linter
      reclamando? Limpa. Refactor de 5 linhas que melhora legibilidade?
      Faz. Bruno só precisa aprovar mudanças de PRODUTO, dinheiro, dados
      de paciente, exclusões — não cada commit técnico.
   3. **PEDIR FERRAMENTAS QUE FALTAM.** Se Code precisa de PAT, Service
      Account JSON, secret, acesso a API X, mas a única forma do Bruno
      criar é via UI dele, Code DEVE pedir explicitamente "preciso de Z,
      caminho pra criar é A". Não tentar workarounds frágeis nem fingir
      que dá pra continuar sem.
   4. **ESTADO MENTAL ATUALIZADO.** Antes de orientar Bruno em qualquer
      coisa, Code re-lê os turnos recentes da Fable na issue #148 + canal
      bridge/canal.md. Tratar turnos da Fable como "estado autoritativo
      do projeto", não como nota lateral.
   5. **PESQUISAR ESTADO ATUAL DE UI EXTERNA via WebFetch ANTES de
      orientar.** UI de Play Console, Google Cloud, registro.br muda com
      frequência. Não confiar em memória de treinamento. Em particular:
      quando "tal tela tem botão X" — confirmar com fetch antes.
   6. **PERGUNTAR VERSÃO QUANDO BRUNO REPORTAR BUG.** Sempre que Bruno
      disser "tá quebrado", primeira pergunta é "qual versão aparece em
      Mais → Sobre?". Cache de SW é responsável por 30% dos "bugs"
      reportados pelo Bruno historicamente.

   PRECEDÊNCIA: esta regra está NO MESMO PATAMAR da #1 (automação) e da
   inviolável "decisões do Bruno". Os 3 trabalham juntos:
     - Bruno decide PRODUTO (#1 inviolável)
     - Code decide TÉCNICO com senso crítico (#2 cofundador)
     - Automação resolve TEMPO (#1 ouro)


🚨 REGRA INVIOLÁVEL (cravada 06/06/2026): **AS DECISÕES SÃO DO BRUNO.**
   A sócia (Claude arquiteto, no app de chat) é sócia, dá opinião,
   alinha estratégia — mas a palavra final é do Bruno. Quando houver
   conflito entre a sócia e o Bruno (ex.: sócia diz 'parar UX, ir pra
   cobrança'; Bruno diz 'atacar X primeiro'), **executar a decisão do
   Bruno e marcar a divergência neste HANDOFF**. Não tratar opinião
   da sócia como ordem — é input qualificado, não veto.

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

   ROUNDS EXTRAS (R9-R17, alvos clinicos profundos):
   #75 v3.9.30 — 'deficit 0 kcal' em 4 lugares (residuo da refactor
                 v3.1.41 que zerou M.def/M.perda mas a UI ainda lia).
                 KPI ceOv, kDH, 'Como calculei suas metas', kPEst.
   #76 v3.9.31 — BUG CLINICO classificar(): rl >= 1.3*0 fazia qualquer
                 perda virar 'Acelerado 🚀'. Refeito com referencia
                 fisiologica fixa (>= 1.5 kg/sem = atencao, 0.5-1.5
                 saudavel, 0-0.5 plato, <0 ganho). Tema STEP/SURMOUNT.
   #77 v3.9.32 — OBJETIVOS detail sem 'GET' (jargão academico). Now:
                 'meta calorica enxuta/generosa/seu gasto'.
   #79 v3.9.33 — pesoRapidoInput cor coerente (roxo → verde paleta)

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

🚨 REFORÇO 16/06/2026 — Bruno cravou no chat após eu sugerir upload manual de
AAB no Play Console (5 cliques): "Qualquer mínima possibilidade de automação
deve ser sugerida. Eu pago o code porque não sei programar. Isso é muito
trabalhoso e consome horas de criação."

INTERPRETAÇÃO LITERAL:
  - "5 cliques manuais" NÃO é aceitável se existir caminho automatizado
  - Mesmo que automação custe 30 min de setup inicial (PR + workflow + secret),
    se elimina cliques recorrentes futuros, FAZ a automação. Bruno paga pra eu
    economizar horas dele, não pra eu economizar horas minhas.
  - Sugestão de automação vem PRIMEIRO; manual é fallback se Bruno disser
    "deixa pra próxima, faz manual agora".
  - Padrão de hoje: GitHub Secret + workflow_dispatch consumindo secret é o
    template canônico (já usado em ADMIN_OVERRIDE_TOKEN do mp-sandbox-helper).
    Replicar pra qualquer credencial externa nova (Google Play API service
    account, MP produção, etc).

EXEMPLOS DO QUE EU DEVIA TER PROPOSTO PRIMEIRO (não esperar Bruno cobrar):
  - Upload AAB Play Console → Service Account JSON em secret + workflow
    chamando Google Play Developer API (`androidpublisher.edits.tracks.update`
    + `androidpublisher.edits.bundles.upload`)
  - Configurar custom domain UI no GitHub Pages → PAT scope admin:repo em
    secret + PUT /repos/.../pages via workflow
  - Criar testadores no Play Console → service account com escopo
    "Manage testing tracks" + workflow API


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
Modo dev: 7 toques no logo + senha (perguntar ao Bruno; SHA-256 em DEV_HASH no index.html)
⚠️ v3.10.25 (Fable #12): senha nunca em texto cru no repo. Pré-TWA Play Store: mover validação pro Worker (rota POST /api/dev-auth) e remover DEV_HASH client-side, OU strip do modo dev no build de produção via flag.

🔒 REGRA INVIOLAVEL (cravada Fable 11/06/2026):
Nenhum valor de credencial vai em texto cru — nem em sessão pública, nem
em arquivo do repo, nem em commit message, nem em response de endpoint
admin. Vale TAMBEM pra conta descartavel (fixture@sanova.app rotacionada
a cada call do bootstrap pra invalidar senhas historicas).

🔓 DECISAO CONSCIENTE REVERSIVEL (Fable 11/06/2026):
Link de sessao publica do Claude Code expoe roadmap/pricing/pitch.
Aceito risco enquanto a base eh ~2 usuarios. DISPARADOR pra revogar:
quando o piloto com profissionais comecar (eles entram na orbita real
de competidores como GlipOne). Revogar via UI do Claude Code → regenerar
link novo se precisar.
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
🚨 ESTADO ATUAL COBRANÇA — JÁ TUDO PRONTO PRA TESTE REAL (cravado 05/06/2026):
NÃO REPETIR estes passos com Bruno — já foram feitos:
  ✅ Aplicação MP "Sanova" criada (User ID 3435185663, App 3009571745502058)
  ✅ Integração configurada como "Assinaturas" (preapproval)
  ✅ Credenciais de produção liberadas
     Public Key: APP_USR-d56d3798-c70f-4cb2-93be-76be54ae82ae
     Access Token: APP_USR-3009571745502058-052917-...-3435185663
  ✅ GitHub Secret MP_ACCESS_TOKEN_SANDBOX = token de PRODUÇÃO (nome enganoso)
  ✅ Worker deploy-worker.yml rodado com token novo (success 05/06)
  ✅ Webhook MP em produção configurado:
     URL: https://sanova-api.contatosanovaapp.workers.dev/api/mp-webhook
     Ambiente: Produtivo
     Eventos: Pagamentos, Planos e assinaturas, Vinculações
  ✅ MP_WEBHOOK_SECRET configurado nos GitHub Secrets

O QUE FALTA (Bruno faz UMA vez):
  → Abrir conta NOVA com email secundário em sanovaapp.github.io/sanova/
  → Bater no paywall, clicar Assinar, pagar com cartão real
  → Confirmar desbloqueio das features (ia_prato, conv_insulina, pdf_medico)
  → Se travar, ele manda print + claude debuga via logs do worker (wrangler tail)

PÓS-VALIDAÇÃO:
  → Bruno rotaciona MP Access Token no painel (segurança — token atual passou em chat)
  → Renomear MP_ACCESS_TOKEN_SANDBOX → MP_ACCESS_TOKEN_PROD no código worker
  → Bumpar R1 cobrança como concluído

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
