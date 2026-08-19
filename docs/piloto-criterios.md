# 🌿 Piloto Sanova — critérios de sucesso

**Escrito em 19/08/2026 por Code, a pedido do Bruno (item S7 da crítica Grok).**

Isto é um **rascunho de decisão**, não uma decisão. Os números abaixo são
propostas para o Bruno ajustar — ele é quem define o que "funcionou" significa
clinicamente. O que este documento faz é impedir que o piloto termine sem
resposta: sem critério escrito antes, todo resultado vira "meio que deu certo".

---

## Por que definir isso ANTES do piloto

O bloqueio da loja são os 12 testadores. O bloqueio **estratégico** é a falta
de evidência de valor: hoje não se sabe se o paciente registra por mais de uma
semana, se o médico abre o espelho, se o alerta muda alguma conduta.

Comercializar sem essa evidência é apostar no escuro. O piloto existe pra
transformar "acho que ajuda" em "ajuda, e aqui está o número".

---

## O que medir (proposta — Bruno ajusta os números)

### Retenção do paciente — *o app é usado, ou instalado e esquecido?*
- [ ] **≥ 40% dos pacientes** com ao menos **3 check-ins em 14 dias**
- [ ] **≥ 25%** ainda registrando na **semana 3**

*Por que importa:* um tracker que o paciente abandona em 5 dias não tem valor
clínico nem comercial. Esta é a métrica que separa "app de saúde" de "app
baixado".

### Uso do espelho pelo médico — *o diferencial funciona na prática?*
- [ ] **≥ 50% dos médicos** vinculados abriram o espelho **ao menos 1×** na
      primeira semana do vínculo
- [ ] ao menos **1 médico** relata que o espelho mudou/informou uma conduta

*Por que importa:* o espelho é o moat (Grok). Se o médico não abre, o Sanova é
"mais um tracker" e a estratégia B2B via prescritor não se sustenta.

### Sinalização de limiar — *o alerta é sinal ou ruído?*
- [ ] dos alertas 🔴 gerados, **≥ 70%** foram considerados **pertinentes** pelo
      médico (não falso-positivo)
- [ ] **zero** alerta que o médico classifique como potencialmente perigoso
      (ex.: tranquilizou quando devia preocupar) — este é o único critério
      **eliminatório**: um só já manda revisar o limiar antes de escalar

*Por que importa:* fronteira clínica. Alerta que erra pro lado errado é pior
que não ter alerta.

### Saúde técnica — *o robô cuida disso*
- [ ] **zero** perda de dado de paciente relatada
- [ ] **zero** cobrança indevida (trivial hoje: pagamento está em sandbox)
- [ ] erros capturados pelo PostHog revisados semanalmente

---

## O que NÃO fazer durante o piloto

Regra do Grok (S7), aceita:

- **Não mexer em limiar clínico, texto de alerta ou piso fisiológico** — o
  piloto mede o que existe; mudar a régua no meio invalida a medida.
- **Não inventar feature de engajamento** (streak, gamificação, push de "você
  não registrou") — foge da filosofia de fricção baixa e da fronteira clínica.
- **Não ligar a cobrança real** — piloto é para provar valor, não para faturar.
  Dinheiro entra depois, com evidência na mão (ver `LANCAMENTO.md`, Etapa 3.5).

Correção de bug, ajuste de UX que não toca clínica, e versão pequena de
estabilidade **são permitidos** — aliás, o Google recomenda atualizar durante
o teste.

---

## Como o robô ajuda a medir (proposta — depende do Bruno autorizar eventos)

A instrumentação mínima (item S6 do Grok) precisa de decisão do Bruno sobre
quais eventos PostHog ligar. Se autorizados, o robô consegue montar sozinho:

- `checkin_completed`, `alert_shown`, `pro_mirror_opened`, `share_card_generated`
- painel simples: % de pacientes com ≥3 check-ins em 14 dias; nº de médicos
  que abriram o espelho na semana

Sem esses eventos, a medição vira manual (o Bruno pergunta aos médicos). Com
eles, o número aparece sozinho — mas o Bruno decide se liga, e se o médico é
informado de que isso é medido.

---

## As 4 perguntas que destravam tudo isso (do Grok, ainda esperando o Bruno)

1. No piloto, o que é **sucesso mínimo** para você considerar que o Sanova
   "funciona" clinicamente?
2. Alerta 🔴 — o médico recebe **e-mail**, ou só vê no painel?
3. Autoriza os **4-5 eventos de produto** no PostHog? O médico é informado?
4. Quando a regra "**nunca modularizar** o index.html" deve ser revista?
