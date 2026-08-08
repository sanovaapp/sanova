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

- [ ] **Número decimal aparece com ponto em vez de vírgula**
      POR QUE: achado em 07/08 enquanto eu caçava o bug do peso. O app é
      brasileiro e mostra "20.5 kg" em vez de "20,5 kg" na maioria das
      telas. São **52 usos de `toFixed()` no `index.html` e só 9 com a
      troca por vírgula** — ou seja, a inconsistência é a regra, não a
      exceção.
      PRONTO QUANDO: existe um helper único de formatação, todos os lugares
      passam por ele, e há teste cobrindo o helper.
      CUIDADO: são ~43 pontos de alteração num arquivo de 26 mil linhas, e
      eu não consigo ver o app rodando. Fazer em levas pequenas e
      verificáveis, começando pelas telas de peso — não numa varredura só.

### Play Store

- [ ] **Monitor da transferência do app**
      POR QUE: hoje só se descobre se a transferência pra conta MEDFAST saiu
      abrindo o painel do Google. Isso é vigilância recorrente — pertence ao
      robô, não ao Bruno.
      PRONTO QUANDO: existe tarefa no `backlog.yml` que consulta a Google
      Play Developer API e reporta só quando o estado muda.
      BLOQUEADO POR: o secret `PLAY_SERVICE_ACCOUNT_JSON` não existe. Não há
      caminho alternativo — o estado da transferência não é público.

---

## Riscado (fica como registro, não some)

- [x] Retenção automática de dados — `alert_events` >180 dias apaga de
      verdade; conta inativa >24 meses só conta (apagar é ato consciente,
      `aplicar=1`). Cron diário 03:00 BRT. *(PR #254)*
- [x] Fase 2 ligada (alertas ao profissional) — entrou no padrão mais
      conservador que já existia no código: os 5 alertas vermelhos em
      `imediato`, os 5 amarelos em `off` até o profissional pedir.
      *(PR #254)*
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
