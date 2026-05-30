# 🌿 Sintomas em uso de GLP-1 (Tirzepatida, Semaglutida, Liraglutida)

> **Fonte de verdade** pro Sanova adicionar/refinar a biblioteca de sintomas.
> Próximo Claude/sessão: consulta esse arquivo, sugere mudanças na UI de sintomas.
> Iniciado em 30/05/2026 (Bruno cravou frio + coriza).

---

## 📋 Estrutura desta fonte

Cada sintoma tem:
- **Status no app:** ✅ já cobre · 🟡 cobre parcial · ❌ falta adicionar
- **Frequência clínica:** comum / incomum / raro
- **Evidência:** bula (registrado em FDA/ANVISA) / literatura / patient-reported
- **Notas clínicas do Bruno** (quando relevante)

---

## 🟢 Sintomas clássicos (gastrointestinais)

| Sintoma | Status app | Frequência | Evidência |
|---|---|---|---|
| Náusea | ✅ | Muito comum (30%+) | Bula |
| Vômito | ✅ | Comum | Bula |
| Diarreia | ✅ | Comum | Bula |
| Constipação | ✅ | Comum | Bula |
| Dor abdominal | ✅ | Comum | Bula |
| Refluxo / azia | ✅ | Comum | Bula |
| Eructação (arroto) | 🟡 verificar | Comum | Literatura |
| Dispepsia / indigestão | 🟡 verificar | Comum | Bula |
| Distensão abdominal | 🟡 verificar | Comum | Literatura |
| Flatulência | 🟡 verificar | Comum | Literatura |

---

## 🟡 Sintomas atípicos confirmados em literatura recente

> **Bruno cravou (30/05/2026):** "Sintomas de frio e coriza em uso de Tirzepatida — incluir no app."

