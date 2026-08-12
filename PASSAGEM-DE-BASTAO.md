# 🌿 Sanova — passagem de bastão

Documento de transferência completo. Escrito para que outra pessoa, ou outra
IA, assuma este projeto **sem precisar perguntar nada a ninguém**.

Se alguma coisa aqui não estiver clara, é falha deste documento.

*Escrito em 07/08/2026. App na v3.10.61, Worker na v1.31.0.*

---

# PARTE 1 — O que é o Sanova

## O produto

PWA (aplicativo web instalável) de **acompanhamento de tratamento com
análogos de GLP-1** — a classe de medicamentos usada para obesidade e
diabetes tipo 2.

O paciente registra peso, refeições, proteína, água, treino, dose aplicada e
sintomas. O app devolve leitura clínica: se a perda está em ritmo seguro, se
a proteína está protegendo a massa magra, se as calorias estão abaixo do
piso fisiológico.

**Público:** pessoas em tratamento **já prescrito** por profissional de
saúde. O app não inicia tratamento.

**Modelo:** assinatura mensal/anual via Mercado Pago, com período de teste.

**Estado comercial:** pré-lançamento. Rejeitado uma vez na Play Store em
18/07/2026 por tipo de conta (política do Google exige conta de organização
para app de saúde). Em transferência para conta org desde 05/08.

## Quem decide

**Bruno Ambrozim** — médico e fundador. **Não é programador.** Decide
produto, conduta clínica e preço. Qualquer texto técnico escrito para ele
precisa explicar o *porquê*, não só o comando.

## A fronteira que define o produto

> **O Sanova sinaliza limiar. Não prescreve, não diagnostica, não substitui
> consulta.**

Isso não é disclaimer jurídico — é o que separa o produto de um **dispositivo
médico regulado pela ANVISA** e de exercício ilegal da medicina.

Consequências concretas no código:

- Toda peça que fale de alerta carrega o **termo invertido**:
  *"O Sanova pode sinalizar, mas NÃO substitui o monitoramento clínico.
  Ausência de alerta NÃO significa ausência de risco."*
  A inversão é deliberada: a frase perigosa não é "temos alertas", é o
  paciente concluir que silêncio é segurança.
- **Nome comercial de medicamento nunca aparece em peça gerada** (RDC
  96/2008 restringe propaganda de medicamento). Molécula só com opt-in,
  padrão desligado.
- **Nunca** uma frase que amarre molécula → resultado como alegação de
  eficácia. O app narra o esforço da pessoa, não a performance do fármaco.
- Alerta vermelho (emergência) é **modal síncrono no fluxo**, no segundo em
  que o paciente registra o sintoma. **Push nativo nunca é camada de
  segurança** — entrega não é garantida, e prometê-la criaria expectativa de
  monitoramento 24/7 que o produto não pode assumir.

---

# PARTE 2 — Arquitetura

## O mapa

```
NAVEGADOR DO PACIENTE
  index.html ......... o app inteiro, 26.353 linhas, arquivo único
  sw.js .............. service worker (cache offline)
  localStorage ....... fonte primária dos dados do paciente
        │
        │  HTTPS
        ▼
CLOUDFLARE WORKER (sanova-api)
  worker/src/index.js .... roteador, 21 rotas públicas + 26 admin
  worker/src/pro.js ...... painel do profissional
  worker/src/alerts.js ... detecção dos 10 alertas clínicos
  worker/src/mp.js ....... Mercado Pago
  worker/src/clinical.js . cálculos clínicos
  worker/src/retencao.js . retenção de dados (LGPD)
  worker/src/ratelimit.js  limite de chamadas por IP
        │
        ▼
SUPABASE (Postgres + Auth)  ── 8 tabelas, RLS ligado e forçado
GEMINI 2.5 FLASH            ── análise de foto de prato
MERCADO PAGO                ── assinatura recorrente
```

## Por que o `index.html` tem 26 mil linhas

**É decisão, não dívida.** Não modularize.

O app é offline-first e instalável. Arquivo único significa: um request,
zero build, zero bundler, e o service worker cacheia uma coisa só. O Bruno
não é programador — não há pipeline de build que ele consiga operar sozinho
se algo quebrar às duas da manhã.

O custo é real (nenhum teste cobre esse arquivo — ver Parte 6), mas a
troca foi consciente e sobreviveu a várias revisões.

## Onde o dado do paciente vive

