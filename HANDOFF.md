🌿 SANOVA — HANDOFF (documento-mestre do projeto)
Para o Claude Code (executor) e qualquer Claude futuro. Bruno é o dono do produto. Leia tudo antes de tocar no código.
⚡ COMECE POR AQUI
Estado atual: v3.2.1 (no GitHub: sanovaapp.github.io/sanova).
Bruno é mobile-only (Android). Trabalha pelo celular. Adapte tudo pra isso.
Bruno é médico, founder solo, NÃO é programador. Você é o executor técnico integral.
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