| Sintoma | Status app | Frequência | Evidência |
|---|---|---|---|
| 🆕 **Coriza / congestão nasal** | ❌ FALTA | Incomum mas relatado | [Klarity Health (rinite vasomotora + GLP-1)](https://www.helloklarity.com/post/vasomotor-rhinitis-and-glp-1-medications-whats-happening-in-your-nose/) |
| 🆕 **Calafrios / sensação de frio** | ❌ FALTA | Incomum | [arXiv: self-reported side effects](https://arxiv.org/pdf/2603.12341) |
| 🆕 **Ondas de calor (hot flashes)** | ❌ FALTA | Incomum | Mesma fonte |
| Fadiga / mal-estar (flu-like) | 🟡 verificar | Comum | [Fella Health](https://www.fellahealth.com/guide/does-tirzepatide-cause-flu-like-symptoms) — relacionado à desidratação por sintomas GI |
| Dor de cabeça | 🟡 verificar | Comum | Bula |
| Tontura / vertigem | 🟡 verificar | Incomum | Bula |
| Reação no local de injeção | ✅ | Comum | Bula |

---

## 🔴 Sintomas raros mas graves (manter alerta)

| Sintoma | Status app | Frequência | Evidência | Ação clínica |
|---|---|---|---|---|
| Pancreatite (dor epigástrica irradiando) | ✅ | Raro | Bula | Emergência |
| Hipoglicemia (em diabéticos + GLP-1 + sulfonilureia/insulina) | ✅ | Raro fora dessas combinações | Bula | Emergência |
| Reação alérgica grave | ✅ | Muito raro | Bula | Emergência |
| Doença vesicular (colelitíase, colecistite) | 🟡 verificar | Incomum em emagrecimento rápido | Literatura | Avaliar dor em hipocôndrio direito |
| Sangue nas fezes | ✅ | Raro | Literatura | Emergência |
| Vômitos incoercíveis (>24h) | ✅ | Raro | Bula | Emergência (desidratação grave) |
| Pensamentos suicidas / depressivos | 🟡 verificar | Raro mas em vigilância FDA | [Caso clínico](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12227335/) | Avaliação psiquiátrica urgente |

---

## 🧠 Sintomas neuropsiquiátricos / comportamentais

| Sintoma | Status app | Frequência | Evidência |
|---|---|---|---|
| Redução de "food noise" (efeito desejado) | ✅ | Comum (efeito) | Literatura ampla |
| Anedonia / apatia | 🟡 verificar | Relatado em comunidades | Vigilância FDA |
| Embotamento de recompensa (álcool, doces, jogos) | 🟡 verificar | Em estudo | Literatura emergente |
| Mudança de humor | 🟡 verificar | Relatado | Patient-reported |
| Sonolência diurna | 🟡 verificar | Incomum | Patient-reported |
| Insônia | 🟡 verificar | Incomum | Patient-reported |

---

## 💉 Reações locais de injeção

| Sintoma | Status app | Notas |
|---|---|---|
| Vermelhão local | ✅ | Comum — gira local |
| Nódulo subcutâneo | ✅ | Comum — não massagear |
| Coceira local | 🟡 verificar | Comum |
| Hematoma | 🟡 verificar | Incomum |
| Infecção local | 🟡 verificar | Raro — higiene |

---

## 🌐 Outros relatados em comunidades de pacientes

> Sem evidência forte na literatura ainda, mas pacientes relatam consistentemente em comunidades online (Reddit, Facebook groups, fóruns clínicos).

- **Mudança no paladar** (alimentos parecem diferentes)
- **Aversão a cheiros** (especialmente comida)
- **Boca seca**
- **Aftas / úlceras na boca**
- **Queda de cabelo** (geralmente associada à perda de peso rápida, não ao fármaco direto)
- **Pele seca**
- **Soluços frequentes**
- **Sensação de "comida parando no esôfago"** (gastroparesia leve)
- **Olfato exacerbado**

---

## 🎯 Próximos passos pro Sanova

### Prioridade 1 (Bruno cravou):
- [ ] Adicionar **Coriza / congestão nasal** na biblioteca
- [ ] Adicionar **Calafrios / sensação de frio**

### Prioridade 2 (sugestão minha — alta evidência):
- [ ] Adicionar **Ondas de calor**
- [ ] Adicionar **Fadiga (flu-like)** — diferenciar de náusea geral
- [ ] Adicionar **Eructação / gases**
- [ ] Adicionar **Distensão abdominal**

### Prioridade 3 (vigilância clínica):
- [ ] Adicionar **Mudanças de humor / anedonia** com nota "se grave, procurar médico"
- [ ] Adicionar **Sintomas psiquiátricos** com flag de emergência
- [ ] Adicionar **Dor em hipocôndrio direito** (alerta vesícula)

### Prioridade 4 (comunidades — pra investigar):
- [ ] Pesquisar literatura recente sobre **mudança de paladar/olfato**
- [ ] Pesquisar evidência sobre **queda de cabelo** (causa direta vs perda rápida)

---

## 📚 Fontes consultadas (30/05/2026)

- [Klarity Health — Vasomotor Rhinitis And GLP-1 Medications](https://www.helloklarity.com/post/vasomotor-rhinitis-and-glp-1-medications-whats-happening-in-your-nose/)
- [Fella Health — Does Tirzepatide Cause Flu-Like Symptoms?](https://www.fellahealth.com/guide/does-tirzepatide-cause-flu-like-symptoms)
- [arXiv — Self-Reported Side Effects of Semaglutide and Tirzepatide in Online Communities](https://arxiv.org/pdf/2603.12341)
- [GoodRx — 18 Possible Side Effects of Tirzepatide](https://www.goodrx.com/mounjaro/common-side-effects)
- [Drugs.com — Tirzepatide Side Effects](https://www.drugs.com/sfx/tirzepatide-side-effects.html)
- [Healthline — Zepbound Side Effects](https://www.healthline.com/health/drugs/zepbound-side-effects)
- [NCBI — Tirzepatide-Induced Gastrointestinal Manifestations Meta-Analysis](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10614464/)
- [NCBI — Life-Threatening Ventricular Fibrillation Linked to High-Dose Tirzepatide](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12227335/)
- [Cleveland Clinic — Tirzepatide](https://my.clevelandclinic.org/health/drugs/23789-tirzepatide-injection)

---

## 🌿 Notas pro próximo Claude

1. **Use esse arquivo como fonte de verdade** quando atualizar a biblioteca de sintomas do app.
2. **Bruno é médico** — quando ele cravar um sintoma novo, adiciona aqui antes de ir pro código.
3. **Distingue evidência:** "bula" > "literatura" > "patient-reported".
4. **Sempre cita fonte** com link quando adicionar sintoma novo.
5. **Sintomas graves precisam de flag de emergência** na UI (cor vermelha + texto "procure médico imediatamente").
6. A biblioteca atual do Sanova fica em `sec-sintomas` no `index.html` (~linha 5209+).
