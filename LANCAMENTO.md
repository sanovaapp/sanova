# 🌿 Checklist de lançamento

O caminho do ponto onde estamos até o Sanova na mão de pacientes reais.

Escrito em português simples de propósito — o dono deste checklist é o Bruno,
que é médico, não programador. Se alguma linha aqui só faz sentido pra
engenheiro, ela está mal escrita e deve ser reescrita.

*Atualizado em 07/08/2026.*

---

## Onde estamos

O app está **pronto e no ar** em `sanova.app.br`. Funciona hoje, no navegador
de qualquer celular. O que falta é estar **na Play Store**.

Ele já foi enviado uma vez, em 18/07, e foi **recusado** — não por qualidade,
mas por tipo de conta: a política do Google exige conta de organização para
app de saúde. Por isso a mudança pra conta **MEDFAST**.

## 🎁 A boa notícia que muda o prazo

A conta pessoal do Google tem uma exigência pesada: **12 testadores usando o
app por 14 dias seguidos** antes de poder publicar de verdade.

**Conta de organização é isenta disso.** A regra do Google diz, literalmente,
que ela vale para *"desenvolvedores com contas pessoais criadas depois de 13
de novembro de 2023"*.

Ou seja: a mudança pra MEDFAST não só resolve a recusa — **ela apaga duas
semanas do cronograma**. Quando a revisão aprovar, publica direto.

---

## Etapa 1 — Destravar a esteira

*Isto pode acontecer hoje, sem esperar o Google.*

### 1.1 — A chave da Play Store 🔴 **maior alavanca da fila inteira**

Sem ela, tudo que envolve a loja é clique manual seu. Com ela, o robô sobe
versão sozinho.

- [ ] **Bruno** — 4 minutos, 3 telas. Caminho em
      [`docs/prompt-chrome-service-account.md`](docs/prompt-chrome-service-account.md)

> ⚠️ **Não procure "Acesso à API"** no menu do Play Console. Essa tela deixou
> de ser o caminho. Vá em **Usuários e permissões** e convide o e-mail da
> conta de serviço como convidaria uma pessoa. Foi isso que custou uma hora
> em 16/06.

### 1.2 — Achar o arquivo de assinatura de junho 🔴 **e este é urgente**

Todo app na Play tem uma "assinatura" — um arquivo que prova que a versão
nova veio de quem fez a versão velha. **Se a assinatura não bater, o Google
recusa o envio.**

A assinatura do Sanova nasceu em junho, dentro do pacote que o PWABuilder
gerou (`Sanova_-_Google_Play_package.zip`). Dentro dele há um arquivo
`signing.keystore` e outro com as duas senhas.

- [ ] **Bruno** — localizar esse ZIP (celular, Downloads, e-mail, nuvem)

**Se o ZIP existir**, três coisas vão pro cofre e a esteira fica completa:
`TWA_UPLOAD_KEYSTORE_B64`, `TWA_UPLOAD_STORE_PWD`, `TWA_UPLOAD_KEY_PWD`.

**Se o ZIP tiver sumido**, não é o fim — o Google permite pedir a troca da
chave de envio. Mas leva alguns dias e é um pedido manual. Por isso é
urgente saber **agora**, não no dia da publicação.

### 1.3 — Testar a esteira antes de precisar dela

- [ ] **Robô** — assim que os secrets existirem, rodar o pipeline em modo
      rascunho e confirmar que o Google aceita a autenticação

---

## Etapa 2 — Publicar

*Depende do Google concluir a transferência. Nada aqui é controlável por nós.*

### 2.1 — Conferir o que chegou na conta MEDFAST

A ficha da loja, as declarações e a versão enviada **migram junto**. Não
migram: a lista de testadores e as permissões de conta de serviço.

- [ ] `br.app.sanova` aparece na conta org — *o monitor avisa sozinho*
- [ ] Ficha intacta: título, descrições, imagens
- [ ] Declarações de saúde e privacidade migradas

### 2.2 — Reenviar pra revisão

- [ ] **Bruno** — Painel de publicação → *Enviar alterações para revisão*

Nada precisa ser refeito. As mudanças enviadas em 18/07 continuam válidas; o
que mudou foi o tipo de conta, que era justamente o motivo da recusa.

**Prazo esperado:** 1 a 7 dias. App de saúde costuma demorar mais.

### 2.3 — Aprovou

- [ ] **Bruno** — publicar em produção *(direto, sem os 14 dias — conta org)*

---

## Etapa 3 — Piloto

- [ ] **Bruno** — convidar os primeiros pacientes reais
- [ ] **Bruno** — grupo de WhatsApp (kit pronto)
- [ ] **Robô** — acompanhar erros e travamentos relatados pela loja
- [ ] **Robô** — 2 ou 3 versões pequenas nas primeiras semanas

---

## Etapa 4 — Enquanto isso, em paralelo

*Nada aqui depende do Google. É a fila do robô, em
[`TRABALHO.md`](TRABALHO.md).*

### Segurança — as duas livres, e é por elas que ele começa

- [ ] Limite de chamadas na API *(hoje qualquer um pode martelar sem freio)*
- [ ] Parar de vazar detalhe interno nas mensagens de erro

### Travadas numa decisão sua

- [ ] Apagar dados velhos automaticamente — *falta você definir o prazo*
- [ ] Ligar os alertas ao profissional — *tudo, ou só os vermelhos?*
- [ ] Dois bugs de tela — *falta print, sem ele eu chutaria*

As decisões estão em [#248](https://github.com/sanovaapp/sanova/issues/248),
respondíveis com uma letra.

---

## O caminho mais curto até a loja

Se der pra fazer só uma coisa hoje, é a **1.2** — achar o ZIP de junho.

Não porque seja a mais importante, mas porque é a única cujo **atraso custa
dias**. Se a assinatura tiver sumido, o pedido de troca ao Google leva tempo,
e é melhor descobrir isso enquanto a transferência ainda está na fila deles
do que no dia em que tudo o mais estiver pronto.

---

## Referências

| O quê | Onde |
|---|---|
| Ficha da loja | `store-assets/ficha-loja.md` |
| Formulário de segurança de dados, pré-respondido | `docs/data-safety-form.md` |
| Guia da conta de serviço | `docs/prompt-chrome-service-account.md` |
| Roteiro detalhado do dia da publicação | `docs/checklist-d-zero.md` |
| Política de privacidade | https://sanova.app.br/privacidade.html |
| Página de exclusão de conta | https://sanova.app.br/exclusao.html |
