# 🌿 Sanova — Relatório de Revisão

**Data:** 02 de junho de 2026
**Versão atual:** v3.9.2 (app) · v1.0.2 (servidor IA)
**App em produção:** [sanovaapp.github.io/sanova](https://sanovaapp.github.io/sanova)

---

## 1. Visão Executiva

O Sanova é um companheiro educativo para pacientes brasileiros em tratamento com GLP-1 (Tirzepatida, Semaglutida, Liraglutida). O foco clínico é **"não murchar"** — preservar massa magra enquanto se perde gordura, e construir hábitos duradouros durante a janela terapêutica.

**O que mudou nas últimas semanas:** entregamos 3 frentes em paralelo — feedback clínico do Lucas Judice (paciente real e designer), recalibragem clínica das metas por objetivo, e migração completa da infraestrutura para servidores próprios.

---

## 2. Estado Atual do App

### O paciente vê hoje:

| Camada | Status |
|---|---|
| **C1 — Essencial** (medicação, check-in, peso, sintomas) | ✅ 100% entregue |
| **C2 — Análise educativa** (padrões, sugestões, relatório semanal) | ✅ 75% entregue · 1 item com selo "Bônus em breve" |
| **C3 — Preservação** (ciclo menstrual + futuras) | 🟡 25% entregue · 3 itens com selo "Bônus em breve" |
| **C4 — Avançado** (platôs, transição, lote, personalização) | 🟡 Em construção · 4 itens com selo "Bônus em breve" |

**Decisão de transparência:** ao invés de prometer features que não existem (risco legal de *bait-and-switch*), marcamos cada item pendente com **🎁 Bônus em breve** — paciente vê o que está por vir como promessa positiva, não como gap.

---

## 3. Mudanças Recentes (últimas 2 semanas)

### 🩺 Clínicas

**v3.8.4 — 3 objetivos de tratamento**
Paciente agora escolhe o foco: *Emagrecer* / *Reconstruir músculo* / *Manter peso*. Cada objetivo recalibra metas de proteína e calorias automaticamente.

**v3.8.7 — Visibilidade do objetivo**
Card de objetivo sempre visível no topo do Painel. Mostra meta de proteína e calorias do paciente em tempo real.

**v3.8.8 / v3.8.9 — Barra de calorias dinâmica + recalibragem clínica**
A barra de calorias agora muda conforme o objetivo. Para *Reconstruir*, antes a faixa "Déficit" ocupava 77% da barra — paciente em GLP-1 ficava o dia todo no vermelho. Recalibrado para:

| Zona | Faixa | Cor |
|---|---|---|
| Muito baixo | < 85% do GET | Vermelho |
| Subótimo | 85-100% do GET | Amarelo |
| ✅ Ideal | 100-120% do GET | Verde |
| Excesso | > 120% do GET | Vermelho |

E o label "X kcal meta" virou **"2.505–3.006 kcal · zona ideal"** — mais honesto clinicamente, mostra a janela em vez de um número único enganoso.

**v3.8.6 — Subtítulo do peso**
Gráfico de peso agora reflete histórico completo do paciente, não só o último período.

### 🧠 UX / Comunicação

**v3.8.3 — Persistência da anamnese em tempo real**
Bug identificado pelo Lucas Judice: dados da anamnese eram perdidos se o paciente saísse antes de terminar. Agora salva a cada campo preenchido.

**v3.9.0 / v3.9.2 — Auditoria + selo "Bônus em breve"**
Auditoria completa das 4 camadas. Features prometidas mas não entregues ganharam selo verde **🎁 Bônus em breve** — comunicação honesta, framing positivo. Texto da Jornada reescrito para reforçar que são novidades em desenvolvimento ativo.

**v3.8.9 — Toast educativo no objetivo**
Quando paciente troca de objetivo e a meta de proteína não muda (já estava saturada pela atividade física), aparece toast secundário explicando o porquê. Resolve queixa do Lucas ("ajustei mas os % não atualizaram").

**v3.9.2 — Modo avançado clarificado**
Reescrito o que o "Modo avançado" faz e o que **NÃO** faz (desbloqueia camadas, não muda cálculos).

### 🛠️ Infraestrutura

**v3.9.1 — Servidor próprio (Manus.space → Cloudflare)**
A "IA do prato" (Google Gemini) era acessada via servidor terceiro alugado (Manus.space) que era temporário e podia sair do ar. Migramos para servidor próprio na Cloudflare (`sanova-api.contatosanovaapp.workers.dev`), com deploy automatizado via GitHub Actions.

**Gemini migrado para conta profissional + billing ativo**
A chave da IA estava na conta pessoal do Bruno (risco contábil) e em plano gratuito (risco LGPD — Google treinava IA com dados de pacientes). Trocada para conta `contatosanovaapp@gmail.com` com plano pago. **O Google não usa mais dados de paciente para treinar IA.**

### 📋 Compliance

- **LGPD:** dados ficam exclusivamente no celular do paciente (localStorage). Sincronização opcional via Supabase com Row-Level Security. Análise de prato via Gemini pago (não treina mais com dado).
- **Aviso legal:** não é dispositivo médico ANVISA, é app educativo. Reforçado em onboarding e nos termos.
- **Login obrigatório** + recuperação multi-device via Supabase (v3.2.0+).

---

## 4. Arquitetura (resumo técnico)

| Pedaço | Onde | Status |
|---|---|---|
| **App (PWA)** | GitHub Pages — `sanovaapp.github.io/sanova` | ✅ Nosso, gratuito, auto-deploy |
| **Banco de dados** | Supabase | ✅ Nosso, RLS habilitado |
| **Servidor da IA** | Cloudflare Workers — `sanova-api.contatosanovaapp.workers.dev` | ✅ Nosso, auto-deploy |
| **IA reconhecimento de prato** | Google Gemini 2.5 Flash (conta profissional, pago) | ✅ LGPD compliant |
| **Fallback offline** | Estimativa local de macros | ✅ Se Gemini cair, app continua |

---

## 5. O que vem por aí (próximas semanas)

### Funcionalidades em construção (8 itens com selo "🎁 Bônus em breve")

**Camada 2:**
- Educação por fase da medicação ("você está na semana 3 — náusea é comum, vai passar")

**Camada 3:**
- Perímetros corporais + estimativa gordura × massa magra
- Fotos de progresso (rosto, corpo) com privacidade
- Protocolo de proteína refinado pelo treino (educação contextual)

**Camada 4:**
- Detecção automática de platôs (28+ dias)
- Plano de transição ao parar a medicação
- Rastreamento de lote e farmácia (paciente de manipulado)
- Personalização de cards do painel

### Redesign visual progressivo (em análise)

Lucas levantou: fontes muito pequenas (11-12px em vários lugares), informação demais sem hierarquia clara, paciente se perde. Próximo passo: refinar tipografia, criar "número herói" por seção, glassmorphism sutil onde fizer sentido (sem comprometer performance Android mid-range).

### Próximas decisões macro

- Mercado Pago (cobrança real — atualmente o paywall existe mas não cobra)
- Construir as 8 features de "Bônus em breve" antes de ativar paywall
- Backup semanal automático do banco (boa prática)

---

## 6. O que pedimos da revisão

**Para a revisora clínica:**
- Validar a recalibragem das faixas de calorias para o objetivo *Reconstruir* (especialmente em pacientes em GLP-1 + treino resistido)
- Conferir mensagens educativas das faixas (Muito baixo / Subótimo / Ideal / Excesso) — estão no tom certo? Clinicamente seguras?
- Avaliar a decisão da Camada 3: marcar perímetros e fotos como "Bônus em breve" vs. tentar construir antes do lançamento

**Para a revisora de produto/design:**
- Avaliar o framing "🎁 Bônus em breve" — comunica novidade positiva ou cria dúvida?
- Sentir se o app está pronto para receber pacientes novos hoje (com o que já temos) ou se há gaps de UX bloqueantes
- Opinar sobre o redesign visual: profundidade do que o Lucas pediu vs. ritmo realista

---

## 7. Como acessar

**App:** [https://sanovaapp.github.io/sanova](https://sanovaapp.github.io/sanova)

**Login para revisão:** podemos criar uma conta dedicada com dados de teste, ou usar conta da revisora com perfil de paciente fictício para sentir a jornada completa.

**Para questões técnicas ou clínicas durante a revisão:** Bruno (founder, médico) — disponível.

---

*Documento gerado automaticamente · Última atualização: 02 de junho de 2026 · v3.9.2*
