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

### ⭐ Onda Bruno 21/08 — "qualidade e objetividade" (diretriz viva)

> *"Será uma grande [mudança] em várias frentes. Meu afastamento do app
> ajudou nisso. Será mais direto e intuitivo, dando um verdadeiro sentido ao
> app. Não quantidade mas qualidade e objetividade."* — Bruno, 21/08/2026

Bruno vai ditando as frentes uma a uma. Regra: implementar no ritmo dele,
sem esperar aprovação entre frentes ("vc faz as mudanças no seu tempo").

- [x] Frente 1 — Check-in abre com **registro de proteína** (card Proteína
      primeiro, via único gravador de refeição); card contextual de
      medicação REMOVIDO do check-in (redundância). v3.10.78, PR #297.
- [x] Frente 2 — Fórmula ideal do Painel (aprovada por preview em 21/08):
      ZERO accordion na home (regra dos vencedores — Whoop/Oura/Noom/Shotsy);
      anéis do dia (proteína·água·kcal·treino, toque registra), card Potência
      da medicação com mini-curva (o diferencial em vitrine), Lição do dia,
      portas de 1 linha (Progresso de peso). Aba Saúde vira a casa: Análises
      · Referência · Biblioteca. Fix: trio dos pilares 393px>350px
      (minmax(0,1fr)). v3.10.79, PR #298. Pesquisa de mercado com fontes na PR.
- [ ] Frentes seguintes: aguardando o Bruno ditar.


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

- [x] ~~**Monitor da transferência do app**~~ — sem objeto. A transferência
      saiu em 10/08 e o `publish-play.yml` já fala com a Play API direto.

- [ ] **Vigilância do estado da revisão**
      POR QUE: hoje só se descobre se o Google aprovou abrindo o painel. Isso
      é vigilância recorrente — pertence ao robô, não ao Bruno.
      PRONTO QUANDO: existe tarefa no `backlog.yml` que consulta a Play
      Developer API e reporta **só quando o estado muda**.
      DESBLOQUEADO: `PLAY_SERVICE_ACCOUNT_JSON` existe e funciona desde
      15/08. A mesma máquina de token do `publish-play.yml` serve aqui.

### Produto

- [x] ~~**Ligar a Fase 2 (alertas ao profissional)**~~ — já está ligada.
      `pro.html` tem `FASE2_ALERTAS_ATIVA = true` desde 07/08. Este item
      ficou pra trás e virou contradição de documento (auditoria Manus,
      observação 15).

### Da sessão de cache/sincronização (18/08) — o que ficou pra fila

*Contexto: pergunta do Bruno sobre risco de cache/localStorage desatualizado.
Os itens 1 (trava de versão em par) e 2 (carimbo de sync no espelho) foram
feitos na hora. Estes são os que ficaram:*

- [ ] **Indicador de "não sincronizado" pro paciente**
      POR QUE: hoje o paciente não sabe se o último registro já subiu pra
      nuvem. Se o celular ficar dias offline, ele acha que o médico está
      vendo — e não está.
      PRONTO QUANDO: um selo discreto aparece quando há dado local mais novo
      que a última sync bem-sucedida, e some quando sincroniza.

- [ ] **Fusão por união dos registros de série temporal**
      POR QUE: o conflito entre dois aparelhos hoje é resolvido por carimbo
      do estado INTEIRO — o mais novo vence e um registro feito no aparelho
      "perdedor" some. União campo a campo (pesos, doses, sintomas,
      refeições por timestamp) elimina a perda.
      CUIDADO: mexe no coração da sync (v3.10.14). Só com teste cobrindo os
      cenários de conflito ANTES da mudança.

- [ ] **Carimbo de versão no dado local + migração explícita**
      POR QUE: mudança de formato do `S` lida por versão antiga produz
      número torto em silêncio. Já existe backup pré-sobrescrita; falta
      `S._schema` e um degrau de migração por versão.

- [ ] **Carimbo de sync na lista de pacientes do pro.html**
      POR QUE: o banner do espelho já mostra a idade do dado (v3.10.65), mas
      a lista de pacientes no painel ainda não — o pro pode escolher quem
      olhar baseado em lista silenciosamente desatualizada.

### Da auditoria do Manus (15/08) — aceitos e na fila

- [ ] **Allowlist de campos no espelho** (achado 8)
      POR QUE: `/api/spectator-state` devolve o `app_state` cru e o frontend
      decide o que esconder. Qualquer campo sensível novo no `S` vaza
      automaticamente pro espelho. O worker tem que filtrar; o frontend
      esconde por cima.
      PRONTO QUANDO: o worker devolve só a lista nomeada de campos e o
      espelho continua funcionando igual.
      CUIDADO: allowlist errada quebra o espelho em silêncio — mapear antes
      todos os campos que o `pro.html` lê.

- [ ] **Teste unitário do detectarAlertas** (observação 11)
      POR QUE: heurística por substring em campo livre ('peso' casa com
      texto que não é exercício). Alerta clínico sem teste é o pior lugar
      pra descobrir regressão.
      PRONTO QUANDO: existe `worker/test/alerts.test.mjs` cobrindo cada
      alerta com caso positivo, negativo e falso-positivo conhecido.

- [ ] **Varredura de innerHTML no index.html** (observação 13)
      POR QUE: 255 ocorrências; nome de paciente e sintoma renderizados sem
      escape sistemático. Um nome com `<img onerror>` é vetor XSS.
      PRONTO QUANDO: todo dado digitado pelo usuário passa por escape antes
      de `innerHTML`, com teste que trava as rotas de entrada principais.

- [ ] **JWT opcional nos endpoints de IA** (achado 2)
      POR QUE: `/api/analyze-*` são públicos; CORS não barra script. Com JWT
      opcional, quem está logado ganha rate limit por usuário; quem não está
      cai no limite por IP. Não quebra app antigo.
      DEPENDE: primeiro provar que o rate limit dispara (sonda `rl_probe`
      no `/api/health`, v1.31.1).

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
