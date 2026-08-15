# 🌿 Data Safety Form — respostas pré-preenchidas (Play Console)

> ## 🔴 Pendente: a declaração no Play Console está desatualizada
>
> O formulário foi respondido e marcado como concluído em julho. Depois
> disso, a **v3.10.63** passou a enviar registros de falha pro PostHog, e a
> seção **4b** deste arquivo — *Informações e desempenho do app* — nunca foi
> declarada no painel.
>
> **Por que isso é sério:** declaração de Segurança dos dados incompleta é
> uma das causas mais comuns de recusa, e para app de saúde o Google confere
> com lupa. Se aparecesse depois dos 14 dias de teste fechado, custaria o
> ciclo inteiro.
>
> **O que fazer:** Play Console → Políticas e programas → Conteúdo do app →
> Segurança dos dados → editar → marcar *Registros de falhas* e
> *Diagnósticos* conforme a seção 4b. É formulário, não decisão clínica.
>
> **Regra que sai daí:** mudança no app que abra categoria nova de coleta
> exige revisitar esta declaração **antes** de subir a versão. Trocar o que
> o app manda sem trocar o que o app declara é criar dívida invisível.

> T70 pré-staging. Respostas prontas pro formulário "Segurança dos dados"
> do Play Console, baseadas na arquitetura real do app (auditada 29/07,
> PRs #222 #230 #235). Se o formulário do Google mudar de estrutura, as
> respostas de conteúdo continuam válidas — só muda onde clicar.
>
> Fonte de verdade da arquitetura: dados de saúde ficam em
> `localStorage` (dispositivo) + `app_state` no Supabase (backup/sync,
> RLS estrito por usuário). Análise de foto via proxy Worker → Gemini
> (sem retenção). Analytics PostHog EU com mascaramento. Pagamento via
> Mercado Pago FORA do app (web) — sem Play Billing.

---

## Coleta e compartilhamento — visão geral

| Pergunta | Resposta |
|---|---|
| O app coleta ou compartilha dados do usuário? | **Sim, coleta** |
| Os dados são criptografados em trânsito? | **Sim** (HTTPS em tudo) |
| O usuário pode solicitar exclusão dos dados? | **Sim** (in-app: Mais → Perfil → Apagar todos os dados — deleta servidor + local via `/api/delete-my-account`; ou URL pública `sanova.app.br/exclusao.html`) |

## Tipos de dados coletados

### 1. Informações pessoais
- **E-mail**: SIM — coleta. Finalidade: gerenciamento da conta (login/backup).
  Compartilhado: NÃO. Opcional: NÃO (login é obrigatório). Processado
  efemeramente: NÃO.
- **Nome**: SIM — coleta (nome que o usuário define no perfil, livre).
  Finalidade: personalização. Compartilhado: NÃO.
- Endereço, telefone, CPF/RG: **NÃO coleta**.

### 2. Saúde e fitness
- **Informações de saúde**: SIM — coleta. Peso, medicação (fármaco/dose/
  aplicações), sintomas, refeições, hidratação, exercício, ciclo menstrual
  (opt-in). Finalidade: funcionalidade principal do app (acompanhamento).
  Compartilhado: NÃO*. Opcional: parcialmente (usuário escolhe o que
  registra). 
  - *Nota interna: o "espelho profissional" compartilha COM O PROFISSIONAL
    escolhido pelo próprio paciente, mediante consentimento explícito
    versionado (LGPD art. 7º). No vocabulário do formulário do Google,
    isso NÃO é "sharing" (sharing = transferência a terceiros/parceiros
    comerciais). É funcionalidade a pedido do usuário.

### 3. Fotos e vídeos
- **Fotos**: SIM — coleta com processamento efêmero. Foto do prato é
  enviada ao proxy (Cloudflare Worker) → API Gemini pra análise
  nutricional e NÃO é armazenada em servidor próprio. Finalidade:
  funcionalidade do app. Processado efemeramente: SIM.

### 4. Atividade no app
- **Interações no app**: SIM — coleta (analytics PostHog, host EU,
  mascaramento de inputs, opt-out disponível em Mais → Privacidade).
  Finalidade: analytics. Compartilhado: NÃO (PostHog é operador/processor).

### 4b. Informações e desempenho do app ⚠️ **FALTOU NA DECLARAÇÃO ORIGINAL**

> Esta seção não existia quando o formulário foi respondido (29/07). Ela
> passou a ser necessária na **v3.10.63**, quando o app começou a enviar
> exceções pro PostHog (`Sanova.reportarErro` → `posthog.captureException`,
> PR #262). **A declaração no Play Console está desatualizada em relação ao
> app que está hoje na faixa de teste fechado.**

- **Registros de falhas**: SIM — coleta. O app captura exceção de JavaScript
  e promise rejeitada sem tratamento, e envia ao PostHog (host EU).
  Finalidade: **análise de apps** (diagnóstico de defeito).
  Compartilhado: NÃO (PostHog é operador/*processor*).
  Opcional: **SIM** — respeita o mesmo opt-out do analytics
  (Mais → Privacidade), conferido antes de cada envio.
  Processado efemeramente: NÃO.

  **O que sobe:** mensagem do erro, pilha, arquivo e linha, origem
  (`window.error` ou `promise`), versão do app e a tela (hash da URL,
  truncado em 40 caracteres).
  **O que NÃO sobe, por construção:** o objeto de estado `S`, qualquer
  trecho de `localStorage`, e o valor que causou o erro. Travado por teste.

- **Diagnósticos**: SIM — coleta. O *session replay* do PostHog registra a
  sessão com todos os inputs e textos mascarados
  (`maskAllInputs: true`, `maskTextSelector: '*'`,
  `blockSelector: '[data-ph-no-capture], input, textarea'`).
  Declarado por precaução: a gravação carrega sinais de tempo e desempenho,
  e no vocabulário do Google isso é *Diagnostics*. **Declarar a mais não
  custa nada; declarar a menos é violação de política.**

- **Outros dados de desempenho do app**: NÃO.

### 5. Identificadores
- **ID de usuário**: SIM — coleta (UUID Supabase Auth). Finalidade:
  gerenciamento de conta. Compartilhado: NÃO.

### O que NÃO coleta (marcar "não" em tudo abaixo)
Localização (precisa ou aproximada) · Contatos · Calendário · SMS/chamadas ·
Arquivos do dispositivo · Áudio (voz é transcrita no dispositivo pelo
navegador, não enviada) · Histórico de navegação · Informações financeiras
(pagamento acontece no site do Mercado Pago, fora do app) · Dados de apps
instalados.

## Práticas de segurança (seção "Security practices")

- Dados criptografados em trânsito: **SIM** (TLS em tudo)
- Dados criptografados em repouso: **SIM** (AES-256, Supabase/AWS)
- Mecanismo de exclusão: **SIM** — in-app + URL pública
- Comprometimento com Play Families: N/A (app 18+)
- Revisão de segurança independente: NÃO (não temos auditoria externa —
  não marcar)

## Declarações relacionadas (fora do data safety, mas no mesmo fluxo)

| Declaração | Resposta |
|---|---|
| Categoria | Saúde e fitness |
| Público-alvo | 18+ |
| Anúncios | NÃO contém |
| App de saúde (declaração dedicada) | SIM — bem-estar/acompanhamento. NÃO é dispositivo médico, NÃO diagnostica, NÃO prescreve (alinhado T50: monitoramento por limiar, best-effort) |
| Política de privacidade (URL) | `https://sanova.app.br/privacidade.html` |
| Exclusão de conta (URL) | `https://sanova.app.br/exclusao.html` |
| Login obrigatório? | Sim — fornecer credenciais de teste pro revisor: usar conta demo (`admin-seed-demo` gera; NUNCA colar senha real aqui — gerar na hora e passar só no campo do formulário de revisão) |

## Histórico

- 18/07/2026: formulário enviado na conta pessoal com estas respostas —
  aprovação da ficha não foi contestada (rejeição foi só o tipo de conta)
- 05-06/08/2026: transferência pra conta org — declarações migram juntas;
  este arquivo é o backup pra re-preenchimento se cair no Cenário B do
  `checklist-d-zero.md`
