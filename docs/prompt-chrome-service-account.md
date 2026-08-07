# 🌿 Prompt do Chrome — criar a service account da Play Store

**Por que essa é a tarefa mais valiosa da fila:** sem
`PLAY_SERVICE_ACCOUNT_JSON`, *tudo* que envolve a Play Store vira clique
manual do Bruno — upload de AAB, status de transferência, faixas de teste,
ficha da loja. Com ela, o `publish-play.yml` roda sozinho e o worker passa a
vigiar a transferência em vez de o Bruno abrir o painel pra conferir.

É a raiz do problema que o Bruno levantou no T84.

Cole o bloco abaixo no Claude in Chrome, com o navegador logado na conta
**contato@sanovaapp.com** (a dona da organização MEDFAST na Play Console).

---

```
Você é o Chrome, agente de UI da equipe Sanova. Tarefa única desta sessão: criar uma service account do Google Cloud com acesso à Google Play Developer API e entregar o arquivo JSON da chave, para que o Bruno o salve como secret no GitHub.

CONTEXTO
- Organização na Play Console: MEDFAST (developer ID 8754701096507326927)
- Pacote do app: br.app.sanova
- O objetivo final é que a GitHub Action publique AAB e leia status de transferência sem ninguém abrir o painel.

EXECUTE, PARANDO NOS CHECKPOINTS MARCADOS:

1. Abra https://console.cloud.google.com e confirme em qual conta está logado. Se NÃO for a conta dona da Play Console (contato@sanovaapp.com), pare e me avise — trocar de conta é decisão minha.

2. Crie (ou selecione, se já existir) um projeto chamado "sanova-play". Me diga qual dos dois aconteceu.

3. Em "APIs e serviços" → "Biblioteca", ative a "Google Play Android Developer API" para esse projeto. Confirme na tela que ficou ativada.

4. Em "IAM e administrador" → "Contas de serviço", crie uma conta de serviço:
   - Nome: sanova-github-publisher
   - Descrição: publica AAB e le status via GitHub Actions
   NÃO conceda nenhum papel do Google Cloud nesta etapa — a permissão que importa é a da Play Console, no passo 6.

5. Na conta de serviço criada, aba "Chaves" → "Adicionar chave" → "Criar nova chave" → tipo JSON. O navegador vai baixar um arquivo .json.
   [CHECKPOINT HUMANO] Esse arquivo é uma credencial. Me avise que baixou e PARE aqui neste passo — não abra o conteúdo na tela, não copie o texto para lugar nenhum, não me mostre o conteúdo. Eu cuido dele.

6. Abra https://play.google.com/console → Configurações → Acesso à API. Localize a conta de serviço sanova-github-publisher na lista e conceda acesso com estes dois papéis, e só estes:
   - Release manager (gerenciar versões e faixas)
   - Store presence (editar a ficha da loja)
   Se a tela pedir para vincular o projeto do Google Cloud primeiro, faça o vínculo com o projeto "sanova-play".
   [CHECKPOINT HUMANO] Se aparecer qualquer aceite de termo, taxa ou declaração de fato comercial, PARE e me pergunte. Eu autorizo, você não.

7. Me reporte o que ficou pronto e o que travou. Depois publique o mesmo relatório como comentário novo na issue #148 do repositório sanovaapp/sanova, com o cabeçalho:

   ## 🌿 TURNO {N+1} — Chrome (agente de UI) · Service account da Play criada

   onde N é o maior número de turno que existe na Sala (leia TODAS as páginas de comentários antes de decidir o número).

REGRAS INVIOLÁVEIS:
- O repositório é PÚBLICO. Nunca escreva num comentário: conteúdo do JSON, chave privada, token, senha, código de verificação, telefone, e-mail pessoal ou dado de paciente. Escreva o fato ("chave criada", "papéis concedidos"), nunca o valor.
- Nunca digite senha, 2FA ou código de SMS. Pare e me peça.
- Se a tela não corresponder ao que está escrito aqui, reporte exatamente o que apareceu em vez de improvisar caminho.
- Antes de publicar o comentário na Sala, me mostre o texto.
```

---

## O que o Bruno faz depois (2 min, e só ele pode)

O JSON é credencial: nasce no navegador dele e vai direto pro cofre, sem
passar por chat, print ou arquivo do repo.

1. Abrir o `.json` baixado num editor de texto e **selecionar tudo / copiar**
2. https://github.com/sanovaapp/sanova/settings/secrets/actions →
   **New repository secret**
3. Name: `PLAY_SERVICE_ACCOUNT_JSON` · Secret: colar o JSON inteiro →
   **Add secret**
4. **Apagar o arquivo `.json` da pasta de Downloads** — depois de estar no
   cofre, cada cópia solta é só risco

Não precisa avisar ninguém: o monitor `secret-play-service-account` da fila
detecta sozinho e anuncia na Sala no ciclo seguinte.

## Por que os checkpoints são onde são

Regra T64/T72: o agente navega e preenche; o humano autoriza. Os dois pontos
marcados são exatamente os que tocam **credencial** (passo 5) e **aceite de
termo / fato comercial** (passo 6). Todo o resto — ativar API, criar projeto,
nomear conta — é navegação, e o agente faz sem perguntar.
