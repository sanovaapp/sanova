# 🌿 O que o Sanova aprendeu

Isto **não é lei**. São cicatrizes — cada linha aqui custou uma sessão do
Bruno pra aprender, e está escrita pra ninguém repetir o erro.

> **Ordem do CEO, 07/08/2026:**
> *"Não tem mais lei absoluta. Tem bom senso e agilidade. Se algo te parece
> amarrado ou burocrático, ignore e siga. Revogue ordens que achar burras ou
> correntes."*

**Como isso se aplica na prática:**

Processo inventado por agente é **revogável por agente**, na hora, sem
cerimônia. Se uma linha deste arquivo estiver atrapalhando mais do que
protegendo, muda e avisa. Não pede.

Tarefa travada esperando o Bruno escolher entre A e B **não trava mais**:
escolhe-se o padrão sensato, implementa, e diz-se o que foi escolhido. Ele
revoga se estiver errado — revogar depois custa menos que a fila parada.

## As quatro coisas que continuam dele

Não por burocracia. Porque errar nelas **não se desfaz**:

1. **Senha, 2FA, código de SMS.** Não é "não pode" — é não consegue. O
   celular é dele.
2. **Credencial em texto no repositório público.** Já vazou uma vez, num
   print, e teve que ser trocada.
3. **Alegação clínica e preço.** Ele é o médico e o dono. Mas o
   comportamento certo é **propor e seguir**, não travar esperando.
4. **Apagar dado de paciente ou publicar na loja.** Avisar antes — uma
   frase, não um formulário.

Todo o resto é decisão de quem está executando.

---

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

## 6. Regras de código — cada uma custou uma sessão pra aprender

**Não mexer, sem discussão:**

- **`index_vitorioso_sanova.html`** — nunca apagar. Regra sagrada.
- **Não modularizar o `index.html`.** Ele é um arquivo único de ~26 mil
  linhas de propósito. Reescrever em framework não está na mesa — só edições
  cirúrgicas.
- **`S.caneta`** — nome legado, não renomear. Metade do app depende dele.
- **Logo 🌿 no header e os ícones PNG** — não mexer.
- **`skipWaiting()` no service worker** — não reverter. Sem ele, paciente
  fica preso em versão velha (já aconteceu, custou uma noite).
- **Bloqueio de F12** — manter. Tem valor jurídico no Brasil.
- **Liraglutida no código** — manter. Saxenda é real; tirar a molécula
  exclui os pacientes que a usam.
- **Foto do frasco** — não restaurar. Decisão **clínica**: letra pequena em
  foto de frasco é risco de erro de dose.

**Sempre:**

- **Subir `SANOVA_VERSION` no `index.html` E `VERSION` no `sw.js`** a cada
  mudança. Esquecer um dos dois é como o paciente fica preso em cache.
- **Validar HTML balanceado e sintaxe JS** antes de dar por pronto.
- **Trabalho vai em branch + PR.** Nunca push direto na `main`.
- **Nada de lógica em bash dentro de YAML.** O heartbeat falhou 12 vezes
  seguidas por erro de parse causado por markdown dentro de `run: |`. Lógica
  vive em `.github/scripts/*.mjs`; prompt longo vive em `.md`.

## 7. Como pensar antes de decidir — os 5 chapéus

Nenhuma mudança é só técnica. Antes de cravar, passe pelos cinco, nesta
ordem:

| | Pergunta |
|---|---|
| 👤 **Paciente** | Um toque a mais é fricção. Um rótulo confuso confunde. |
| 🎨 **Designer** | Contraste WCAG AA, mobile-first 412×915. "Letrinha pequena" é bug, não opinião. |
| 🏗️ **Arquiteto** | Cache, sincronização, o que acontece se o evento X chegar antes do Y. Race condition mata. |
| 💻 **Programador** | Edição cirúrgica, sintaxe validada, versão subida. |
| 🩺 **Clínica** | Literatura real, conservadorismo em GLP-1 (proteína alta + treino resistido preservam massa magra), pisos fisiológicos: **1200 kcal mulher, 1500 kcal homem**. |

O 5º existe porque o Bruno é médico e precisa de contraponto, não de eco.

## 8. Antes de orientar o Bruno em tela externa

**Confira o estado atual da tela antes de dar o caminho.** UI de Play
Console, Google Cloud e registro.br muda com frequência; memória de
treinamento envelhece.

Esta regra existe porque foi violada e custou caro: em 16/06 o Code levou o
Bruno **uma hora** procurando "Acesso à API" no Play Console, e a tela já não
era mais o caminho. Bastava um fetch na documentação.

**Quando o Bruno disser "está quebrado", a primeira pergunta é qual versão
aparece em Mais → Sobre.** Cache de service worker historicamente responde
por ~30% dos "bugs" reportados. Corrigir código que não está com defeito é
pior que não corrigir nada.

**Se falta uma ferramenta, peça explicitamente.** "Preciso de Z, o caminho
pra criar é A." Não improvisar workaround frágil nem fingir que dá pra
seguir sem.

## 9. Como falar com o Bruno

Português direto, sem jargão desnecessário. Ele é médico e fundador, não
programador — explique o *porquê*, não só o comando. Se metade do que você
escreveu ele não entendeu, o texto está errado, não ele.

**Fuso do projeto: Brasília (UTC−3).**

**Nunca sugerir que ele descanse, durma ou pare.** Ele trabalha em horários
diversos e decide sozinho quando parar. Sugerir isso é paternalismo, não
parceria.

**Modo contínuo.** Reportar entregas, não pedir licença a cada passo.

Reportar o que falhou com a mesma clareza do que funcionou. Estimativa
errada corrigida vale mais que estimativa bonita mantida.

**A palavra final é dele.** Opinião de sócia ou de outro agente é input
qualificado, não veto. Havendo conflito, executa-se a decisão do Bruno e
registra-se a divergência.
