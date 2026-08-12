# 🌿 Sanova — pacote de transferência

**Para:** o agente que assume o projeto (Manus)
**De:** Claude Code, turno de 10/08/2026
**Repositório:** `github.com/sanovaapp/sanova` (público)
**App no ar:** https://sanova.app.br

Este documento existe para você conseguir trabalhar **sem ter que perguntar
ao Bruno o que já está decidido**. Ele é médico e fundador, não programador —
cada pergunta que você faz sobre algo já resolvido custa tempo dele.

Leia inteiro antes do primeiro commit. São 15 minutos que economizam sessões.

---

## Índice

1. [A ideia](#1-a-ideia--o-que-o-sanova-é-e-por-que-existe)
2. [A fronteira clínica](#2-a-fronteira-clínica--a-linha-que-não-se-cruza)
3. [Arquitetura](#3-arquitetura--onde-vive-cada-coisa)
4. [Estado hoje](#4-estado-hoje--10082026)
5. [As cicatrizes](#5-as-cicatrizes--o-que-não-se-toca)
6. [A fila](#6-a-fila--o-que-construir)
7. [Infraestrutura e segredos](#7-infraestrutura-e-segredos)
8. [Automação](#8-automação--o-que-roda-sozinho)
9. [Como verificar](#9-como-verificar-antes-de-dar-por-pronto)
10. [O que só o Bruno faz](#10-o-que-só-o-bruno-faz)
11. [Como falar com ele](#11-como-falar-com-o-bruno)
12. [Armadilhas](#12-armadilhas-que-já-custaram-caro)
13. [O que eu deixo em aberto](#13-o-que-eu-deixo-em-aberto--leia-isto)

---

## 1. A ideia — o que o Sanova é, e por que existe

**Um app de acompanhamento para quem faz tratamento com GLP-1** (semaglutida,
liraglutida, tirzepatida — a classe da Ozempic/Mounjaro/Saxenda).

### O problema real

Quem usa GLP-1 perde peso rápido. O risco clínico não é *não* perder — é
**perder músculo junto com gordura**, comer pouco demais, e não perceber. O
paciente vê o número da balança caindo e conclui que está indo bem.

O médico só descobre na consulta seguinte, 30 ou 60 dias depois.

### O que o Sanova faz

Acompanha entre as consultas: peso, doses aplicadas, sintomas, proteína,
água, exercício. E **sinaliza limiar** — quando algo cruza uma faixa que
merece olhar clínico.

Duas superfícies:

| Superfície | Arquivo | Quem usa |
|---|---|---|
| **App do paciente** | `index.html` | quem faz o tratamento |
| **Painel do profissional** | `pro.html` | médico que acompanha |

### A filosofia de produto — três coisas que explicam quase toda decisão

**1. Offline-first, dado no aparelho.** O app funciona sem internet. O dado
de saúde não sai do celular quando não precisa sair. Os cards de resultado
compartilháveis são desenhados em `canvas` local — não em serviço de terceiro
— justamente porque mandar dado de saúde pra API externa quebraria isso.

**2. O app narra o esforço da pessoa, não a performance do remédio.** Nunca
uma frase que amarre molécula → resultado. Isso é fronteira regulatória
(alegação de eficácia) e também de produto: quem perdeu peso foi o paciente.

**3. Fricção é custo.** Um toque a mais é um paciente a menos registrando. O
Bruno cobra disso — "o paciente não vai fazer isso" encerra discussões.

---

## 2. A fronteira clínica — a linha que não se cruza

> **O Sanova sinaliza limiar. Não prescreve, não diagnostica, não substitui
> consulta.**

Essa frase é o que separa o produto de um **dispositivo médico regulado**
(SaMD/ANVISA) e de exercício ilegal da medicina. Não é jurídiquês defensivo —
é a definição do produto.

### O termo invertido, obrigatório em toda peça que fale de alerta

> O Sanova pode sinalizar, mas **NÃO** substitui o monitoramento clínico.
> **Ausência de alerta NÃO significa ausência de risco.**

A inversão é deliberada. A frase perigosa não é *"temos alertas"* — é o
paciente concluir que **silêncio é segurança**.

### O que o app nunca escreve

- **Nome comercial de medicamento** em peça gerada (RDC 96/2008). Molécula só
  com opt-in, padrão **desligado**.
- **Nome de paciente** em card compartilhável.
- Qualquer frase molécula → resultado como alegação de eficácia.

### Pisos fisiológicos que o código respeita

**1200 kcal mulher, 1500 kcal homem.** Se o cálculo de meta cair abaixo, o app
aplica o piso e **explica ao paciente que aplicou**. Não silenciosamente.

### Push nativo nunca é camada de segurança

Entrega não é garantida. Prometê-la criaria expectativa de monitoramento 24/7
que a Sanova não pode assumir. Alerta 🔴 de emergência é **modal síncrono no
próprio fluxo de registro**, no segundo em que o paciente descreve o sintoma.

---

## 3. Arquitetura — onde vive cada coisa

### Stack

| Camada | Tecnologia | Onde |
|---|---|---|
| App paciente | HTML/JS puro, arquivo único | `index.html` (~26 mil linhas) |
| Painel profissional | HTML/JS + Supabase JS | `pro.html` |
| Service worker | cache + `skipWaiting()` | `sw.js` |
| API | Cloudflare Worker | `worker/src/` |
| Banco | Supabase (Postgres + RLS) | `supabase/migrations/` |
| Hospedagem | Cloudflare Pages | domínio `sanova.app.br` |
| CI/automação | GitHub Actions | `.github/workflows/` |

**Não há build step no app do paciente.** `index.html` é servido como está.
Isso é intencional — ver §5.

### O modelo de dados do paciente (`S`)

Tudo vive num objeto único `S`, serializado em `localStorage`:

```js
S = {
  profile:     { sex, age, heightCm, activityLevel, startDate,
                 weightStartKg, weightKg, weightGoalKg },
  caneta:      { farmaco, dose, freq, inicio, ultima, diaSem,
                 tipo, apresentacao, concRotuloMg, ... },
  weights:     [ { date, weight }, ... ],
  daily:       [ ... ],   // check-ins diários
  applications:[ ... ],   // doses aplicadas
  progressao:  { ... },   // escalonamento de dose
  ciclo:       { ... },   // ciclo menstrual (quando aplicável)
  insights, ultimaCalc, exercMetaSem, _meta
}
```

> ⚠️ **`S.caneta` é nome legado.** Guarda os dados da medicação, não de uma
> caneta específica. **Não renomear** — metade do app depende dele.

**Duas fontes de verdade para o peso inicial**, e isso já causou um bug:
`S.profile.weightStartKg` (declarado na anamnese) vs `S.weights[0]` (primeira
pesagem). Divergem quando o paciente começa o tratamento e só pesa dias
depois. Teste de regressão em `worker/test/jornada-peso-inicial.test.mjs`.

### O banco (Supabase) — 8 tabelas

| Tabela | O que guarda |
|---|---|
| `app_state` | o `S` do paciente, sincronizado (RLS trancado) |
| `professionals` | cadastro do profissional |
| `patient_links` | vínculo paciente ↔ profissional |
| `alert_events` | alertas gerados (Fase 2) |
| `professional_alert_prefs` | quais alertas o profissional quer receber |
| `subscriptions` | assinaturas (Mercado Pago) |
| `mp_plans` | planos do Mercado Pago |
| `admins` | acesso administrativo |

**RLS ligado e forçado** em toda tabela com dado de paciente. Isolamento é
responsabilidade do banco, não da boa vontade do código.

### A API (Cloudflare Worker, v1.31.0)

~50 rotas em `worker/src/index.js` + `pro.js`. As que importam:

| Grupo | Rotas |
|---|---|
| Paciente | `/api/analyze-photo`, `/api/analyze-text`, `/api/spectator-state` |
| LGPD | `/api/delete-my-account`, `/api/export-my-data` |
| Vínculo | `/api/link-professional`, `/api/my-professionals`, `/api/unlink-professional` |
| Profissional | `/api/pro-me`, `/api/pro-patients`, `/api/pro-patient`, `/api/pro-register` |
| Alertas (Fase 2) | `/api/pro-alerts-list`, `/api/pro-alerts-prefs`, `/api/pro-alerts-dismiss` |
| Pagamento | `/api/mp-create-preapproval`, `/api/mp-webhook` |
| Admin | `/api/admin-*` (~27 rotas, atrás de `ADMIN_OVERRIDE_TOKEN`) |
| Saúde | `/api/health` |

Módulos: `alerts.js` (motor de alertas), `clinical.js` (cálculos),
`ratelimit.js`, `retencao.js`, `supabase.js`, `auth.js`, `mp.js`.

---

## 4. Estado hoje — 10/08/2026

### No ar

| | Versão |
|---|---|
| App (`index.html`) | `3.10.62` |
| Worker Cloudflare | `1.31.0` |
| Domínio | `sanova.app.br` (HTTPS, Cloudflare Pages) |

### Fechado e funcionando

- **RLS do `app_state`** — cada paciente só alcança a própria linha, por
  policy. Era o buraco mais sério da auditoria.
- **LGPD art. 18 é código** — apagar conta apaga no banco; se o backend
  falhar, o app **aborta** a limpeza local em vez de fingir. Portabilidade é
  botão.
- **Retenção automática** — 180 dias para `alert_events`, 24 meses para conta
  inativa. Roda por `retencao.yml`, com teste travando os dois prazos.
- **Rate limit** nas rotas caras e de escrita (worker v1.30.0).
- **`console.error` sanitizado** — cliente recebe código curto, detalhe fica
  no log.
- **`/api/debug-gemini` fora do ar público** — era chamada paga a cada visita
  e devolvia pedaço da chave da Gemini a quem pedisse.
- **Espelho do profissional** — trava server-side, leitura apenas.
- **Cards de share** em todas as superfícies de resultado, canvas local.
- **Bug do peso "20 vs 21 kg"** — duas fontes de verdade reconciliadas (#256).
- **Vírgula decimal nas telas de peso** — helper `nBR()`, 22 pontos (#257).

### Fase 2 (alertas ao profissional) — **ligada, mas com uma lacuna**

`FASE2_ALERTAS_ATIVA = true` em `pro.html:166` desde 07/08 (PR #254).

O padrão entregue é o conservador: os **5 alertas vermelhos** nascem em
`imediato`, os **5 amarelos** nascem em `off` (`alerts.js:327`). O amarelo só
aparece se o profissional pedir, um a um.

> 🔴 **A lacuna, e é séria:** a interface está ligada, mas
> **`run-alert-detection.yml` não tem cron ativo** — está comentado no
> arquivo. Quer dizer: o painel mostra alertas, mas **nada os gera
> automaticamente**. Só disparo manual do workflow.
>
> Um profissional olhando um painel vazio conclui que não há nada errado com
> o paciente. Isso é exatamente o que o termo invertido diz para não deixar
> acontecer. **Trate como prioridade** — ver §13.

---

## 5. As cicatrizes — o que NÃO se toca

Cada uma custou uma sessão do Bruno para aprender.

### Não mexer, sem discussão

| O quê | Por quê |
|---|---|
| `index_vitorioso_sanova.html` | nunca apagar. Regra sagrada. |
| **Não modularizar `index.html`** | arquivo único de ~26 mil linhas **de propósito**. Reescrever em framework não está na mesa. Só edição cirúrgica. |
| `S.caneta` | nome legado, metade do app depende |
| `skipWaiting()` no `sw.js` | sem ele, paciente fica preso em versão velha. Já aconteceu, custou uma noite. |
| Bloqueio de F12 | tem valor jurídico no Brasil |
| **Liraglutida** | manter. Saxenda é real; tirar a molécula exclui pacientes. |
| **Foto do frasco** | não restaurar. Decisão **clínica**: letra pequena em foto de frasco é risco de erro de dose. |
| Logo 🌿 e ícones PNG | não mexer |

### Sempre

- **Subir `SANOVA_VERSION` no `index.html` E `VERSION` no `sw.js`** a cada
  mudança. Esquecer um dos dois prende o paciente em cache. **Este é o erro
  mais fácil de cometer e o mais caro.**
- **Validar HTML balanceado e sintaxe JS** antes de dar por pronto.
- **Trabalho vai em branch + PR.** Nunca push direto na `main`.
- **Nada de lógica em bash dentro de YAML.** O heartbeat falhou 12 vezes
  seguidas por erro de parse causado por markdown dentro de `run: |`. Lógica
  vive em `.github/scripts/*.mjs`; prompt longo vive em `.md`.

### O repositório é público

Nunca em commit, comentário, código, log ou print: token, chave, senha,
código de verificação, telefone, e-mail pessoal, ID de transação, D-U-N-S, ou
dado de paciente.

Referencie **o fato** ("confirmado na tela"), nunca **o valor**. Print de
credencial é vazamento — a foto sobrevive em backup, nuvem e conversa
encaminhada. Já vazou uma vez, exatamente assim.

---

## 6. A fila — o que construir

A fila viva está em **`TRABALHO.md`**. Ela é lida de cima para baixo. Resumo
do que está aberto hoje:

### 1. Cron da detecção de alertas 🔴 *(eu acrescentaria no topo — ver §13)*

Religar `run-alert-detection.yml` (linha comentada, `0 12 * * *` = 09:00 BRT).
Sem isso a Fase 2 está ligada e vazia.

### 2. Vírgula decimal — levas 2 e 3

A leva 1 (peso) saiu na v3.10.62. Sobram **18 usos crus de `toFixed()`**:
água em litros, kcal, IMC, percentual de meta. Mais ~7 lugares que fazem
`.replace('.', ',')` na mão — saída idêntica, mas fora do caminho único.

**Método que funcionou, repita:** leva pequena → teste que quebra se alguém
escrever tela nova errada → versão subida nos dois arquivos. Não varra o
arquivo inteiro de uma vez.

### 3. Contraste de "PROTEÇÃO MUSCULAR"

Relatado, não reproduzido. Precisa de print — é contraste de cor, e cor não
se confere pelo código com confiança. WCAG AA, 4.5:1.

### 4. Monitor da transferência do app

Bloqueado no secret `PLAY_SERVICE_ACCOUNT_JSON`. O estado da transferência
não é público.

---

## 7. Infraestrutura e segredos

### Secrets do repositório — **nomes apenas, nunca valores**

| Secret | Para quê | Existe? |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` / `_ACCOUNT_ID` | deploy do worker e Pages | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` / `_PROJECT_REF` | acesso ao banco | ✅ |
| `SUPABASE_MGMT_TOKEN` | aplicar migrations | ✅ |
| `GEMINI_API_KEY` | análise de foto/texto | ✅ |
| `MP_ACCESS_TOKEN_PROD` / `_SANDBOX` / `MP_WEBHOOK_SECRET` | Mercado Pago | ✅ |
| `ADMIN_OVERRIDE_TOKEN` | rotas `/api/admin-*` | ✅ |
| `ANTHROPIC_API_KEY` | turno autônomo e `@claude` | ✅ |
| `PAGES_ADMIN_PAT`, `DEMO_REVIEW_PASSWORD` | operacional | ✅ |
| **`PLAY_SERVICE_ACCOUNT_JSON`** | **automação da Play Store** | ❌ **falta** |
| `TWA_UPLOAD_KEYSTORE_B64` / `_STORE_PWD` / `_KEY_PWD` | assinatura do AAB | ❌ falta |

### A Play Store — onde o projeto está travado

O app **Sanova — Acompanhamento GLP-1** foi transferido para a conta de
destino em **10/08/2026, 00:09 BRT** (confirmado por notificação do Play
Console e pela thread de suporte `[0-6994000041877]`).

**Por que a conta mudou:** o envio de 18/07 foi recusado — não por qualidade,
mas por tipo de conta. A política do Google exige **conta de organização**
para app de saúde. Efeito colateral bom: conta de organização é **isenta** da
exigência de 12 testadores por 14 dias. A mudança apaga duas semanas do
cronograma.

**O que falta:** os 3 passos da issue **#248** (gerar chave no Google Cloud →
convidar a service account no Play Console → colar o secret no GitHub). Todos
podem ser feitos agora. **São do Bruno** — exigem login pessoal.

---

## 8. Automação — o que roda sozinho

| Workflow | Cron | O que faz |
|---|---|---|
| `worker.yml` | `17 */3 * * *` | executa `automation/backlog.yml` (fila de vigilância) e reporta só o que mudou |
| `claude-turno.yml` | `47 */6 * * *` | lê o estado, julga o que fazer, e faz |
| `heartbeat.yml` | `0 11 * * *` | pulso: versões, PRs, workflows falhados |
| `retencao.yml` | `0 6 * * *` | apaga dado vencido |
| `mp-cleanup-cron.yml` | `0 */6 * * *` | limpeza de assinaturas |
| `run-alert-detection.yml` | ⛔ **comentado** | detecção de alertas — **precisa religar** |
| `claude-mencao.yml` | sob demanda | `@claude <pedido>` em qualquer issue ou PR |

**Dois arquivos de fila, não confunda:**

- `automation/backlog.yml` — **vigilância** (o app está no ar? o secret
  existe? a tabela foi criada?). Executada por robô, sem julgamento.
- `TRABALHO.md` — **construção**. O que implementar.

**Teste do Monitor** — antes de pedir qualquer coisa ao Bruno, pergunte:
*"isso pode virar um monitor automático?"* Se pode, vira item no
`backlog.yml` e **não se pede**. Conferir status de painel externo **nunca**
é tarefa humana.

---

## 9. Como verificar antes de dar por pronto

```bash
# 1. Testes (28 hoje, todos passam)
cd worker && npm test

# 2. Sintaxe de todos os blocos <script> do index.html
node -e "const fs=require('fs');const h=fs.readFileSync('index.html','utf8');
const m=[...h.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g)];
let n=0;for(const s of m){try{new Function(s[1]);n++}catch(e){console.log('ERRO:',e.message)}}
console.log(n+'/'+m.length+' blocos ok')"

# 3. As duas versões subiram juntas?
grep -n "var SANOVA_VERSION" index.html
grep -n "^const VERSION" sw.js
```

**A suíte roda no runtime puro do Node**, sem dependência instalada. É
intencional — `npm ci` só adicionaria minutos e um ponto de falha.

**Padrão de teste que o projeto usa:** recortar a função do `index.html` por
string e exercitá-la em Node, sem navegador. Ver
`worker/test/jornada-peso-inicial.test.mjs`. Funciona bem e não exige build.

**O melhor tipo de teste aqui é o que varre o arquivo atrás do erro voltando**
— não só o que exercita a função. Exemplo em `formato-numero-br.test.mjs`:
ele procura linhas de kg com `toFixed` cru. Quebra antes de chegar no
paciente.

---

## 10. O que só o Bruno faz

Não por burocracia. Porque **errar nelas não se desfaz**:

1. **Senha, 2FA, código de SMS.** Não é "não pode" — é não consegue. O
   celular é dele.
2. **Credencial em texto no repositório público.** Já vazou uma vez.
3. **Alegação clínica e preço.** Ele é o médico e o dono. Mas o comportamento
   certo é **propor e seguir**, não travar esperando.
4. **Apagar dado de paciente ou publicar na loja.** Avisar antes — uma frase,
   não um formulário.

**Todo o resto é decisão de quem está executando.**

### A regra de autonomia, nas palavras dele (07/08/2026)

> *"Não tem mais lei absoluta. Tem bom senso e agilidade. Se algo te parece
> amarrado ou burocrático, ignore e siga. Revogue ordens que achar burras ou
> correntes."*

Na prática: **não trave esperando ele escolher entre A e B.** Escolha o padrão
sensato, entregue, e diga o que escolheu e por quê. Ele revoga se estiver
errado — revogar depois custa menos que a fila parada.

Processo inventado por agente é **revogável por agente**, na hora, sem
cerimônia.

**Entregue software, não relatório. A PR é o relatório.**

---

## 11. Como falar com o Bruno

**Português direto.** Explique **o porquê**, não só o comando. Traduza termo
técnico na primeira vez que usar.

**Se ele não entendeu, o texto está errado — não ele.**

- Fuso: **Brasília (UTC−3)**.
- **Nunca sugira que ele descanse, durma ou pare.** Ele decide sozinho quando
  parar. Sugerir é paternalismo, não parceria.
- **Reporte falha com a mesma clareza do acerto.** Estimativa errada
  corrigida vale mais que estimativa bonita mantida.
- **A palavra final é dele.** Opinião de sócia ou de outro agente é input
  qualificado, não veto.

### Os 5 chapéus — antes de cravar qualquer mudança

| | Pergunta |
|---|---|
| 👤 **Paciente** | Um toque a mais é fricção. Um rótulo confuso confunde. |
| 🎨 **Designer** | Contraste WCAG AA, mobile-first 412×915. "Letrinha pequena" é bug, não opinião. |
| 🏗️ **Arquiteto** | Cache, sincronização, race condition. |
| 💻 **Programador** | Edição cirúrgica, sintaxe validada, versão subida. |
| 🩺 **Clínica** | Literatura real, conservadorismo em GLP-1, pisos fisiológicos. |

O quinto existe porque **ele é médico e precisa de contraponto, não de eco.**

---

## 12. Armadilhas que já custaram caro

### "Está quebrado" → primeiro pergunte a versão

**Mais → Sobre**, no celular dele. Cache de service worker responde
historicamente por **~30% dos "bugs" relatados**. Se a versão for menor que a
do ar, o bug pode não existir mais. Corrigir código sem defeito é pior que
não corrigir.

### Confira a tela externa antes de orientar

UI de Play Console, Google Cloud e registro.br muda. Memória de treinamento
envelhece. Em 16/06 isso custou **uma hora** dele procurando "Acesso à API"
no Play Console — a tela já não era o caminho. Um fetch na documentação teria
evitado.

### Data de e-mail não é data do fato

*(Erro meu, 10/08 — registrado para não repetir.)* Li o primeiro e-mail de
uma thread de suporte, de 4 dias antes, como se fosse recente, e orientei o
Bruno a esperar por algo **que já tinha acontecido**. A mesma thread tinha a
resposta de conclusão logo abaixo.

**Antes de orientar com base em e-mail: confira a data da mensagem e se
existe resposta mais nova na mesma thread.**

### Documento envelhece em silêncio

Encontrei neste turno: `TRABALHO.md` listava a retenção de dados como aberta
e *esperando decisão do Bruno* — ela já estava implementada e rodando.
`ESTADO.md` dizia que a Fase 2 estava desligada — estava ligada desde 07/08.
Um monitor ficou vermelho 3 dias por versão cravada à mão.

**Fila que mente sobre si mesma faz o turno seguinte reimplementar o que já
existe.** Antes de pegar tarefa, confirme no código que ela ainda existe.

---

## 13. O que eu deixo em aberto — leia isto

Coisas que eu faria a seguir, em ordem, e o porquê.

### 🔴 1. O cron da detecção de alertas

`run-alert-detection.yml` tem o `schedule` comentado. A Fase 2 está ligada na
interface desde 07/08, mas **nada gera alerta automaticamente** — só disparo
manual.

O comentário no arquivo diz que foi desativado "até Bruno cravar limiares
finais + portão regulatório T50". Mas os limiares **foram** cravados em 07/08
(vermelhos em `imediato`, amarelos em `off`) e a flag foi ligada. O cron
parece ter ficado para trás, não ter sido decidido.

**Por que é sério:** profissional olhando painel vazio conclui que não há nada
errado com o paciente. É exatamente o que o termo invertido existe para
impedir. Ou o cron liga, ou o painel precisa dizer que a detecção é manual.

**Não decida isso sozinho** — é limiar clínico com portão regulatório
mencionado. Leve ao Bruno com a recomendação pronta.

### 🟡 2. Verificar se o painel do profissional já tem paciente real

Toda a Fase 2 foi construída e ligada sem que eu conseguisse confirmar se
existe profissional cadastrado com paciente vinculado. Se não existe, a
lacuna do cron é teórica hoje — e urgente no dia do piloto.

### 🟡 3. Terminar as levas 2 e 3 da vírgula

Mecânico, com método já provado. Bom primeiro commit para calibrar.

### ⚪ 4. `ESTADO.md` mente sobre a versão do worker

Diz `1.30.0`; o código responde `1.31.0` em `/api/health`. Sintoma do mesmo
problema do §12: documento de estado precisa ser gerado ou verificado, não
digitado.

---

## Mapa de arquivos

| Arquivo | O que é |
|---|---|
| `CLAUDE.md` | instruções lidas automaticamente no início de sessão |
| `DECISOES.md` | **as cicatrizes, em detalhe. Leia antes de codar.** |
| `ESTADO.md` | onde o projeto está hoje (volátil) |
| `TRABALHO.md` | fila de construção |
| `LANCAMENTO.md` | caminho até a Play Store |
| `automation/backlog.yml` | fila de vigilância (robô) |
| `HANDOFF.md` | documento-mestre antigo, **arquivado** — não leia |
| `docs/checklist-d-zero.md` | roteiro do dia da publicação |
| `docs/data-safety-form.md` | formulário do Google, pré-respondido |
| `store-assets/ficha-loja.md` | ficha da loja |
| `SINTOMAS_GLP1.md` | referência clínica dos sintomas |
| issue **#248** | o que precisa do Bruno |

---

## Primeiros 30 minutos, se eu fosse você

1. Ler `DECISOES.md` inteiro (209 linhas, é a lei do projeto)
2. `cd worker && npm test` — ver os 28 passarem
3. Abrir https://sanova.app.br no celular e usar o app como paciente
4. Ler §13 acima e decidir o que levar ao Bruno
5. Pegar a leva 2 da vírgula como primeiro commit — pequena, verificável, com
   método já provado

Boa sorte. O projeto está em bom estado: o que existe funciona, tem teste, e
o que falta está escrito.

*— Claude Code, 10/08/2026*
