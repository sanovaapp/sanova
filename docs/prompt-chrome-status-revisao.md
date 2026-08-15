# 🌿 Levantamento do que falta pra produção — prompt do Claude in Chrome

**O que este prompt faz:** abre o Play Console e devolve, numa lista só, tudo
que ainda impede o `br.app.sanova` de ir pra produção. Somente leitura — ele
não publica, não envia, não altera nada.

**O que ele NÃO é:** vigilância. Se a pergunta for *"o Google já respondeu?"*
repetida ao longo dos dias, isso é trabalho de robô e está na fila como tal
(`TRABALHO.md` → *Vigilância do estado da revisão*). Agente de janela só
existe enquanto alguém mantém a aba aberta — não serve pra vigiar.

**Quando usar:** uma vez, agora, com o Bruno no computador. Depois disso a
pergunta some, porque o robô passa a avisar sozinho.

---

## Por que esta consulta vale um agente de janela

A API do Google responde bem sobre **versões** — foi assim que o
`publish-play.yml` descobriu que o `versionCode` seguinte era 108.

O que ela **não** entrega bem é a lista de tarefas de ficha: Segurança dos
dados, Classificação de conteúdo, Público-alvo, declaração de app de saúde,
Política de privacidade. Esses avisos vivem no painel, em telas diferentes, e
é justamente onde a submissão de 18/07 foi recusada.

Ler oito telas e juntar numa lista é navegação longa e pontual. É exatamente
o caso de uso legítimo do Chrome.

---

## Como usar

1. Abra o Chrome já **logado na conta Google que tem o Play Console da Sanova**
2. Abra o Claude in Chrome
3. Cole o bloco abaixo **inteiro**, sem editar
4. Acompanhe — se ele parar pedindo confirmação, é o comportamento esperado

---

## O prompt (copiar do `<<<` até o `>>>`)

```
<<<
Você está no Google Chrome, numa sessão já logada no Google Play Console da
Sanova. Sua tarefa é um levantamento SOMENTE LEITURA.

OBJETIVO
Descobrir tudo que ainda impede o app "Sanova — Acompanhamento GLP-1"
(pacote br.app.sanova) de ser publicado em produção.

REGRAS INVIOLÁVEIS
1. NÃO clique em nada que publique, envie, aprove, salve ou altere. Se um
   botão disser "Publicar", "Enviar para revisão", "Iniciar lançamento",
   "Salvar", "Confirmar" ou equivalente em inglês — NÃO clique. Só navegar e
   ler.
2. NÃO reproduza na sua resposta nenhum código, chave, token, senha, número
   de telefone, e-mail pessoal, endereço, CNPJ, dado bancário ou dado de
   paciente que apareça na tela. Se precisar mencionar que existe, escreva
   apenas "[presente]".
3. Se qualquer tela pedir senha, verificação em duas etapas ou código de SMS,
   PARE imediatamente e diga que parou. Não tente adivinhar nem contornar.
4. Se um menu tiver nome diferente do que está escrito aqui, use o nome que
   você viu e diga qual foi. Não invente o caminho.

ROTEIRO — abra nesta ordem e anote o que encontrar

1. Vá em https://play.google.com/console
   Se aparecer escolha de conta, entre na que contém o app Sanova.
   ANOTE o nome exato da conta de desenvolvedor.

2. Abra o app "Sanova — Acompanhamento GLP-1".

3. Menu esquerdo → "Painel de publicação" (ou "Publishing overview").
   ANOTE a frase do topo LITERALMENTE, palavra por palavra.
   Se houver uma lista de "Alterações em análise", ANOTE cada item.

4. Menu esquerdo → "Política e programas" → "Status da política".
   ANOTE se existe algum aviso, restrição, rejeição ou app sinalizado, e o
   texto exato de cada um. Se não houver nada, escreva "sem avisos".

5. Menu esquerdo → "Teste e lançamento" → "Produção".
   ANOTE se existe alguma versão ali, qual o número dela, e qual o status
   (rascunho / em análise / publicada / rejeitada / nenhuma).

6. Menu esquerdo → "Teste e lançamento" → "Testes" → "Teste interno".
   ANOTE se aparece a versão de nome "v3.10.63 (108)" e qual o status dela.
   ANOTE quantos testadores existem na lista.

7. Menu esquerdo → "Crescer" → "Presença na loja" → "Ficha principal da loja".
   ANOTE se algum campo está marcado como incompleto ou com erro.

8. Procure a área de tarefas pendentes do app. Ela costuma se chamar
   "Configurar seu app", "Visão geral do lançamento do app" ou "Set up your
   app", e fica no painel do app.
   ANOTE CADA item que ainda esteja incompleto, com o nome exato dele.
   Os que mais aparecem: Segurança dos dados, Classificação de conteúdo,
   Público-alvo e conteúdo, Apps de saúde, Anúncios, Acesso ao app,
   Política de privacidade, Conformidade governamental.

FORMATO DA RESPOSTA — devolva exatamente assim, sem texto extra antes ou
depois:

CONTA: <nome da conta de desenvolvedor>
PAINEL DE PUBLICAÇÃO: <frase literal do topo>
ALTERAÇÕES EM ANÁLISE: <lista, ou "nenhuma">
STATUS DA POLÍTICA: <texto, ou "sem avisos">
PRODUÇÃO: <versão e status, ou "nenhuma versão">
TESTE INTERNO: <a 108 está lá? status? quantos testadores?>
FICHA DA LOJA: <completa, ou o que falta>
PENDÊNCIAS ABERTAS:
- <item>
- <item>
BLOQUEIA PRODUÇÃO AGORA? <sim ou não, e o motivo em uma frase>
TELAS QUE NÃO ABRIRAM: <lista, ou "nenhuma">

Se você não conseguiu abrir alguma tela, diga qual e por quê. Não preencha
campo nenhum por dedução — se não viu, escreva "não vi".
>>>
```

---

## O que fazer com a resposta

Cole aqui, no canal. A resposta é lista de estado, não contém segredo, e é
com base nela que sai o próximo passo.

**Se vier `BLOQUEIA PRODUÇÃO AGORA? não`** — o passo seguinte é seu, e é o
único que não posso fazer: apertar publicar. O caminho está no
`LANCAMENTO.md`, Etapa 2.

**Se vier com pendências** — a maioria delas é formulário, e formulário eu
sei preencher com você em uma passada. A exceção é o que envolve alegação
clínica, que é sua por natureza.
