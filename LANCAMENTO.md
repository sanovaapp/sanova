# 🌿 Checklist de lançamento

O caminho do ponto onde estamos até o Sanova na mão de pacientes reais.

Escrito em português simples de propósito — o dono deste checklist é o Bruno,
que é médico, não programador. Se alguma linha aqui só faz sentido pra
engenheiro, ela está mal escrita e deve ser reescrita.

*Atualizado em 15/08/2026.*

---

## Onde estamos

O app está **pronto e no ar** em `sanova.app.br`. Funciona hoje, no navegador
de qualquer celular. O que falta é estar **na Play Store**.

Ele já foi enviado uma vez, em 18/07, e foi **recusado** — não por qualidade,
mas por tipo de conta: a política do Google exige conta de organização para
app de saúde. Por isso a mudança pra conta **MEDFAST**, concluída em 10/08.

Desde 15/08 a **esteira de publicação está pronta e testada**: o robô monta o
app, assina, e sobe no Play Console sozinho. O que resta é o Google analisar.

## ⛔ Os 14 dias VALEM — corrigido em 15/08

**Este documento afirmava o contrário e estava errado.** Dizia que conta de
organização é isenta dos 12 testadores por 14 dias, e que a mudança pra
MEDFAST apagava duas semanas do cronograma.

O painel do Play Console, lido na tela em 15/08, diz outra coisa. Na seção
**Produção → Solicitar o acesso de produção**, com a conta de organização já
ativa, os dois itens estão abertos:

> Tenha pelo menos 12 testadores que aceitaram participar do teste fechado
> — *0 testador está participando no momento*
>
> Faça o teste fechado com no mínimo 12 testadores por pelo menos 14 dias

E o botão **Solicitar a produção** está **desabilitado**.

A regra da isenção existiu e foi lida na documentação. **A tela venceu a
documentação** — e é exatamente por isso que o `DECISOES.md` manda conferir a
tela antes de orientar. Custou uma expectativa de prazo errada.

**O que isso muda de concreto:** o relógio dos 14 dias **não começou**, porque
há **0 testadores**. Ele começa no dia em que 12 pessoas aceitarem o convite
do teste fechado — não antes.

---

## Etapa 1 — Destravar a esteira ✅ **concluída em 15/08**

*A esteira está de pé. O robô sobe versão sozinho.*

### 1.1 — A chave da Play Store ✅

Feito. A conta de serviço `play-deploy@` está convidada no Play Console da
conta org e o secret `PLAY_SERVICE_ACCOUNT_JSON` está no cofre.

> ⚠️ **Não procure "Acesso à API"** no menu do Play Console. Essa tela deixou
> de ser o caminho. Vá em **Usuários e permissões** e convide o e-mail da
> conta de serviço como convidaria uma pessoa. Foi isso que custou uma hora
> em 16/06.

> ⚠️ Permissão recém-marcada **leva horas pra valer na API**. Um 403 logo
> depois de marcar é propagação, não erro de configuração. Esperar e disparar
> de novo resolve — não mexa em nada.

### 1.2 — A assinatura de junho ✅

O ZIP do PWABuilder foi achado. As três peças estão no cofre
(`TWA_UPLOAD_KEYSTORE_B64`, `TWA_UPLOAD_STORE_PWD`, `TWA_UPLOAD_KEY_PWD`) e a
impressão digital bate com o `assetlinks.json` publicado.

### 1.3 — Testar a esteira antes de precisar dela ✅

Testado de verdade, não no papel: rodada 7 do `publish-play.yml` subiu a
v3.10.63 na faixa de teste interno e o Google devolveu `COMMITED_EDIT_ID`.

Cinco bugs no caminho, sete rodadas, nenhuma tarefa sua. O detalhe de cada um
está no `DECISOES.md`, seção 6b.

**Como subir uma versão nova, daqui em diante:** Actions → *Publish TWA to
Google Play* → *Run workflow* → escolher faixa e status. O número da versão o
próprio Google informa; ninguém digita nada.

---

## Etapa 2 — O teste fechado ⬅ **é aqui que estamos**

