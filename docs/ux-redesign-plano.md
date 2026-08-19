# 🌿 Redesign UX — plano compilado e aprovação

**19/08/2026 · Compilação: crítica Grok (UX completa, revisão ao vivo) × análise Code × decisões do Bruno.**
Previews com a identidade Sanova entregues ao Bruno em 19/08. Nada entra sem aprovação dele sobre os previews.

## O problema, medido (revisão ao vivo do Grok, conta demo)

| Aba | Altura | Telas de celular |
|---|---|---|
| Medicação | 11.054 px | ~6,5 |
| Painel | 9.156 px | ~5,4 |
| Saúde | 7.266 px | ~4,3 |

O dono do app se perdeu depois de 30 dias fora. Retenção de piloto (meta ≥40%
em 14d) não sobrevive a 6 telas de rolagem pra achar a dose.

## Princípios travados (Grok + Code convergiram independentes)

1. **Uma intenção por tela** — status ≠ calcular ≠ registrar
2. **Cada fato mora num lugar só** — próxima dose 1× (era 3×), potência 1× (era 2×)
3. **Progressive disclosure** — matemática, bula e estoque atrás de toque
4. **Identidade intocada** — wordmark, cores, fontes, e a barra Painel·Medicação·Check-in·Saúde·Mais. Os previews do Grok são direção, não planta (traziam logo e navegação inventados — rejeitados)
5. **Expertise mais visível, não menos** — cálculo de frasco vira tela própria; proteção muscular vira KPI de primeira dobra do Painel; limiar "quando procurar médico" sobe no sintoma
6. **Nenhum texto clínico muda** — disposição sim, conteúdo não

## Ondas de execução (cada uma = 1 PR pequena, testável no celular do Bruno)

| # | Onda | Toque | Risco |
|---|---|---|---|
| 0 | 🔴 **17 vs 15 UI** — decisão do Bruno pendente | 1 linha | clínico — dele |
| 1 | Cálculo: tira seletor de data + UI herói + acordeões | médio | baixo |
| 2 | Medicação home: status limpo + botão Registrar | grande | médio |
| 3 | Sheet de registro (local + data + checklist 3 itens) | médio | médio |
| 4 | Painel: 3 blocos na dobra, resto colapsa | grande | médio |
| 5 | Check-in: 3 opções no caminho feliz, eixos opcionais | médio | baixo |
| 6 | Saúde: limiar antes do texto longo | pequeno | baixo |
| 7 | Mais: 4 grupos | pequeno | baixo |

Banner de assinatura: some quando restam 300+ dias; reaparece dispensável por
sessão perto do fim (decisão-humana confirmável na aprovação dos previews).

## Cálculo de risco (pedido do Bruno)

| risco | prob. | dano | mitigação |
|---|---|---|---|
| Edição no monólito quebra o app inteiro | média | alto | fumaça automatizada ANTES de cada commit (app abre + 5 abas navegam, método já provado); versão-em-par é portão |
| Esconder informação clínica demais | baixa | alto | conteúdo não some, colapsa; checklist e avisos intactos; sintoma grave mantém modal síncrono |
| Regressão no fluxo de registrar dose (dado clínico) | baixa | alto | funções de gravação intocadas — muda disposição, não lógica; testes de padrão por onda |
| Espelho do profissional herda layout quebrado | média | médio | teste de fumaça também em modo spectator a cada onda |
| Paciente preso em cache com telas misturadas | baixa | médio | versão em par (portão) + skipWaiting já ativo |
| Testadores do teste fechado veem app mudar | certa | baixo | é DESEJADO: mudar agora, com 1 testador (Bruno), antes dos 14 — janela ideal; Google recomenda atualizar durante teste |
| Prazo: redesign atrasa o piloto | média | alto | ondas independentes; a qualquer momento pode-se parar e o que entrou já vale; nada de reescrita |

**Risco de NÃO fazer:** retenção do piloto morre em telas de 11k px — o
bloqueio estratégico apontado pelas três auditorias. Maior que qualquer risco acima.

## Decisão-humana (aguardando Bruno)

1. **15 UI**: apagar (rec. Code) vs manter condicional (rec. Grok)
2. Aprovação dos 7 previews (ou ajustes neles)
3. Banner: sumir com 300+ dias restantes — ok?
4. Check-in: álcool/pensamentos viram opcionais — ok clínico?
5. Proteção muscular como KPI da dobra (rec. Code/Grok: sim, é a expertise)

## Critérios de sucesso (do Grok, adotados)

- Voltar após 30 dias e se orientar em ≤10s em qualquer aba
- "Quanto aspiro?" = número grande sem rolagem
- Check-in ≤3 toques; registrar dose ≤4
- Nenhuma regressão de aviso de segurança
