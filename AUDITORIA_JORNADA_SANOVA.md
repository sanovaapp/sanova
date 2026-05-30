# 🌿 Auditoria — Jornada Sanova (features prometidas vs. entregues)

> **Data:** 29/05/2026  
> **Auditor:** Claude Code (subagente Explore + revisão)  
> **Escopo:** Camada 2 (Análise) e Camada 3 (Preservação) — 8 features prometidas

---

## 📋 Resumo executivo

A Jornada Sanova tem **8 features prometidas** nas camadas 2 e 3. A auditoria do código revela:

- **3 entregues com qualidade** ✅
- **3 parcialmente implementadas** 🟡 (estrutura presente, conteúdo limitado)
- **2 completamente ausentes** ❌

**O maior risco para credibilidade:** perímetros corporais e fotos de progresso foram prometidos publicamente mas **não existem no código**. Se cobrar pacientes pela Camada 3 hoje, é **bug de confiança massivo** e potencial **bait-and-switch** legal.

---

## 📊 Quadro resumido

| # | Feature | Camada | Status | Código | Impacto |
|---|---|---|---|---|---|
| 1 | Padrões cruzados automaticamente | 2 | ✅ ENTREGA | `index.html:18677-18735` | Funciona bem |
| 2 | Leitura por fase do ciclo da medicação | 2 | 🟡 PARCIAL | `index.html:18570-18584` | Falta narrativa por semana |
| 3 | Sugestões educativas | 2 | ✅ ENTREGA | `index.html:18912-18928` | Genérico mas cumpre |
| 4 | Relatório semanal personalizado | 2 | ✅ ENTREGA | `renderRelatorio()` | Excelente |
| 5 | Perímetros + % gordura | 3 | ❌ **ZERO** | Não existe | **CRÍTICO** |
| 6 | Fotos de progresso | 3 | ❌ **ZERO** | Não existe | **CRÍTICO** |
| 7 | Protocolo proteína refinado por treino | 3 | 🟡 PARCIAL | `index.html:8843-8895` | Cálculo sim, educação não |
| 8 | Ciclo menstrual integrado | 3 | ✅ ENTREGA | `index.html:5785-5907` | Bem implementado |

**Camada 2:** 3 ENTREGA + 1 PARCIAL = **75% entregue**  
**Camada 3:** 1 ENTREGA + 1 PARCIAL + 2 ZERO = **25% entregue**

---

## 🔍 Camada 2 — Análise educativa

### Feature 1: Padrões cruzados automaticamente — ✅ ENTREGA

Array `padroes` (`index.html:18677-18735`) coleta observações cruzando:
- Saciedade média (% de dias saciado vs. fome)
- Sintomas registrados (detecção dos 2 mais frequentes)
- Peso (oscilação semanal)
- Aplicação no dia certo

Renderização em cards visuais coloridos. Cruza peso × saciedade × sintomas × aplicações automaticamente.

**Avaliação:** Embrionário mas funcional. Lógica existe, sem cálculos faltando.

### Feature 2: Leitura por fase do ciclo da medicação — 🟡 PARCIAL

- ✅ Calcula "semana N do tratamento" (`index.html:18570-18584`)
- ❌ **NÃO TEM** renderização de "sintomas esperados nessa fase"

**Exemplo do que falta:** "Você está na semana 3 de Tirzepatida — náusea e vômito são comuns nessa fase" não existe.

O código sabe **quando** o paciente está; **não diz o que esperar**.

**Esforço pra fechar:** ~3-5h
1. Criar função `renderEducacaoFaseMedicacao(semanaAtual, farmaco, dose)`
2. Mapear fases por medicamento (Tirzepa: semanas 1-2, 3-4, 5+)
3. Integrar no relatório semanal como "Esperado nesta fase"

### Feature 3: Sugestões educativas — ✅ ENTREGA (com limitações)

Sistema de sugestões dinâmicas (`index.html:18912-18928`). Lógica if/else cruza:
- `protBatidos < diasComCheckin` → sugestão de proteína
- `aguaBatidos < 0.6*diasComCheckin` → sugestão água
- Idem pra exercício e sintomas

**Avaliação:** Cumpre a promessa literalmente, mas é genérico (4 condições fixas). Não há "motor de sugestão" mais sofisticado. Pacientes esperariam mais personalização.

### Feature 4: Relatório semanal com observações personalizadas — ✅ ENTREGA

