# 🌿 Sanova — Assets da Play Store

Pacote gerado pelo Code em 17/06/2026 pra atender a Frente A do Turno 24 da Fable:
> "Bruno achou a apresentação da Play Store crua. Decisão do Bruno: a folha verde
> do Sanova é a base do ícone. Gera e entrega no repo (pasta `store-assets/`)."

## Arquivos

| Arquivo | Dimensão | Uso |
|---|---|---|
| `icon-512.png` | 512×512 | Ícone do app na ficha da Play Store |
| `icon-192.png` | 192×192 | Compatibilidade (opcional pro Play Store; mantém pra PWA caso queira substituir) |
| `icon-maskable-512.png` | 512×512 | Adaptive icon Android (safe zone 60%) |
| `feature-graphic-1024x500.png` | 1024×500 | Banner principal da ficha |
| `screenshot-1-painel.png` | 1080×1920 | Phone screenshot — Painel (dose, peso, potência) |
| `screenshot-2-medicacao.png` | 1080×1920 | Phone screenshot — Medicação (tratamento atual) |
| `screenshot-3-checkin.png` | 1080×1920 | Phone screenshot — Check-in (saciedade, fome) |
| `screenshot-4-jornada.png` | 1080×1920 | Phone screenshot — Minha jornada (progresso) |

## Como subir (manual no Play Console, ~3 min)

Caminho automatizado fica pra depois — primeiro upload de ficha sempre é manual.

1. Play Console → **Sanova** → **Visão geral da publicação** OU **Detalhes principais da loja**
2. **Detalhes principais da loja**:
   - Nome do app: `Sanova`
   - Descrição curta: `Companheiro educativo para tratamento com GLP-1.`
   - Descrição completa: (rascunho abaixo)
3. **Recursos gráficos**:
   - Ícone do app: `icon-512.png` (drag & drop)
   - Gráfico de destaque: `feature-graphic-1024x500.png`
   - **Smartphone**: arrasta 4 screenshots (mínimo 2, máximo 8)
4. Salva.

## Rascunho da descrição completa (Bruno aprova/edita)

```
Sanova é um companheiro educativo para quem está em tratamento com medicamentos
GLP-1 (Tirzepatida, Semaglutida, Liraglutida).

⚖️ Acompanhe sua dose, frequência e adesão
🥩 Calcule sua meta de proteína por massa magra (não por peso) — protege contra
   sarcopenia que o déficit calórico do GLP-1 pode causar
💧 Lembrete personalizado de hidratação por nível de atividade
📊 Análise clínica da semana com sinais honestos (não trofeus falsos)
🩺 Compartilhe com seu médico ou nutricionista via código de convite

O Sanova não substitui acompanhamento médico. É uma ferramenta de organização
pessoal e educação. Toda decisão clínica é do seu profissional de saúde.
```

## Política de privacidade (URL pra ficha)

`https://sanova.app.br/privacidade.html`

## Categoria sugerida

**Saúde e fitness** (sub-categoria: gerenciamento médico)

## Classificação etária

Provável: 12+. Bruno preenche o questionário (Play Console) sobre conteúdo médico,
dados de saúde, etc.

## Gerado por

Script Python (`/tmp/gen_icons_light.py` + `/tmp/gen_screenshots.py`) usando Pillow.

**v2 (Fable Turno 25, decisão do Bruno):** fundo CLARO `#F2F8F4` → `#E8F3EC`
→ `#D7EBDE` (gradient radial leve, visual healthtech). Folha em `#22C55E`
(`LEAF_MAIN`) com outline `#0F5C2F` e nervuras brancas. Mesma geometria (gota
invertida 25°), supersampling 3× pra anti-alias smooth. Feature graphic com
wordmark "Sanova" em verde-escuro `#041B0D` + tagline "Emagreça protegendo
o músculo".