**Primeiro no aparelho** (`localStorage`, chave `equilibra_v5` — nome
legado). O Supabase é sincronização e backup, não fonte primária.

Isso é escolha de privacidade: dado de saúde não sai do aparelho quando não
precisa sair. Os cards de resultado compartilháveis, por exemplo, são
desenhados em `<canvas>` **no dispositivo** — mandar para um serviço de
design de terceiro quebraria isso.

## Modelo de dados (Supabase)

| Tabela | O que guarda |
|---|---|
| `app_state` | o estado inteiro do paciente (JSON), 1 linha por usuário |
| `professionals` | cadastro de médico/nutricionista |
| `patient_links` | vínculo paciente ↔ profissional, com status |
| `subscriptions` | assinatura, plano, status de cobrança |
| `alert_events` | alertas disparados, com mensagem factual |
| `professional_alert_prefs` | frequência escolhida por tipo de alerta |
| `admins` | quem pode chamar os endpoints administrativos |
| `mp_plans` | planos do Mercado Pago |

**RLS (Row Level Security) ligado e forçado** em `app_state` — cada paciente
só alcança a própria linha, pelo banco e não pela boa vontade do código.
Migration `20260729000000_app_state_rls_lockdown.sql`.

⚠️ **A chave `service_role` passa por cima do RLS.** Ela vive no Worker e nos
workflows. Qualquer código que a use lê o dado de qualquer paciente. É o
maior poder do sistema e merece o maior cuidado.

## O estado do paciente (`S`)

Objeto único, persistido inteiro. Campos principais:

```js
S = {
  profile:  { sex, age, heightCm, weightStartKg, weightKg, weightGoalKg,
              startDate, activityLevel },
  caneta:   { farmaco, dose, freq, inicio, ultima, tipo, estoqueAtual, ... },
  weights:  [ { date, weight } ],
  daily:    [ { date, proteinG, waterMl, exercicio, ... } ],
  applications: [ ... ],
}
```

> **`S.caneta` é nome legado.** Guarda medicação e estoque, não só caneta.
> Metade do app depende do nome. **Não renomeie.**

⚠️ **Armadilha real, já custou um bug:** existem **dois "pesos iniciais"** —
`profile.weightStartKg` (o que o paciente declarou) e `weights[0]` (a
primeira pesagem registrada). São números diferentes sempre que a pessoa
começa o tratamento e só se pesa dias depois. Todo lugar que calcula perda
precisa usar o **declarado**. Um card usava o outro e mostrava 20 kg onde o
painel mostrava 21.

---

# PARTE 3 — A camada de automação

23 workflows no GitHub Actions. Os que importam:

| Workflow | O que faz | Quando |
|---|---|---|
| `deploy-worker.yml` | publica o Worker no Cloudflare | a cada push na main |
| `testes.yml` | roda a suíte + valida sintaxe de todo script e YAML | toda PR |
| `auto-merge.yml` | mergeia PR de agente que passe em 5 portões | toda PR |
| `worker.yml` | executa a fila de vigilância | 3/3h |
| `claude-turno.yml` | um agente lê o estado, decide e implementa | 6/6h |
| `claude-mencao.yml` | responde a `@claude` em qualquer issue ou PR | sob demanda |
| `retencao.yml` | apaga dado velho (LGPD) | diário, 03:00 BRT |
| `publish-play.yml` | monta o AAB e envia pra Play Store | manual |
| `heartbeat.yml` | pulso diário do estado | diário |

## Duas filas, com propósitos diferentes

- **`automation/backlog.yml`** — o que **vigiar**. Tarefas determinísticas:
  o site está no ar? a versão bate? o secret existe? Reporta só quando muda
  de estado.
- **`TRABALHO.md`** — o que **construir**. O agente autônomo pega o primeiro
  item e implementa.

## O portão de merge

`.github/scripts/auto-merge.mjs`. Uma PR entra sozinha se **todos** passarem:

1. veio de branch `claude/*`
2. não toca caminho protegido *(privacidade, termos, migrations, auth,
   pagamento, `.github/`)*
3. não tem o rótulo `decisao-humana`
4. passa na sanidade: YAML parseia, versão subiu, **nenhuma linha adicionada
   com cara de credencial**
5. nenhum check falhou

O portão de credencial existe porque **o repositório é público** e já houve
vazamento — um token apareceu num print e teve que ser trocado.

---