`renderRelatorio()` (`index.html:18570-18933`) gera narrativas:
- Contexto: "Semana X do tratamento · Tirzepatida 5mg"
- Resumo impacto: "Você perdeu X kg — uma transformação real"
- 7 pilares narrativos com frases humanas + insights clínicos
- Padrões semanais com recomendações
- Gráfico de tendência (peso 6 semanas)
- "Próxima semana" com 3-4 focos personalizados

**Avaliação:** Plenamente entregue. Tom coach gentil ("português do Bruno").

---

## 🔍 Camada 3 — Preservação

### Feature 5: Perímetros + % gordura — ❌ NÃO ENTREGA

- Promessa listada em `index.html:9113`
- **Nenhuma função** de input de perímetros corporais (cintura, quadril, coxa, braço)
- **Nenhuma função** de cálculo de %gordura via perímetros
- `calcProteinaMeta()` (`index.html:8843-8895`) usa **massa magra estimada** via fórmula Boer (IMC → LBM), **não perímetros**

**O que existe:** cálculo de LBM via `calcLBM()` (fórmula genérica). **Zero UI** para entrada de perímetros.

**Impacto:** Paciente em Camada 3 abre Preservação e não encontra nada de perímetros/composição corporal.

**Esforço:** ~12-18h
1. Inputs: cintura (cm), quadril (cm), coxa (cm), braço (cm)
2. Integrar fórmula Jackson-Pollock ou Parillo pra estimar %gordura
3. Validar com histórico (comparar período anterior)
4. UI na seção Preservação com card visual

### Feature 6: Fotos de progresso (rosto, corpo) — ❌ NÃO ENTREGA

- Promessa listada em `index.html:9114`
- Existe `#fotoPratoImg2` (`index.html:5056`) **só pra fotos de refeições** (IA Gemini)
- **Zero código** pra upload/armazenamento de fotos antes/depois
- **Zero UI** de galeria de progresso

**Impacto:** Feature totalmente ausente. Paciente buscando registrar fotos de progresso encontra interface vazia.

**Esforço:** ~20-25h
1. UI: botão "Adicionar foto" (rosto / corpo / full)
2. Canvas/crop antes de salvar (reduzir tamanho pro localStorage)
3. Converter imagem → Base64 → localStorage (limite ~8.5MB)
4. Galeria "antes/depois" comparativo
5. Aviso de privacidade (dados ficam no celular)
6. Considerar sync futuro via QR/nuvem opcional

### Feature 7: Protocolo proteína refinado pelo treino — 🟡 PARCIAL

✅ **Tem:** `calcProteinaMeta()` (`index.html:8843-8895`) ajusta proteína por exercício:
- Base por idade (1.6-2.0 g/kg LBM)
- **+0.1/0.2/0.3 g/kg** por atividade (Leve/Moderada/Alta)
- **+0.2 g/kg** se detecta exercício resistido nos últimos 14 dias (`detectaResistido()` em `index.html:8827-8841`)

❌ **Falta** pra ser "protocolo":
- Recomendações específicas por tipo de treino (ex: "CrossFit 5x/sem → proteína sobe pra 1.8g/kg LBM")
- Educação contextual ("Você fez musculação 4x/sem — proteína tem papel crítico de recuperação")
- Ajuste dinâmico pós-treino ("Hoje fez resistido — aumente proteína X extra")

**Avaliação:** Funciona como cálculo. A promessa "protocolo" sugere algo mais educativo/personalizado. Hoje é só um fator numérico.

**Esforço:** ~6-8h
1. Função `renderEducacaoProteinaByTreino(tipoTreino, frequencia)`
2. Integração com Daily ("Hoje você fez resistido — aumente proteína X extra")
3. Card educativo "Por que sua meta mudou" baseado em padrão de treino

### Feature 8: Ciclo menstrual integrado — ✅ ENTREGA

Estrutura completa em `index.html:5785-5907`:
- `cicloAtivo()`, `cicloInicializar()`, `calcularFaseCiclo()`
- `getFaseEducacao(fase)` renderiza insights clínicos por fase:
  - Menstrual: aviso de proteína dobrada + ferro
  - Folicular: bom pra exercício resistido
  - Ovulatória: fome aumentada é hormonal, não falha de medicação
  - Lútea: retenção até 3kg esperada, NÃO é medicação falhando
  - Pré-menstrual: TPM natural, não desistir
