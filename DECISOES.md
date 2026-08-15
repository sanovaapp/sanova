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

## 6b. Os cinco bugs do pipeline da Play — 15/08/2026

Sete rodadas até o primeiro AAB entrar no Play Console. Estão aqui porque
quatro dos cinco são **falhas silenciosas**: o pipeline ficava verde, ou
falhava com o erro longe da causa. Todos travados por teste em
`worker/test/publish-play.test.mjs`.

1. **`bubblewrap update` faltando.** A etapa se chamava "init + build" e não
   rodava nenhum dos dois — escrevia o manifesto e chamava `build` sem projeto
   Android nenhum pra construir.

2. **`tee` engolindo o código de saída.** Em `cmd | tee log`, o `set -e` olha
   o código do *tee*. O Bubblewrap falhava, o tee dava certo, e a etapa ficava
   **verde em 12 segundos sem produzir AAB**. `set -eo pipefail` conserta.
   Esse é o bug que escondeu os outros.

3. **Alias da chave cravado como `android`.** A keystore de junho veio do
   PWABuilder e usa `my-key-alias`. A leitura da SHA-256 devolvia vazio em
   silêncio.

4. **`minSdkVersion 19`.** A `androidbrowserhelper:2.6.2` — que é o que faz o
   TWA existir — exige 21. Não compila abaixo disso.

5. **O AAB escolhido era o errado.** O Bubblewrap gera dois: o cru do Gradle
   em `app/build/outputs/bundle/release/` e o assinado em
   `app-release-bundle.aab`. A escolha era `find | head -1`, e travessia de
   diretório **não tem ordem garantida** — o mesmo workflow podia passar num
   dia e falhar no outro sem nada mudar.

**A lição que vale além da Play:** erro que chega ilegível — página de HTML,
código sem mensagem, "falhou" — é bug de instrumentação, não mistério. O 403
do Google parecia falta de permissão e ia virar pedido de print pro Bruno.
Uma etapa de 40 linhas que chamava a API na mão devolveu HTTP 200: a permissão
só estava propagando. **Construir o diagnóstico custou uma rodada; chutar
custaria três e uma tarefa dele por chute.**

## 6c. A tela vence a documentação — 15/08/2026

Quatro documentos deste repositório afirmavam que **conta de organização é
isenta** dos 12 testadores por 14 dias. A afirmação vinha da documentação
pública do Google, que fala em *"contas pessoais criadas depois de
13/11/2023"*.

O painel do Play Console, lido na tela com a conta org já ativa, mostra os
dois requisitos **abertos** e o botão *Solicitar a produção* **desabilitado**.

Não interessa qual das duas fontes "deveria" estar certa. **A que decide é a
que tem o botão.** Custou uma expectativa de prazo errada carregada por
semanas e repetida em quatro arquivos.

Regra que sai daí, e ela generaliza: **afirmação sobre comportamento de
plataforma externa só entra em documento depois de vista na tela.** Quando só
houver a documentação, escreva que é a documentação que diz — não que é assim.

**E o mesmo erro voltou no mesmo dia, por outra porta.** Horas depois,
auditei a declaração de Segurança dos dados lendo o `data-safety-form.md`,
não achei a categoria *Informações e desempenho do app*, e anunciei que ela
**não estava declarada no painel**. Estava. O arquivo é que não a tinha.

Documento do repositório também não é tela. Ele descreve o painel na data em
que alguém olhou, e envelhece igual. **"Conferir a declaração" significa abrir
o Play Console — nunca reler o arquivo que fala sobre ele.**

A ida não foi perdida: havia uma divergência real, só que outra. Os dois tipos
constavam como coleta **obrigatória**, e o app permite desligar. Mas ter
achado por acaso não desfaz ter afirmado por dedução.

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
