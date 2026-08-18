# 🌿 Estado do Sanova

Onde o projeto está **hoje**. Arquivo volátil por natureza — sobrescrito, não
acumulado. Para as regras que não mudam, veja `DECISOES.md`.

*Atualizado em 10/08/2026.*

---

## No ar

| | Fonte de verdade (não digitar número aqui) |
|---|---|
| App | `SANOVA_VERSION` no `index.html` = o que `sanova.app.br` serve |
| Worker | `version` no `worker/src/index.js` = o que `/api/health` responde |
| Domínio | `sanova.app.br` (HTTPS, Pages) |

> Números de versão **não moram aqui** — moram no código, e os monitores
> `worker-no-ar` e `app-no-ar` (`automation/backlog.yml`) comparam repo vs. ar
> a cada ciclo. Esta tabela já mentiu (dizia app 3.10.62 / worker 1.31.0 com o
> ar em 3.10.63 / 1.31.1). Fato de estado que se pode conferir sozinho não se
> copia à mão — o Grok apontou (S5, 18/08) e a razão é a mesma da sessão
> inteira: documento não é tela.

## Fechado recentemente

- **Vírgula decimal nas telas de peso** — o app é brasileiro e imprimia
  "20.5 kg". Helper único `nBR()`, 22 pontos de kg migrados, teste que
  quebra se alguém escrever tela nova de kg com `toFixed` cru. Água, kcal e
  IMC ficam pras próximas levas.
- **Bug do peso "20 vs 21 kg"** — havia duas fontes de verdade pro peso
  inicial (declarado na anamnese vs. primeira pesagem). O painel usava uma,
  o card de compartilhar usava a outra. Achado lendo o código, sem print.
- **Retenção automática de dados** — 180 dias pra `alert_events`, 24 meses
  pra conta inativa. A política de privacidade deixou de ser só papel.
- **Rate limit, `console.error` sanitizado e `/api/debug-gemini` fora do ar**
  — a rota de debug era chamada paga a cada visita e devolvia pedaço da
  chave da Gemini a quem pedisse *(worker v1.30.0)*.
- **RLS do `app_state` trancado no banco** — cada paciente só alcança a
  própria linha, por policy. Era o buraco mais sério da auditoria.
- **Schema da Fase 2 aplicado** — `alert_events` e
  `professional_alert_prefs`, com a policy que deixa o paciente ler os
  alertas sobre ele mesmo (transparência LGPD).
- **LGPD art. 18** — apagar conta apaga no banco; portabilidade é botão.
- **Espelho do profissional** — trava server-side, leitura apenas.
- **Cards de share** em todas as superfícies de resultado, canvas local.
- **Autonomia nível 2** — `claude-turno.yml` (cron 6/6h) e
  `claude-mencao.yml` (`@claude` em qualquer issue ou PR).
- **Worker autônomo** — `automation/backlog.yml` executado de 3/3h.

## Publicação na Play: resolvida em 15/08

`publish-play.yml` **sobe sozinho**. Provado na rodada 7: `COMMITED_EDIT_ID`
gravado pelo Google, v3.10.63 na faixa de teste interno. Nenhuma tarefa do
Bruno no caminho.

O que o pipeline faz hoje, do início ao fim:

| etapa | o que resolve |
|---|---|
| diagnóstico da Play API | falha em 5s com a causa escrita, antes do build |
| `versionCode` | perguntado ao Google (maior já enviado + 1) |
| Bubblewrap `update` + `build` | AAB assinado com a upload key fixa |
| `jarsigner -verify` | recusa bundle sem assinatura aqui, não no Google |
| upload | faixa e status escolhidos no dispatch |

Cinco bugs custaram sete rodadas. Todos travados por teste em
`worker/test/publish-play.test.mjs` — o detalhe de cada um está no
`DECISOES.md`.

> ⚠️ Não procure **"Acesso à API"** no Play Console. Essa tela deixou de ser
> o caminho — o Google removeu a exigência de vincular projeto do Cloud. Vá
> por **Usuários e permissões** e convide o e-mail da service account como
> convidaria uma pessoa. Foi o que custou uma hora em 16/06.

> ⚠️ Permissão marcada no Play Console **leva horas pra valer na API**. Um
> 403 logo depois de marcar não é erro de configuração — é propagação.
> Esperar e disparar de novo resolve. Isso quase virou tarefa do Bruno.

## Bloqueado, e em quem

### 12 testadores no teste fechado 🔴 **o único bloqueio real da loja**

Estado lido no painel em 15/08: **0 testadores**. O botão *Solicitar a
produção* está desabilitado, e os dois requisitos abertos são

> Tenha pelo menos 12 testadores que aceitaram participar do teste fechado
> Faça o teste fechado com no mínimo 12 testadores por pelo menos 14 dias

**O relógio dos 14 dias não começou** — ele só começa quando as 12 pessoas
aceitarem. É a tarefa mais lenta da fila e a única sem atalho.

**Cadeia validada de ponta a ponta em 15/08.** As duas revisões do Google
terminaram; a faixa "Teste fechado - Alpha" está **Ativo**; a v3.10.63 (109)
está **"Versão disponível para testadores selecionados"** (check verde). O
Bruno abriu o link de participação, clicou "Become a tester" e recebeu o selo
**"Você é um testador."** — o fluxo inteiro, do build ao aceite, está provado.

