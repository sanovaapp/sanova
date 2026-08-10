# 🌿 O que construir

Esta é a **lista de tarefas do robô** — o que ele pega quando acorda, de cima
pra baixo.

Não confundir com `automation/backlog.yml`, que é a lista de **vigilância**
(coisas pra ficar de olho, tipo "o app está no ar?"). Aqui é a lista de
**construção**.

O turno autônomo (`claude-turno.yml`, de 6 em 6 horas) lê este arquivo, pega
a primeira tarefa livre de cima pra baixo, implementa, abre a PR e risca a
linha daqui. Se todas estiverem riscadas, ele não inventa trabalho — reporta
que a fila secou e para.

---

## Como escrever uma tarefa aqui

```
- [ ] Título curto e concreto
      POR QUE: o problema real, em uma frase
      PRONTO QUANDO: como saber que acabou, de forma verificável
      DECISÃO: (só se precisar) o que o Bruno tem que escolher antes
```

Regras que valem pra toda tarefa desta lista:

- **Uma tarefa por PR.** Duas coisas juntas viram uma PR que ninguém entende.
- **Se mexer em texto que o paciente lê, limiar clínico ou preço**, a PR sai
  com o rótulo `decisao-humana`. Na dúvida, marca.
- **Tarefa com `DECISÃO:` pendente não se implementa.** Vira pergunta na fila
  de decisões e espera. Adivinhar o que o Bruno quer é pior que esperar.
- Antes de começar, ler `DECISOES.md`. É a lei do projeto.

---

## Fila

### Segurança e LGPD — o que protege paciente vem primeiro

*As duas primeiras saíram no worker v1.30.0.*

*Nada aberto aqui. A retenção saiu — está no riscado, com o prazo que ficou
cravado.*

### Bugs abertos

> ⚠️ **Antes de investigar qualquer um dos dois:** conferir qual versão
> aparece em **Mais → Sobre** no celular do Bruno. Cache de service worker
> responde historicamente por ~30% dos "bugs" relatados aqui. Se a versão for
> menor que a do ar, o bug pode não existir mais — e corrigir código que não
> tem defeito é pior que não corrigir nada. *(regra migrada do HANDOFF)*

- [ ] **Contraste ruim em "PROTEÇÃO MUSCULAR"**
      POR QUE: relatado pelo Bruno, não reproduzido. Texto pouco legível
      sobre o fundo em alguma combinação de tela.
      PRONTO QUANDO: identificado em qual tela/estado acontece e corrigido
      com contraste que passe no mínimo de acessibilidade (WCAG AA, 4.5:1).
      DECISÃO: print.

- [ ] **Número decimal com ponto — levas 2 e 3 (água, kcal, IMC)**
      POR QUE: a leva 1 (peso) saiu na v3.10.62 — helper `nBR()` criado e as
      21 telas de kg passando por ele. Sobram **18 usos crus de `toFixed()`**
      fora do peso: água em litros, kcal, IMC e o percentual de meta.
      PRONTO QUANDO: os 18 passam por `nBR()`, e o teste de regressão em
      `worker/test/formato-numero-br.test.mjs` cobre cada leva (hoje ele
      guarda só as telas de kg).
      CUIDADO: manter o método que funcionou — leva pequena, teste que
      quebra se alguém escrever tela nova com `toFixed` cru, versão subida
      nos dois arquivos. Não varrer o arquivo de uma vez.
      NOTA: existem ainda ~7 lugares que já fazem `.replace('.', ',')` na
      mão. Saída idêntica, mas fora do caminho único — unificar junto.

### Play Store

- [ ] **Monitor da transferência do app**
      POR QUE: hoje só se descobre se a transferência pra conta MEDFAST saiu
      abrindo o painel do Google. Isso é vigilância recorrente — pertence ao
      robô, não ao Bruno.
      PRONTO QUANDO: existe tarefa no `backlog.yml` que consulta a Google
      Play Developer API e reporta só quando o estado muda.
      BLOQUEADO POR: o secret `PLAY_SERVICE_ACCOUNT_JSON` não existe. Não há
      caminho alternativo — o estado da transferência não é público.

### Produto

- [ ] **Ligar a Fase 2 (alertas ao profissional)**
      POR QUE: o código está pronto e o schema aplicado, mas a interface está
      desligada atrás de uma chave (`FASE2_ALERTAS_ATIVA = false`). Trabalho
      feito e parado não vale nada.
      PRONTO QUANDO: a chave está ligada e o profissional vê os alertas.
      DECISÃO: liga tudo, ou só os 5 alertas vermelhos primeiro? Os vermelhos
      são os que protegem; os amarelos são os que incomodam. Chamada do Bruno.

---

## Riscado (fica como registro, não some)

- [x] Vírgula decimal nas telas de peso — helper único `nBR()`; 22 pontos de
      kg migrados e um teste que quebra se alguém escrever tela nova de kg
      com `toFixed` cru. Levas de água/kcal/IMC seguem abertas *(v3.10.62)*
- [x] Monitor de versão do app parou de cravar a versão à mão — compara o que
      está no ar contra o `index.html` do repositório. Ele ficou 3 dias
      vermelho por alarme falso, que é o único jeito de um monitor atrapalhar
- [x] Retenção automática de dados — apaga `alert_events` com mais de **180
      dias** e sinaliza conta inativa há **24 meses**. Roda por
      `retencao.yml`, com teste travando os dois prazos (mudar prazo agora
      quebra teste, que é o ponto: é promessa pública, não constante)
- [x] Badge de peso "20 vs 21 kg" — duas fontes de verdade pro peso inicial (declarado vs. primeira pesagem); card de jornada usava a errada. Achado lendo o código, sem print, com 6 testes de regressão
- [x] RLS do `app_state` — cada paciente só alcança a própria linha, pelo
      banco e não pela boa vontade do código
- [x] LGPD art. 18 — apagar conta apaga de verdade no banco; portabilidade
      virou botão
- [x] Espelho do profissional com trava no servidor
- [x] Cards de resultado em todas as superfícies, desenhados no aparelho
- [x] Heartbeat que nunca tinha rodado (12 falhas seguidas por erro de parse)
- [x] Worker autônomo executando a fila de vigilância
- [x] Turno autônomo e `@claude`
- [x] Limite de chamadas por IP nas rotas caras e nas de escrita
      *(worker v1.30.0)*
- [x] Erro do servidor não devolve mais o detalhe interno pro navegador —
      o cliente recebe um código curto, o detalhe fica no log *(worker v1.30.0)*
- [x] `/api/debug-gemini` saiu do ar público: era chamada paga a cada visita,
      e devolvia pedaço da chave da Gemini a quem pedisse *(worker v1.30.0)*
