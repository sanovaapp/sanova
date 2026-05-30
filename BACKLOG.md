# 📋 Backlog Sanova — próximas sessões

> Pendências cravadas durante a maratona de 28-29/05/2026.
> Cada item vira PR separado na próxima sessão.

## 🎨 Redesign visual progressivo (cravado pelo Bruno em 30/05)

**Feedback do paciente Lucas Judice (designer/da tecnologia):**

> *"Padrão genérico de Cloud com letrinhas muito pequenas. Quatro estilos diferentes, muita informação, paciente se perde. Mudei no meu app pra glassmorphism. Foco em 3-4 números importantes em vez de quinhentas coisas pra prestar atenção."*

**Bruno cravou:** "Aproveitar feedback qualificado. Ele é da tecnologia."

### Fase 1 — Princípios visuais (CSS variables globais)
- [ ] Fonte mínima 14px em texto importante (hoje tem coisa em 11-12px)
- [ ] Hierarquia tipográfica: título 20px / subtítulo 13px / body 14px / label 11px
- [ ] Glassmorphism leve em cards principais (`backdrop-filter: blur(6px)`, opacidade 70-80%)
- [ ] Espaçamento generoso (padding 16-20px em cards principais)
- [ ] "1 KPI herói por seção" + 3-4 secundários
- [ ] Estimativa: ~1h

### Fase 2 — POC no Painel
- [ ] Card herói: peso atual gigante + variação
- [ ] Cards secundários: proteína / água / calorias / saciedade
- [ ] Glassmorphism leve aplicado
- [ ] Mostrar antes/depois pro Bruno + Lucas validarem
- [ ] Estimativa: ~3-4h

### Fase 3 — Expandir nas outras telas críticas
- [ ] Check-in
- [ ] Medicação
- [ ] Saúde
- [ ] Estimativa: ~4-6h

### Notas
- **Não reduzir informação** (Bruno é médico, precisa dos dados). REORGANIZAR em hierarquia.
- **Glassmorphism sutil** (mobile com pouca GPU = laggy se exagerar).
- **Lucas pode ser teste-piloto** das próximas versões (Bruno cravou aceitar).

### Referências visuais do Lucas (30/05/2026, áudio + 4 prints)

Lucas mandou 4 estilos de inspiração:

1. **Liquid Glass** (@letsavee) — pílulas brancas com blur Apple Vision Pro-style
2. **Glassmorphism** (@mitkow_1, foto do capacete) — card translúcido sobre imagem natural
3. **Dashboard tech + gradiente** (@abduly_haidary, "Management Dashboard") — gauge circular + cards de KPI
4. **Dashboard minimalista** (@orbixdashboard, "Donezo") — números grandes (24/10/12/2), paleta verde, cards limpos

**Leitura Claude:** mistura de #4 (estrutura) + #3 (gauge) + #1 sutil (apenas em cards de destaque). Liquid Glass cheio = performance ruim em Android mid-range + atrapalha leitura clínica. Manter foco em hierarquia visual e KPIs grandes.

---

## 🚀 Infraestrutura

### Deploy do Worker `sanova-api`
- `cd worker && npm install`
- `echo "$GEMINI_API_KEY" | npx wrangler secret put GEMINI_API_KEY`
- `npx wrangler deploy`
- Testar `GET /api/health`
- Bruno: depois disso, **trocar URL Manus.space por `sanova-api.contatosanovaapp.workers.dev`** no `index.html` (PR separado pequeno)

### Migrar Gemini Free → Pago
- Antes do lançamento (LGPD: free tier usa dados pra treino)
- Bruno: ativar billing em `console.cloud.google.com` → cartão de crédito
- API key existente vira Tier 1 automaticamente
- Custo previsto: < R$ 10/mês até 1.000 pagantes ativos

### Backup semanal de schema Supabase
- Antes de MP em produção
- GitHub Action que roda toda 2ª-feira: `pg_dump --schema-only` → commit em `supabase/snapshots/`
- Bruno: gera Supabase service_role key e salva como secret no GitHub Action

## 🎨 PRs pendentes do feedback do Bruno (29/05 noite)