**Testadores hoje: 1** (o próprio Bruno, conta pessoal). Faltam **11** para os
12 que o Google exige (mirar em ~14 para folga contra desistência).

**Link de participação:** `https://play.google.com/apps/testing/br.app.sanova`
Só funciona para conta que esteja na lista. O link de download que o Google
oferece após o aceite é a **ficha pública normal**
(`play.google.com/store/apps/details?id=br.app.sanova`) — quem decide qual
versão chega é o vínculo da conta ao programa, não a URL. Por isso: o testador
tem que abrir a Play Store **logado na conta convidada**.

> ⚠️ O único elo ainda não exercido é **instalar no celular** — nenhum agente
> faz isso (Chrome de desktop não instala app Android). É passo do Bruno.

Não falta mais nada do lado técnico. Falta gente aceitar.

> ⛔ Este arquivo e outros três diziam que **conta de organização é isenta**
> desses 14 dias. Estava errado — ver `DECISOES.md`, seção 6c.

Todo o resto da loja está pronto: 10 de 10 declarações concluídas, ficha no
ar sem erro, política sem avisos, nenhuma alteração em análise.

### Pendências do Bruno

- **Print do contraste de "PROTEÇÃO MUSCULAR"** — é o único bug de tela que
  sobrou. O do peso foi achado sem print, lendo o código; este é contraste
  de cor, e cor eu não enxergo pelo código com a mesma confiança.
*A transferência do app saiu desta lista — concluída, ver abaixo.*

## Transferência do app: concluída em 10/08

O app **Sanova — Acompanhamento GLP-1** foi transferido para a conta de
destino (a do `contatosanovaapp@gmail.com`) em **10/08/2026, 00:09 BRT**.
Confirmado por dois canais independentes: notificação do Play Console
(`noreply-play-console@`) e a thread de suporte `[0-6994000041877]`
(`googleplay-developer-support@`).

Com isso, **os 3 passos da issue #248 podem ser feitos de uma vez.** Não há
mais dependência de espera. Permissão de usuário no Play Console pertence à
conta, não ao app — o convite da service account tem que sair na conta de
destino, que agora é onde o app está.

> ⚠️ **Cuidado com data em e-mail de suporte.** O primeiro e-mail da thread
> (06/08) anunciava "2 dias úteis" e foi lido em 10/08 como se fosse recente
> — o que gerou uma orientação errada de esperar até 12/08. A thread já tinha
> resposta de conclusão. **Antes de orientar com base em e-mail, conferir a
> data da mensagem e se existe resposta mais nova na mesma thread.**

O aviso do Google sobre relatórios, dados financeiros e o teto de US$ 1 mi
da taxa de 15% **não atinge o Sanova**: o app não usa Play Billing (cobrança
é Mercado Pago, por fora) e ainda não está público — não há pedido,
faturamento nem histórico a perder.

*`MP_ACCESS_TOKEN_PROD` saiu desta lista: já está no cofre. Foi listado sem
conferir.*

Cada um desses tem monitor na fila. Quando resolverem, o worker anuncia
sozinho — ninguém precisa conferir painel.

### Fila do Code

- **Religar o cron da detecção de alertas** — ver abaixo, é o mais urgente
- Vírgula decimal, levas 2 e 3 (água, kcal, IMC) — 18 pontos

## Fase 2 (alertas) — **ligada** desde 07/08, mas sem quem alimente

`FASE2_ALERTAS_ATIVA = true` em `pro.html:166` (PR #254). O padrão entregue é
o conservador, e não precisou de linha nova: os **5 alertas vermelhos** nascem
em `imediato` e os **5 amarelos** em `off` (`alerts.js:327`). O amarelo só
aparece se o profissional pedir, um a um.

> 🔴 **A lacuna:** `run-alert-detection.yml` está com o `schedule` comentado.
> A interface mostra alertas, mas **nada os gera automaticamente** — só
> disparo manual do workflow.
>
> O comentário no arquivo diz que o cron esperava o Bruno cravar limiares e o
> portão regulatório T50. Os limiares **foram** cravados em 07/08 e a flag foi
> ligada; o cron parece ter ficado para trás, não ter sido decidido.
>
> **Por que é sério:** profissional olhando painel vazio conclui que não há
> nada errado com o paciente. É exatamente o que o termo invertido existe pra
> impedir — *ausência de alerta não significa ausência de risco*.
>
> Ou o cron liga, ou o painel precisa dizer que a detecção é manual. **Não é
> decisão de engenharia sozinha** — tem limiar clínico e portão regulatório
> no meio. Levar ao Bruno com recomendação pronta.

## Como o trabalho anda sozinho

| Automação | Ritmo | O que faz |
|---|---|---|
| `worker.yml` | 3/3h | executa `automation/backlog.yml` e reporta só o que mudou |
| `claude-turno.yml` | 6/6h | lê o estado, julga o que fazer, e faz |
| `claude-mencao.yml` | sob demanda | `@claude <pedido>` em qualquer issue ou PR |
| `heartbeat.yml` | 1×/dia | pulso: versões, PRs, workflows falhados |

Para mandar serviço sem abrir sessão: comentar `@claude <o que precisa>` em
qualquer issue ou PR do repositório.
