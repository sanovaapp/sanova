# 🌿 Service account da Play Store — o caminho curto

**Por que essa é a tarefa de maior alavanca da fila:** sem
`PLAY_SERVICE_ACCOUNT_JSON`, *tudo* que envolve a Play Store vira clique
manual — upload de AAB, status de transferência, faixas de teste, ficha da
loja. Com ela, o `publish-play.yml` roda sozinho e o worker passa a vigiar a
transferência em vez de alguém abrir o painel pra conferir.

---

## ⚠️ Leia isto antes de repetir trabalho

No **T20 (16-17/06)** essa tarefa já foi 90% feita e travou no último passo.
O que provavelmente **já existe** na conta Google do Bruno:

- Projeto Google Cloud **`sanova-play-deploy`**
- Service account **`play-deploy@sanova-play-deploy.iam.gserviceaccount.com`**
- API **`androidpublisher.googleapis.com`** já ativada
- O JSON da chave, baixado no celular naquele dia

**Não recrie nada disso sem antes conferir.** O que travou foi outra coisa.

## 🔑 O que travou em junho — e por que não trava mais

O Code levou o Bruno uma hora procurando **"Acesso à API"** no menu do Play
Console. A tela não aparecia. A conclusão da época foi "conta pessoal não
libera".

**Estava errado.** A documentação atual do Google diz:

> *"You no longer need to link your developer account to a Google Cloud
> Project in order to access the Google Play Developer API."*

O caminho hoje **não passa** por "Acesso à API". Passa por **Usuários e
permissões** — que estava no menu do Bruno o tempo todo, listado no próprio
T20.

Uma service account é tratada como **um usuário convidado**: você convida o
e-mail dela (`...iam.gserviceaccount.com`) como convidaria uma pessoa.

---

## Caminho direto (≈ 4 minutos, sem agente nenhum)

Isso não precisa de Chrome, nem de prompt, nem de sessão aberta. São 3
telas.

### 1. Pegar a chave JSON

https://console.cloud.google.com/iam-admin/serviceaccounts?project=sanova-play-deploy

- Se `play-deploy@...` estiver na lista: clica nela → aba **Chaves** →
  **Adicionar chave** → **Criar nova chave** → **JSON** → baixa
- Se o projeto não existir mais: cria projeto `sanova-play-deploy`, ativa a
  *Google Play Android Developer API* na Biblioteca, e cria a service
  account `play-deploy` — depois volta pra este passo

> Chaves antigas continuam válidas até serem apagadas. Se ainda tiver o JSON
> de junho, pula direto pro passo 3.

### 2. Convidar a service account no Play Console

https://play.google.com/console → conta **MEDFAST** (developer ID
`8754701096507326927`) → **Usuários e permissões** → **Convidar novo
usuário**

- **E-mail:** `play-deploy@sanova-play-deploy.iam.gserviceaccount.com`
- **Permissões do app** `br.app.sanova`, marcar só estas duas:
  - **Gerenciar versões e faixas de teste** (*Release manager*)
  - **Editar a ficha da loja** (*Store presence*)
- **Convidar usuário**

> Tem que ser na conta **MEDFAST**, não na pessoal. Se o app ainda estiver
> em trânsito entre as duas, convide na MEDFAST mesmo — é onde ele vai morar.

### 3. Guardar no cofre

https://github.com/sanovaapp/sanova/settings/secrets/actions →
**New repository secret**

- **Name:** `PLAY_SERVICE_ACCOUNT_JSON`
- **Secret:** o conteúdo **inteiro** do arquivo `.json` (abre num editor de
  texto, seleciona tudo, copia)
- **Add secret**

### 4. Apagar o `.json` da pasta de Downloads

Depois de estar no cofre, cada cópia solta é só risco. Nunca mande o
conteúdo por chat, print ou e-mail — nem pra mim.

### 5. Não avisar ninguém

O monitor `secret-play-service-account` detecta sozinho e anuncia na Sala no
ciclo seguinte. Essa é a regra do Teste do Monitor funcionando.

---

## Se preferir delegar ao Chrome

O caminho acima é curto porque os passos que sobraram são justamente os que
**um agente não pode fazer**: baixar credencial e conceder permissão. O
Chrome economizaria pouco e é onde a automação vem falhando.

Se ainda assim quiser, cole isto no Claude in Chrome, logado na conta dona
da Play Console:

```
Você é o Chrome, agente de UI da equipe Sanova. Tarefa única desta sessão: preparar o acesso da service account play-deploy@sanova-play-deploy.iam.gserviceaccount.com à Play Store, PARANDO nos checkpoints marcados.

ANTES DE CRIAR QUALQUER COISA: abra https://console.cloud.google.com/iam-admin/serviceaccounts?project=sanova-play-deploy e me diga se o projeto e a service account já existem. Eles provavelmente existem — foram criados em junho. Não recrie o que já está lá.

PASSO A: se a service account existir, abra a aba "Chaves" dela e crie uma nova chave do tipo JSON.
[CHECKPOINT HUMANO] O navegador vai baixar um arquivo. Me avise que baixou e PARE. Não abra o conteúdo na tela, não copie o texto, não me mostre. Eu cuido dele.

PASSO B: abra https://play.google.com/console na conta MEDFAST (developer ID 8754701096507326927) → "Usuários e permissões" → "Convidar novo usuário". E-mail: play-deploy@sanova-play-deploy.iam.gserviceaccount.com. Nas permissões do app br.app.sanova marque SOMENTE "Gerenciar versões e faixas de teste" e "Editar a ficha da loja".
[CHECKPOINT HUMANO] Se aparecer aceite de termo, taxa, ou declaração de fato comercial, PARE e me pergunte. Eu autorizo, você não.

OBSERVAÇÃO: não procure "Acesso à API" no menu. Essa tela não é mais o caminho — o Google removeu a exigência de vincular projeto do Cloud. Se você não achar "Acesso à API", está certo. Vá por "Usuários e permissões".

REPORTE: me diga o que ficou pronto e o que travou, com o texto exato que apareceu na tela. Depois publique o mesmo relatório na issue #148 do repositório sanovaapp/sanova, com o cabeçalho "## 🌿 TURNO {N+1} — Chrome · Service account da Play", onde N é o maior número de turno na Sala (leia TODAS as páginas antes de decidir).

REGRAS INVIOLÁVEIS:
- O repositório é PÚBLICO. Nunca escreva num comentário: conteúdo do JSON, chave privada, token, senha, código de verificação, telefone, e-mail pessoal ou dado de paciente. Escreva o fato ("chave criada", "convite enviado"), nunca o valor.
- Nunca digite senha, 2FA ou código de SMS. Pare e me peça.
- Se a tela não corresponder ao que está escrito aqui, reporte exatamente o que apareceu em vez de improvisar caminho.
- Antes de publicar na Sala, me mostre o texto.
```

---

## Por que os checkpoints são onde são

Regra T64/T72: o agente navega e preenche; o humano autoriza. Os dois pontos
marcados são exatamente os que tocam **credencial** e **aceite de termo /
fato comercial**. Todo o resto é navegação.
