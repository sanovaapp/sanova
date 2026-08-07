# 🌿 Protocolo da Sala Sanova — como os agentes trabalham sem o Bruno no meio

A Sala é a issue **#148**. Ela é a única fonte de verdade e o único canal
entre os membros. Este arquivo define **como um agente sabe que uma tarefa
é dele** e **como ele responde**, pra que o Bruno deixe de traduzir
mensagem de um pro outro.

---

## 1. Endereçamento — a regra que faz o loop funcionar

Todo turno que **pede uma ação** de alguém carrega um bloco assim,
literal, no corpo:

```
[OS PARA: Chrome]
<o que precisa ser feito, em linguagem de execução>
[FIM OS]
```

Destinatários válidos: `Chrome`, `Code`, `Fable`, `Grok`, `Bruno`.

Regras:

- Um turno pode ter **mais de um** bloco `[OS PARA: X]`.
- Turno **sem** bloco `[OS PARA:]` é informação/registro — ninguém precisa agir.
- Quem executa uma OS **responde na Sala** com o resultado e cita o turno de origem.
- Uma OS já respondida está **encerrada**. Não reexecutar (o histórico da
  Sala está cheio de OS antigas — são arquivo, não fila).

## 2. Como cada membro entra na Sala

| Membro | Lê | Escreve | Gatilho |
|---|---|---|---|
| **Code** (Claude Code) | API do GitHub | API do GitHub | Despertador de hora em hora (vive na sessão) + quando o Bruno chama |
| **Chrome** (Claude in Chrome) | Navegador logado | Navegador logado | **Humano abre a janela** — não é daemon |
| **Fable** (Claude chat) | WebFetch | Bruno cola | Bruno abre o chat |
| **Grok** | Bruno cola | Bruno cola (token próprio pendente) | Bruno abre o chat |

**O gargalo é sempre o gatilho, nunca a permissão.**

## 3. O prompt padrão do Chrome

O Bruno não precisa mais escrever prompt. Ele abre o Claude in Chrome e cola
**sempre o mesmo texto** — o de `docs/prompt-padrao-chrome.md`. O Chrome
lê a Sala, encontra o que está endereçado a ele, executa e reporta.

Isso troca "Bruno intermedia a conversa" por "Bruno aperta o start".

## 4. O que o Chrome faz sem perguntar / o que ele para e pergunta

**Executa direto:**
- Navegar, ler telas, conferir status, tirar diagnóstico
- Preencher formulários com dados que já estão na Sala ou na tela
- Publicar o próprio relatório na Sala

**Para e pergunta ao Bruno (regra T64/T72, inviolável):**
- Senha, 2FA, código de SMS/e-mail — o agente nunca digita
- Aceite de termo, taxa, compra, ou qualquer ato irreversível
- Declaração de fato comercial (motivo de transferência, relação societária)
- Qualquer coisa que toque dinheiro, dado de paciente, ou identidade legal

## 5. Higiene do repositório público

A Sala é pública. **Nunca** entram num comentário: token, chave, senha,
código de verificação, número de telefone, e-mail pessoal, ID de transação,
D-U-N-S, ou dado de paciente. Quando precisar referenciar, escreva
"localizado nos recibos" / "confirmado na tela" — o fato, não o valor.

## 6. Numeração

Turno novo = **maior número visto na Sala + 1**, lendo com paginação
completa (`per_page=100`, todas as páginas). Colisão de número já
aconteceu (Code, agosto/2026) por ler fonte desatualizada — o
`bridge/canal.md` hoje é só ponteiro pra cá justamente por isso.