# PARTE 4 — Infraestrutura e chaves

## Onde cada coisa roda

| Peça | Onde | Como sobe |
|---|---|---|
| App e site | GitHub Pages, `sanova.app.br` | push na `main` |
| API | Cloudflare Workers | `deploy-worker.yml` |
| Banco e auth | Supabase (AWS us-east-2) | migrations versionadas |
| Cobrança | Mercado Pago | — |
| IA de foto | Gemini 2.5 Flash | — |

## As 18 chaves — nomes, nunca valores

**Nenhuma está no repositório.** Vivem no cofre de secrets do GitHub e no env
do Worker.

| Chave | Abre |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | **o banco inteiro**, por cima do RLS |
| `SUPABASE_MGMT_TOKEN` | mudar schema |
| `SUPABASE_PROJECT_REF` | id do projeto |
| `CLOUDFLARE_API_TOKEN` + `_ACCOUNT_ID` | publicar a API |
| `MP_ACCESS_TOKEN_PROD` / `_SANDBOX` | Mercado Pago |
| `MP_WEBHOOK_SECRET` | validar webhook de pagamento |
| `GEMINI_API_KEY` | análise de foto (pago por chamada) |
| `ANTHROPIC_API_KEY` | o agente autônomo |
| `ADMIN_OVERRIDE_TOKEN` | os 26 endpoints administrativos |
| `PAGES_ADMIN_PAT` | configurar o Pages |
| `DEMO_REVIEW_PASSWORD` | conta de demonstração |
| `PLAY_SERVICE_ACCOUNT_JSON` | ⚠️ **não existe ainda** |
| `TWA_UPLOAD_KEYSTORE_B64` + 2 senhas | ⚠️ **não existem ainda** |

> 🔒 **Regra inviolável:** nenhum valor de credencial em texto cru — nem em
> sessão pública, nem em arquivo do repo, nem em commit, nem em print.
> Referencie o **fato** ("confirmado na tela"), nunca o **valor**.

---

# PARTE 5 — Estado atual

## Funciona hoje

- App completo no ar em `sanova.app.br`, instalável, offline-first
- Login, sincronização, assinatura via Mercado Pago
- Análise de prato por foto e por texto (Gemini)
- Painel do profissional com semáforo de pacientes
- Espelho read-only: profissional vê o app do paciente, com trava no servidor
- Cards de resultado compartilháveis, desenhados no aparelho
- Alertas clínicos ao profissional — **5 vermelhos ligados**, 5 amarelos
  opt-in
- LGPD art. 18: apagar conta apaga no banco; portabilidade é botão
- Retenção automática: `alert_events` some em 180 dias

## Travado

**Play Store.** Rejeitado em 18/07 por tipo de conta. Transferência para
conta org aceita em 05/08, **ainda processando** do lado do Google. O app não
apareceu na conta de destino.

Falta também a `PLAY_SERVICE_ACCOUNT_JSON` — sem ela toda operação de loja é
manual. Não bloqueia a primeira publicação, só a automação das próximas.

> 🎁 **Descoberta que vale duas semanas:** conta de **organização é isenta**
> da exigência de 12 testadores por 14 dias. A regra do Google vale só para
> *"contas pessoais criadas depois de 13/11/2023"*. Se a conta de destino for
> org de verdade, publica direto na aprovação.

## Aberto, com o motivo

| Item | Estado |
|---|---|
| Contraste ruim em "PROTEÇÃO MUSCULAR" | falta identificar em qual tela |
| Decimal com ponto em vez de vírgula | 52 usos de `toFixed()`, só 9 com vírgula — num app brasileiro |
| Cron diário dos alertas | ligar depois de ver os primeiros alertas reais |
| Retenção de conta inativa | mecanismo pronto, em modo relatório |

---

# PARTE 6 — O que é frágil, sem maquiar

Se você vai assumir, precisa saber onde dói.

## 1. O arquivo de 26 mil linhas não tem teste nenhum

A suíte cobre o Worker: rate limit, retenção, o portão de merge, e o bug do
peso inicial. **O `index.html` não tem cobertura.** Toda mudança nele é
validada por leitura e pelos snapshots do Playwright — que não rodam em toda
PR.

**É a maior dívida do projeto.**

## 2. Cache de service worker já prendeu paciente em versão velha

Historicamente responde por **~30% dos "bugs" relatados**. Por isso:

