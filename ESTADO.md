# 🌿 Estado do Sanova

Onde o projeto está **hoje**. Arquivo volátil por natureza — sobrescrito, não
acumulado. Para as regras que não mudam, veja `DECISOES.md`.

*Atualizado em 07/08/2026.*

---

## No ar

| | Versão |
|---|---|
| App (`index.html`) | `3.10.59` |
| Worker Cloudflare | `1.29.2` |
| Domínio | `sanova.app.br` (HTTPS, Pages) |

## Fechado recentemente

- **RLS do `app_state` trancado no banco** — cada paciente só alcança a
  própria linha, por policy. Era o buraco mais sério da auditoria.
- **Schema da Fase 2 aplicado** — `alert_events` e
  `professional_alert_prefs`, com a policy que deixa o paciente ler os
  alertas sobre ele mesmo (transparência LGPD).
- **LGPD art. 18** — apagar conta apaga no banco; portabilidade é botão.
- **Espelho do profissional** — trava server-side, leitura apenas.
- **Cards de share** em todas as superfícies de resultado, canvas local.
- **Autonomia nível 2** — `claude-turno.yml` (cron 6/6h) e
  `claude-mencao.yml` (`@claude` em qualquer issue ou PR).
- **Worker autônomo** — `automation/backlog.yml` executado de 3/3h.

## Bloqueado, e em quem

### `PLAY_SERVICE_ACCOUNT_JSON` — a maior alavanca da fila

Sem ela, **tudo** que envolve a Play Store é clique manual: upload de AAB,
status de transferência, faixas, ficha. Com ela, `publish-play.yml` roda
sozinho.

Caminho em `docs/prompt-chrome-service-account.md`. **4 minutos, 3 telas.**
Metade já existe desde junho (projeto `sanova-play-deploy`, service account
`play-deploy@`, API ativada).

> ⚠️ Não procure **"Acesso à API"** no Play Console. Essa tela deixou de ser
> o caminho — o Google removeu a exigência de vincular projeto do Cloud. Vá
> por **Usuários e permissões** e convide o e-mail da service account como
> convidaria uma pessoa. Foi o que custou uma hora em 16/06.

### Outras pendências do Bruno

- **`MP_ACCESS_TOKEN_PROD`** — rotação pendente desde a auditoria
- **Prints dos 2 bugs do Painel** ainda não reproduzidos (badge de peso
  20 vs 21 kg; contraste de "PROTEÇÃO MUSCULAR")
- **Transferência do app** pra conta org MEDFAST — aceita nos dois lados,
  em fila do Google, sem ação humana pendente

Cada um desses tem monitor na fila. Quando resolverem, o worker anuncia
sozinho — ninguém precisa conferir painel.

### Fila do Code

- Retenção automática de dados (cron)
- Rate limit no worker
- Sanitizar `console.error` (não vazar detalhe de backend pro cliente)

## Fase 2 (alertas) — pronta, desligada

Schema aplicado e endpoints escritos, mas a interface está atrás da flag
`FASE2_ALERTAS_ATIVA = false` em `pro.html`. Ligar é decisão de produto, não
de engenharia.

## Como o trabalho anda sozinho

| Automação | Ritmo | O que faz |
|---|---|---|
| `worker.yml` | 3/3h | executa `automation/backlog.yml` e reporta só o que mudou |
| `claude-turno.yml` | 6/6h | lê o estado, julga o que fazer, e faz |
| `claude-mencao.yml` | sob demanda | `@claude <pedido>` em qualquer issue ou PR |
| `heartbeat.yml` | 1×/dia | pulso: versões, PRs, workflows falhados |

Para mandar serviço sem abrir sessão: comentar `@claude <o que precisa>` em
qualquer issue ou PR do repositório.
