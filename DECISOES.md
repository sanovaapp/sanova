# 🌿 Decisões permanentes do Sanova

Isto **não é histórico**. É a lei do projeto — o conjunto de regras que
qualquer agente (ou pessoa) precisa conhecer antes de escrever uma linha,
gerar uma peça ou falar com um paciente.

Foram tomadas ao longo de meses na issue #148. Estão aqui porque decisão
enterrada em comentário nº 74 de uma thread de 100+ não é decisão — é
arqueologia.

**Regra deste arquivo:** só entra o que é permanente. Estado do dia vive em
`ESTADO.md`. Se uma linha daqui envelhecer, ela é *corrigida*, não apagada,
e o motivo entra junto.

---

## 1. Fronteira clínica e regulatória

**O Sanova sinaliza limiar. Não prescreve, não diagnostica, não substitui
consulta.** Essa é a linha que separa o produto de um dispositivo médico
regulado (SaMD/ANVISA) e de exercício ilegal da medicina.

Todo alerta e todo relatório carregam o **termo invertido**:

> O Sanova pode sinalizar, mas **NÃO** substitui o monitoramento clínico.
> **Ausência de alerta NÃO significa ausência de risco.**

A inversão é deliberada: a frase perigosa não é "temos alertas", é o
paciente concluir que silêncio é segurança.

**Alertas 🔴 (emergência — hipoglicemia, dor abdominal severa):** modal
síncrono no próprio fluxo de registro, no segundo em que o paciente
descreve o sintoma. E-mail pro profissional serve como vigilância e
documentação, **com moldura explícita de que não é canal de emergência**.

**Push nativo nunca é camada de segurança.** Entrega não é garantida
(desativável, atrasável); prometê-lo criaria expectativa de monitoramento
24/7 que a Sanova não pode assumir.

## 2. O que o Sanova nunca escreve

- **Nome comercial de medicamento** em peça gerada pelo app (RDC 96/2008).
  Molécula só com opt-in, padrão **desligado**.
- **Nome de paciente** em card compartilhável.
- Qualquer frase que amarre **molécula → resultado** como alegação de
  eficácia. O app narra o esforço da pessoa, não a performance do fármaco.

## 3. Dado de paciente

**Nunca sai do aparelho quando não precisa sair.** Os cards de resultado são
desenhados em canvas local justamente por isso — gerar via serviço de
terceiro (Canva e afins) mandaria dado de saúde pra API externa e quebraria
o offline-first. Ferramenta de design fica com o que **não** é dado de
paciente: ficha da loja, material social, screenshots.

**LGPD art. 18 é código, não promessa.** Apagar a conta apaga no banco; se o
backend falhar, o app **aborta** a limpeza local em vez de fingir que
apagou. Portabilidade é botão, não pedido por e-mail.

**RLS ligado e forçado** em toda tabela com dado de paciente. Isolamento
é responsabilidade do banco, não da boa vontade do código.

## 4. O repositório é público

Nunca entram em commit, comentário, código, log ou print: token, chave,
senha, código de verificação, número de telefone, e-mail pessoal, ID de
transação, D-U-N-S, ou dado de paciente.

Quando precisar referenciar, escreva **o fato** ("confirmado na tela",
"localizado nos recibos"), nunca **o valor**.

Credencial nasce na tela onde é gerada e vai direto pro cofre de secrets.
Print de credencial é vazamento — a foto sobrevive em backup de galeria,
nuvem e conversa encaminhada.

## 5. Divisão de trabalho entre agente e humano

**O agente navega e preenche. O humano autoriza.**

Sempre do Bruno, sem exceção:

- Senha, 2FA, código de SMS ou e-mail
- Aceite de termo, taxa, compra, ato irreversível
- Declaração de fato comercial (motivo de transferência, relação societária)
- Qualquer coisa que toque dinheiro, identidade legal, ou dado de paciente

**Regra de Ouro:** automação primeiro, sempre. O Bruno paga por horas
economizadas, não por cliques organizados.

**Teste do Monitor:** antes de pedir qualquer coisa a ele, responda *"isso
pode virar um monitor automático?"*. Se pode, vira item em
`automation/backlog.yml` e não se pede. Se não pode, explique o porquê no
mesmo lugar em que pediu. Conferir status de painel externo **nunca** é
tarefa humana.

**Corolário (07/08/2026):** nunca desenhe tarefa cujo caminho crítico
dependa de um agente de janela (Chrome, chat). Só cron roda sozinho. Se
depende de alguém abrir alguma coisa, o passo é humano — escreva pra o
humano.

## 6. Regras de código

- **Nunca apagar `index_vitorioso_sanova.html`.** Regra sagrada, sem
  discussão.
- **Nada de lógica em bash dentro de YAML.** O heartbeat falhou 12 vezes
  seguidas por erro de parse causado por markdown dentro de `run: |`. Lógica
  vive em `.github/scripts/*.mjs`; prompt longo vive em `.md`.
- **Subir `SANOVA_VERSION`** a cada mudança em `index.html` — o worker
  monitora a versão no ar contra o que o repo espera.
- **Trabalho vai em branch + PR.** Nunca push direto na `main`.

## 7. Como falar com o Bruno

Português direto, sem jargão desnecessário. Ele é médico e fundador, não
programador — explique o *porquê*, não só o comando.

**Nunca sugerir que ele descanse, durma ou pare.**

Reportar o que falhou com a mesma clareza do que funcionou. Estimativa
errada corrigida vale mais que estimativa bonita mantida.