- `skipWaiting()` está ligado e **não se reverte**
- há auto-recuperação: se o SW ativo for mais velho que o HTML, ele se
  desregistra e recarrega
- **sempre subir `SANOVA_VERSION` no `index.html` E `VERSION` no `sw.js`** —
  esquecer um dos dois prende o paciente

Antes de investigar qualquer bug relatado, **pergunte a versão em Mais →
Sobre**.

## 3. A `service_role` circula demais

Está no Worker e em vários workflows. Bypassa o RLS. Quando o piloto começar
com pacientes reais, vale separar: chave de leitura para os monitores, e
`service_role` só onde é indispensável.

## 4. Performance no celular nunca foi medida

26 mil linhas carregando de uma vez, em rede móvel, no aparelho de um
paciente. Ninguém olhou isso.

## 5. Um agente com muito alcance

O agente autônomo tem, via workflows, acesso ao banco de pacientes, ao
Mercado Pago em produção e ao deploy. Os freios que existem: suíte de testes
como pré-requisito de merge, varredura de credencial, e caminhos protegidos
que exigem aprovação humana.

---

# PARTE 7 — As cicatrizes

Decisões que parecem erradas e não são. Cada uma custou pelo menos uma sessão.

| Não mexer | Por quê |
|---|---|
| `index_vitorioso_sanova.html` | nunca apagar — regra sagrada do projeto |
| Modularizar o `index.html` | arquivo único é decisão, ver Parte 2 |
| `S.caneta` | nome legado, metade do app depende |
| `skipWaiting()` do SW | sem ele o paciente trava em versão velha |
| Bloqueio de F12 | tem valor jurídico no Brasil |
| **Liraglutida** | Saxenda é real — tirar a molécula exclui pacientes |
| **Foto do frasco** | decisão **clínica**: letra pequena em frasco é risco de erro de dose |
| Cards via serviço de design | dado de saúde não sai do aparelho |

E uma de processo: **nada de lógica em bash dentro de YAML.** O heartbeat
falhou 12 vezes seguidas por erro de parse causado por markdown dentro de
`run: |`, sem ninguém perceber. Lógica vive em `.github/scripts/*.mjs`.

---

# PARTE 8 — O caminho até a loja

1. **Esperar a transferência concluir** — sem ação possível, é fila do Google
2. **Confirmar o tipo da conta** de destino — Play Console → Conta de
   desenvolvedor → Tipo de conta. Decide se há 14 dias de teste obrigatório
3. **Reenviar para revisão** — as mudanças de 18/07 continuam válidas; o que
   mudou foi o tipo de conta, que era o motivo da recusa
4. **Aprovação** — 1 a 7 dias, app de saúde costuma ir pro lado longo
5. **Publicar**

Detalhe operacional completo em `LANCAMENTO.md` e `docs/checklist-d-zero.md`.

Material de loja pronto em `store-assets/`: ficha canônica, feature graphic,
4 screenshots, ícones.

---

# PARTE 9 — O que eu faria a seguir

Em ordem, se continuasse:

1. **Cobrir o `index.html` com teste**, começando pelos cálculos clínicos.
   É a dívida que mais assusta num app de saúde.
2. **Medir o carregamento no celular** antes do piloto.
3. **Separar a `service_role`** dos monitores.
4. **Corrigir o decimal com vírgula** — em levas pequenas, verificáveis.
5. **Ligar o cron dos alertas** depois de ver os primeiros reais.

---

# Índice dos arquivos

| Arquivo | O que é |
|---|---|
| `CLAUDE.md` | briefing curto, lido automaticamente por agentes |
| `DECISOES.md` | as cicatrizes, em detalhe |
| `ESTADO.md` | onde o projeto está hoje |
| `TRABALHO.md` | fila de construção |
| `LANCAMENTO.md` | caminho até a Play Store |
| `SINTOMAS_GLP1.md` | fonte de verdade clínica sobre sintomas |
| `automation/backlog.yml` | fila de vigilância |
| `automation/briefing-turno.md` | instruções do agente autônomo |
| `docs/` | guias operacionais |
| `store-assets/` | material da loja |

**Histórico completo:** 96 commits desde 12/06/2026, cada um com o *porquê*
no corpo da mensagem. `git log` é documentação.

**A Sala** — issue #148, fechada — tem 86 turnos de decisão registrada. É
arqueologia, mas está lá se precisar entender por que algo é como é.
