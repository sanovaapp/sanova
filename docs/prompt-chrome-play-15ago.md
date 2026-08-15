# 🌿 Prompt do Chrome — conferir a faixa e consertar Segurança dos dados

**Data:** 15/08/2026. **Estado no momento em que foi escrito:** v3.10.63 (109)
na faixa de teste fechado com status `completed`; 0 testadores; declaração de
Segurança dos dados desatualizada (falta *Registros de falhas*).

**O que este prompt faz:**

1. **Confere** na tela o que eu só sei pela API — se a 109 aparece disponível,
   se as capturas de tablet bloqueiam algo, o que o relatório de pré-lançamento
   apontou.
2. **Conserta** a declaração de Segurança dos dados, que ficou para trás do
   app quando a v3.10.63 passou a enviar registros de falha (PR #262).

**O que ele NÃO faz:** nada de produção. Não solicita acesso, não cria versão
de produção, não publica. Essa porta é do Bruno.

> ⚠️ **Uma frase de aviso, porque isso é ação e não leitura:** salvar o
> formulário de Segurança dos dados coloca a mudança em análise do Google.
> É o que queremos — a declaração hoje está errada. **Não** publica o app em
> produção, porque o acesso de produção nem foi concedido ainda.

---

## Respostas de referência (fonte: `data-safety-form.md`, seção 4b)

| campo | resposta | por quê |
|---|---|---|
| Registros de falhas | **Coleta: Sim** | `posthog.captureException` desde a v3.10.63 |
| Diagnósticos | **Coleta: Sim** | session replay carrega sinais de tempo/desempenho |
| Compartilhado | **Não** | PostHog é operador, não terceiro |
| Efêmero | **Não** | fica retido no PostHog |
| Obrigatório? | **Opcional** | respeita o opt-out em Mais → Privacidade |
| Finalidade | **Análise** | serve pra diagnosticar defeito, não pro app funcionar |

---

## O prompt

```
Você está no Google Chrome, logado no Google Play Console da Sanova, app
"Sanova — Acompanhamento GLP-1" (br.app.sanova).

Você vai fazer duas coisas: conferir o estado (PARTE 1) e corrigir uma
declaração (PARTE 2). Faça as duas, nesta ordem.

REGRAS INVIOLÁVEIS
1. PRODUÇÃO É PROIBIDA. Não clique em "Solicitar a produção", não crie
   versão na faixa Produção, não promova nada para produção. Se um caminho
   levar para lá, saia. Teste fechado e formulários são permitidos.
2. NÃO reproduza na resposta nenhum e-mail, telefone, CNPJ, endereço, chave,
   token ou dado bancário que apareça na tela. Se precisar mencionar,
   escreva "[presente]" ou informe apenas a quantidade.
3. Se qualquer tela pedir senha, verificação em duas etapas ou código de SMS,
   PARE e diga que parou. Não tente contornar.
4. Se um menu tiver nome diferente do escrito aqui, use o nome que você viu e
   diga qual foi. Não invente caminho.
5. Na PARTE 2 você vai SALVAR um formulário. Isso é autorizado. Qualquer
   outro botão que salve, envie ou publique algo fora da PARTE 2 está
   proibido.

═══════════════ PARTE 1 — CONFERIR ═══════════════

1.1 "Testar e lançar" → "Testes" → "Teste fechado".
    ANOTE o status da faixa.
    Confirme: a versão "v3.10.63 (109)" está lá? Ela aparece como disponível
    para testadores, ou como rascunho?

1.2 Mesma tela, aba "Testadores".
    ANOTE se existe lista de e-mails criada e quantos e-mails tem (só o
    número, nunca os e-mails).
    ANOTE se existe "link de participação" / "opt-in URL" visível — e copie
    a URL, que não é dado pessoal.

1.3 Ficha da loja. O caminho da última vez foi "Aumentar número de usuários"
    → "Presença na loja" → "Páginas de detalhes do app" → "Página de
    detalhes padrão".
    CUIDADO: o link "Configurar" da tabela abre um experimento A/B, não a
    ficha. Se cair nele, saia sem salvar.
    ANOTE: as capturas de tela de tablet de 7 pol. e de 10 pol. estão
    marcadas como obrigatórias? Existe mensagem dizendo que a falta delas
    bloqueia algo? Copie a mensagem literal, se houver.

1.4 Painel do app → seção "Produção" → "Solicitar o acesso de produção".
    APENAS LEIA. ANOTE cada requisito e o estado dele, e se o botão está
    habilitado ou cinza.

1.5 "Monitorar e aprimorar" (ou "Testar e aprimorar") → "Relatório de
    pré-lançamento" → "Visão geral". É o Google rodando o app em aparelhos
    reais depois de cada envio para faixa de teste.
    ANOTE: há relatório? Quantas falhas, e quais problemas de desempenho,
    acessibilidade ou estabilidade ele lista? Copie os títulos.
    Se disser que está processando, escreva "ainda processando".

═══════════════ PARTE 2 — CORRIGIR SEGURANÇA DOS DADOS ═══════════════

CONTEXTO: este formulário foi respondido em julho. Em agosto o app passou a
enviar registros de falha (exceções de JavaScript) para o PostHog. A
categoria "Informações e desempenho do app" nunca foi declarada. Declaração
incompleta é causa comum de recusa, e isso precisa ser corrigido ANTES do
teste com 12 testadores começar.

2.1 Vá em "Monitorar e aprimorar" → "Políticas e programas" → "Conteúdo do
    app" → "Segurança dos dados". Entre para editar.

2.2 Avance até a etapa de seleção de TIPOS DE DADOS.
    Localize a categoria "Informações e desempenho do app"
    (em inglês: "App info and performance").
    MARQUE:
      - "Registros de falhas"  (Crash logs)
      - "Diagnósticos"         (Diagnostics)
    NÃO marque "Outros dados de desempenho do app".
    NÃO desmarque nada que já esteja marcado em outras categorias.

2.3 Avance. Para CADA um dos dois tipos marcados, responda exatamente:
      - Estes dados são coletados?            SIM
      - Estes dados são compartilhados?       NÃO
      - Processados efemeramente?             NÃO
        (ou seja: escolha a opção que diz que os dados são coletados e
         enviados para fora do dispositivo, não processada só em memória)
      - A coleta é obrigatória ou opcional?   OPCIONAL
        (o usuário pode desativar em Mais → Privacidade)
      - Finalidade / propósito:               ANÁLISE (Analytics)
        Marque SOMENTE Análise. Não marque publicidade, marketing,
        personalização nem comunicações do desenvolvedor.

2.4 Avance até o fim e SALVE. Se aparecer uma tela de revisão antes de
    salvar, confira que os dois tipos novos estão listados e que nenhuma
    resposta antiga mudou, e então salve.

2.5 ANOTE o que a tela disse depois de salvar — se avisou que a mudança vai
    para revisão, copie a frase literal.

2.6 NÃO faça mais nada. Não vá para Produção. Não envie mais nada.

═══════════════ RESPOSTA ═══════════════

Devolva exatamente neste formato, sem texto extra antes ou depois:

TESTE FECHADO — STATUS DA FAIXA: <texto literal>
VERSÃO NA FAIXA: <nome e número; disponível ou rascunho>
LISTA DE TESTADORES: <existe? quantos e-mails? NUNCA escreva os e-mails>
LINK DE PARTICIPAÇÃO: <a URL, ou "não encontrei">
CAPTURAS DE TABLET: <obrigatórias? mensagem literal, se houver>
REQUISITOS DE PRODUÇÃO:
- <requisito>: <estado>
BOTÃO SOLICITAR PRODUÇÃO: <habilitado ou cinza>
RELATÓRIO DE PRÉ-LANÇAMENTO: <falhas e problemas, ou "ainda processando", ou "não vi">
SEGURANÇA DOS DADOS — ANTES: <a categoria "Informações e desempenho do app" já tinha algo marcado?>
SEGURANÇA DOS DADOS — MARQUEI: <o que você marcou>
SEGURANÇA DOS DADOS — RESPOSTAS: <coletado/compartilhado/efêmero/obrigatoriedade/finalidade, para cada tipo>
SEGURANÇA DOS DADOS — SALVOU? <sim/não, e a frase literal que a tela mostrou>
NOMES DE MENU DIFERENTES DO ROTEIRO: <lista, ou "nenhum">
TELAS QUE NÃO ABRIRAM: <lista, ou "nenhuma">
ALGO QUE ME SURPREENDEU: <qualquer coisa fora do esperado, ou "nada">

Devolva TODOS os campos numa única resposta, do primeiro ao último. Resposta
parcial não serve — é ela inteira que decide o próximo passo. Se não viu
algo, escreva "não vi". Não deduza nenhum campo.
```

---

## O que fazer com a resposta

Colar no canal. Nenhum campo dela é segredo — o único dado pessoal possível
(e-mails de testadores) está proibido de aparecer.

**Se `SEGURANÇA DOS DADOS — SALVOU? sim`** → o bloqueio nº 2 morreu, e sobra
só juntar os 12 e-mails.

**Se o relatório de pré-lançamento listar falhas** → é trabalho meu, e começa
na mesma hora.