- Calendário do relatório marca 🌸 nos dias da fase (`index.html:18654-18661`)
- Detalhes diários mostram fase do ciclo (`index.html:18956-18960`)

**Avaliação:** Bem feito. Só falta integração com análise de saciedade (ex: "Sua saciedade está mais baixa hoje porque você está na fase ovulatória").

---

## 🚩 Pontos de risco crítico

### Risco 1 — Camada 3 vazia no lançamento

Se você começar a cobrar pela Camada 3 (ou oferecer trial dela) hoje, pacientes vão descobrir que **2 de 4 features não existem**. Bug de confiança massivo.

**Cenário concreto:**
- Paciente com 30 dias ativos + 15 check-ins desbloqueia Camada 3
- Abre "Preservação"
- Não encontra: perímetros, fotos, nenhuma UI nova específica (só ciclo menstrual)
- Reação: *"Paguei por nada? O que é Camada 3 então?"*

**Consequência:** potencial "cobrança por serviço não entregue" no termo de uso.

### Risco 2 — Promessas públicas não cumpridas

A lista de features em `CAMADAS[3].itens` (`index.html:9113-9116`) é **renderizada publicamente** na tela de onboarding e na cerimônia de desbloqueio. Mostrar feature que não existe = **bait-and-switch**.

### Risco 3 — Educação de fase de medicação incompleta

Feature 2 promete "leitura por fase do ciclo da medicação" mas só renderiza "você está na semana 3" sem narrativa do que esperar. Paciente com náusea na semana 2 NÃO recebe "isso é normal nessa fase de Tirzepatida". **Falha de educação clínica.**

---

## 🎯 Recomendação

### Opção A — Cumprir promessas (honesto, mais trabalho)

**Ordem de prioridade:**

| Urgência | Feature | Esforço |
|---|---|---|
| 🔴 Crítica | Feature 5: Perímetros + %gordura | 12-18h |
| 🔴 Crítica | Feature 6: Fotos de progresso | 20-25h |
| 🟡 Importante | Feature 2: Narrativas por semana | 3-5h |
| 🟡 Importante | Feature 7: Protocolo refinado real | 6-8h |
| **TOTAL** | – | **41-56h** |

**Mínimo viável pra Camada 3:** ~32-43h (só Features 5 e 6).

**Timing:** ~2-3 semanas de Claude Code (cirúrgico no single-file de 19k linhas).

### Opção B — Ajustar copy (honesto, menos trabalho)

Reescrever as promessas pra coincidir com o que entrega:

**Camada 3 — Preservação (versão honesta):**

- ✅ "Ciclo menstrual integrado às leituras (se ativado)" — **MANTER**
- ✅ "Entender a relação entre seu treino e proteína" — **TROCAR** "Protocolo refinado pelo seu treino" por isso (mais modesto)
- ❌ **REMOVER:** "Estimativa de gordura × massa magra (perímetros)" — não existe
- ❌ **REMOVER:** "Fotos de progresso (rosto, corpo)" — não existe
- 🔄 **ADICIONAR (já existe):** "Análises semanais com foco em preservação muscular"

Resultado: Camada 3 com 2 features prometidas, ambas entregues. Menos promissor, mas **honesto**.

### Opção C (sugestão minha — meio termo)

Lançar **Camada 3 só com Ciclo** + Roadmap visível:

- ✅ "Ciclo menstrual integrado" — KEEP como ativo
- 🛠️ **"Em construção"** badge nas outras:
  - Perímetros + %gordura — "Chega em ~2 semanas"
  - Fotos de progresso — "Chega no próximo ciclo"
  - Protocolo treino refinado — "Em refinamento"

Comunicação honesta + criação de expectativa positiva (paciente vê evolução real).

---

## ✅ Conclusão

**Camada 2:** 75% entregue. Aceitável com ajuste educativo em Feature 2 (~3-5h).

**Camada 3:** 25% entregue. **Inaceitável pra lançamento pago.** As 2 maiores (perímetros, fotos) são zero-código.

O Sanova é **excelente em narrativa clínica** (relatórios, educação, ciclo). Precisa fechar essas lacunas de Camada 3 antes de posicioná-la como "premium".

**Próximo passo:** Bruno decide entre A (cumprir), B (ajustar copy) ou C (meio termo + roadmap visível).