### PR #5 — Cards "Aplicar dose" minimal
- Quando `S.caneta.tipo` ainda vazio (raro após v3.6.1 fix), mostrar UI minimal
- Não duplicar aviso clínico
- Já foi parcialmente resolvido na v3.6.1 (default tipo='caneta')

### PR #6 — Defaults inteligentes
- Balanço energético no Painel: pré-selecionar **"Semana"** (não "Hoje")
- Gráfico de peso: mostrar **últimos 30 dias rolling** (não histórico inteiro)

### PR #7 — Conteúdo educativo
- **Proteína**: explicar que "130g de proteína" ≠ 130g de carne. Texto com tabela de teor (frango 31%, carne 26%, ovo 6g/un, iogurte grego 10%, whey 22g/scoop). Exemplo de dia que bate a meta.
- **Locais de aplicação**: corrigir texto "Coxa" único. Cobrir **abdômen + coxa + braço** com rodízio (conforme bula Tirzepatida/Wegovy/Saxenda).

### PR #8 — Auditoria Jornada Sanova avançada
- Análise educativa: confere se realmente entrega o prometido (Padrões cruzados, Leitura por fase do ciclo, Sugestões educativas, Relatório semanal)
- Preservação: confere também (Estimativa gordura × massa magra, Fotos de progresso, Protocolo de proteína refinado, Ciclo menstrual integrado)
- Se prometido ≠ entregue: relatório do gap pra Bruno decidir (cumprir promessa ou ajustar copy)

### PR #9 — Cadeados visuais no paywall
- Mapear IDs DOM das 3 features pagas
- Adicionar overlay/cadeado quando `SanovaAssinatura.temAcesso() === false`
- Ao tocar no cadeado → `SanovaPaywall.abrirModal('feature')`

### PR #10 — Geração real do PDF pro médico
- Implementar com jsPDF (ou similar)
- Dados: peso (gráfico), doses aplicadas, padrão de saciedade, comorbidades
- Botão "Baixar PDF do mês" no menu Mais
- Atrás do paywall (feature paga)

### PR #11 — Mercado Pago: webhook + integração checkout
- `/api/mp-webhook` no Worker (atualiza `subscriptions.status` quando MP confirma pagamento)
- Pra isso precisa Service Role Supabase (Bruno gera e adiciona como env var)
- Função `SanovaPaywall.iniciarAssinatura()` deixa de ser stub e cria preapproval no MP
- Cadastrar webhook URL no painel MP: `https://sanova-api.contatosanovaapp.workers.dev/api/mp-webhook`
- **Testar ciclo sandbox completo**: cadastro → trial → expira → paga (cartão teste MP) → vira `active` → cancela → vira `canceled`

### PR #12 — MP em produção
- Só depois do ciclo sandbox testado e validado
- Bruno: gera Access Token e Public Key de **produção** no painel MP
- Substitui MP_*_SANDBOX por MP_*_PROD nas env vars
- Bruno: adicionar CNAE 6202-3/00 (Desenvolvimento e licenciamento de softwares customizáveis) na empresa via contador antes do MP em prod

## 📝 Atualizar HANDOFF.md
- Cravar decisões da revisão 29/05:
  - Paywall em 3 features: IA prato + Conv UI insulina + PDF pro médico
  - Potência da medicação fica GRATUITA
  - Vitalício pra Aline é manual (sem regra SQL)
  - Protocolo "manda" antes de ação irreversível
- Atualizar tarefas planejadas removendo o que já foi feito
- Mencionar Worker, Cloudflare, Gemini, MP no setup

## 🌿 Lembretes pro próximo Claude
- Bruno é mobile-only — adapte instruções
- HANDOFF é fonte de verdade — lê antes
- Camada `SanovaAssinatura` e `SanovaPaywall` são isoladas — não acopla fundo no app
- Senha do painel dev: hash SHA-256 em `DEV_HASH`. Senha real só Bruno sabe.
- Versão do app: v3.6.1 (após PR #4 do dia 29/05 noite)
- Manter regra inviolável: edições cirúrgicas no `index.html`, NÃO modularizar.
- Aplicar protocolo "manda" antes de:
  - Migrations destrutivas (DELETE/DROP em produção)
  - Cobrança em produção
  - Troca de chave de API viva
  - Push direto em main (não aplica — sempre PR)
