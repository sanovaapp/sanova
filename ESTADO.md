# 🌿 Estado do Sanova

Onde o projeto está **hoje**. Arquivo volátil por natureza — sobrescrito, não
acumulado. Para as regras que não mudam, veja `DECISOES.md`.

*Atualizado em 10/08/2026.*

---

## No ar

| | Versão |
|---|---|
| App (`index.html`) | `3.10.62` |
| Worker Cloudflare | `1.30.0` |
| Domínio | `sanova.app.br` (HTTPS, Pages) |

## Fechado recentemente

- **Vírgula decimal nas telas de peso** — o app é brasileiro e imprimia
  "20.5 kg". Helper único `nBR()`, 22 pontos de kg migrados, teste que
  quebra se alguém escrever tela nova de kg com `toFixed` cru. Água, kcal e
  IMC ficam pras próximas levas.
- **Bug do peso "20 vs 21 kg"** — havia duas fontes de verdade pro peso
  inicial (declarado na anamnese vs. primeira pesagem). O painel usava uma,
  o card de compartilhar usava a outra. Achado lendo o código, sem print.
- **Retenção automática de dados** — 180 dias pra `alert_events`, 24 meses
  pra conta inativa. A política de privacidade deixou de ser só papel.
- **Rate limit, `console.error` sanitizado e `/api/debug-gemini` fora do ar**
  — a rota de debug era chamada paga a cada visita e devolvia pedaço da
  chave da Gemini a quem pedisse *(worker v1.30.0)*.
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

- **Print do contraste de "PROTEÇÃO MUSCULAR"** — é o único bug de tela que
  sobrou. O do peso foi achado sem print, lendo o código; este é contraste
  de cor, e cor eu não enxergo pelo código com a mesma confiança.
- **Transferência do app** pra conta org MEDFAST — o Google respondeu em
  10/08: processa **a partir de quarta, 12/08** (2 dias úteis, não acelera).
  Sem ação humana pendente.

> ⚠️ **A transferência reordena a issue #248.** Permissão de usuário no Play
> Console pertence à conta, não ao app — convite feito na conta antiga não
> viaja junto. Passos 1 (gerar chave) e 3 (guardar no cofre) podem ser feitos
> a qualquer momento; o passo 2 (convidar a service account) só depois de
> 12/08, já dentro da MEDFAST.
>
> O aviso do Google sobre relatórios, dados financeiros e o teto de US$ 1 mi
> da taxa de 15% **não atinge o Sanova**: o app não usa Play Billing (cobrança
> é Mercado Pago, por fora) e ainda não está público, então não há pedido,
> faturamento nem histórico a perder.

*`MP_ACCESS_TOKEN_PROD` saiu desta lista: já está no cofre. Foi listado sem
conferir.*

Cada um desses tem monitor na fila. Quando resolverem, o worker anuncia
sozinho — ninguém precisa conferir painel.

### Fila do Code

- Vírgula decimal, levas 2 e 3 (água, kcal, IMC) — 18 pontos
- Ligar a Fase 2 (decisão de produto, ver abaixo)

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