*Estado lido na tela em 15/08. Tudo conferido, nada deduzido.*

### O que já está pronto ✅

| item | estado |
|---|---|
| Conta | Organização, ativa |
| Status da política | Sem problemas, na conta e no app |
| Alterações em análise | Nenhuma — publicado em 14/08 |
| Declarações obrigatórias | **10 de 10 concluídas** |
| Ficha da loja | No ar, sem erro |
| Teste fechado | 4 de 5 tarefas |

As 10 declarações, todas fechadas: Apps de saúde · ID de publicidade ·
Recursos financeiros · Apps governamentais · Segurança dos dados · Política
de Privacidade · Anúncios · Detalhes do login · Classificações de conteúdo ·
Público-alvo e conteúdo.

### 2.1 — Os 12 testadores 🔴 **o único bloqueio real**

- [ ] **Bruno** — 12 pessoas que aceitem o convite do teste fechado

Hoje são **0**. O relógio dos 14 dias começa quando elas aceitarem, e não
antes. É a tarefa mais lenta da fila inteira e a única que não tem atalho.

Vale qualquer pessoa com conta Google: colegas, familiares, equipe. Não
precisa ser paciente — precisa aceitar o convite e manter o app instalado.

### 2.2 — Os 14 dias

- [ ] **Ninguém** — é espera. O robô acompanha e avisa quando fechar.

### 2.3 — Solicitar acesso de produção

- [ ] **Bruno** — Painel → Produção → *Solicitar a produção*

O botão está **cinza** hoje. Ele acende sozinho quando 2.1 e 2.2 fecharem.

### 2.4 — Publicar

- [ ] **Bruno** — a decisão de colocar na mão de paciente real é dele

### 2.5 — Pendência menor, sem pressa

- [ ] Capturas de tela de tablet de 7" e 10" — marcadas como obrigatórias na
      ficha, mas **sem erro exibido** e sem bloquear nada hoje. Resolver antes
      da produção, não antes do teste fechado.

---

## Etapa 3 — Piloto

- [ ] **Bruno** — convidar os primeiros pacientes reais
- [ ] **Bruno** — grupo de WhatsApp (kit pronto)
- [ ] **Robô** — acompanhar erros e travamentos relatados pela loja
- [ ] **Robô** — 2 ou 3 versões pequenas nas primeiras semanas

---

## Etapa 4 — Enquanto isso, em paralelo

*Nada aqui depende do Google. É a fila do robô, em
[`TRABALHO.md`](TRABALHO.md).*

### Segurança — as duas livres, e é por elas que ele começa

- [ ] Limite de chamadas na API *(hoje qualquer um pode martelar sem freio)*
- [ ] Parar de vazar detalhe interno nas mensagens de erro

### Travadas numa decisão sua

- [ ] Apagar dados velhos automaticamente — *falta você definir o prazo*
- [ ] Ligar os alertas ao profissional — *tudo, ou só os vermelhos?*
- [ ] Dois bugs de tela — *falta print, sem ele eu chutaria*

As decisões estão em [#248](https://github.com/sanovaapp/sanova/issues/248),
respondíveis com uma letra.

---

## O caminho mais curto até a loja

Se der pra fazer só uma coisa hoje, é a **1.2** — achar o ZIP de junho.

Não porque seja a mais importante, mas porque é a única cujo **atraso custa
dias**. Se a assinatura tiver sumido, o pedido de troca ao Google leva tempo,
e é melhor descobrir isso enquanto a transferência ainda está na fila deles
do que no dia em que tudo o mais estiver pronto.

---

## Referências

| O quê | Onde |
|---|---|
| Ficha da loja | `store-assets/ficha-loja.md` |
| Formulário de segurança de dados, pré-respondido | `docs/data-safety-form.md` |
| Guia da conta de serviço | `docs/prompt-chrome-service-account.md` |
| Roteiro detalhado do dia da publicação | `docs/checklist-d-zero.md` |
| Política de privacidade | https://sanova.app.br/privacidade.html |
| Página de exclusão de conta | https://sanova.app.br/exclusao.html |
