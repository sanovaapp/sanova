# Site — Dra. Claudia Cogo | Geriatria

Instruções para o Claude Code construir este site.

## O que é este projeto

Site institucional de consultório da **Dra. Claudia Cogo, médica geriatra**.
Público-alvo: pacientes idosos e, principalmente, **filhos/familiares adultos (40–65 anos)**
que pesquisam e agendam a consulta pelos pais. O site precisa transmitir
confiança, acolhimento e profissionalismo.

Leia `docs/briefing.md` antes de começar — ele contém a especificação completa
de seções, conteúdo e identidade visual.

## Stack

- **HTML + CSS + JavaScript puro** (sem frameworks, sem build step)
- Site estático, uma página por arquivo HTML
- CSS em `css/`, JS em `js/`, imagens em `assets/images/`, logo em `assets/logo/`
- Deve funcionar abrindo `index.html` direto no navegador e em qualquer hospedagem estática

## Regras de implementação

1. **Idioma:** todo o site em português do Brasil (`lang="pt-BR"`).
2. **Mobile-first e responsivo** — grande parte dos acessos virá de celular via WhatsApp/Instagram.
3. **Acessibilidade é prioridade** (público idoso):
   - Fonte base generosa (mínimo 18px no corpo), alto contraste (WCAG AA no mínimo)
   - Botões e links grandes e fáceis de tocar
   - HTML semântico, `alt` em todas as imagens, navegação por teclado
4. **Botão flutuante de WhatsApp** presente em todas as páginas.
5. **Performance:** sem bibliotecas pesadas; lazy-loading de imagens; CSS/JS próprios.
6. **SEO local:** title/description por página, Open Graph, dados estruturados
   (JSON-LD tipo `Physician`), termos como "geriatra", "médica geriatra" + cidade.
7. **Placeholders:** onde faltar conteúdo real (fotos, endereço, CRM, telefone),
   use placeholders claramente marcados com comentário `<!-- TODO: substituir -->`
   e liste-os no README ao final.

## Materiais

Fotos, logo e textos reais serão adicionados em `assets/` pela cliente.
Se `assets/images/` estiver vazio, use placeholders neutros (sem fotos de banco
de imagens embutidas — apenas blocos/gradientes com a paleta do briefing).

## Estrutura de páginas

Ver detalhes no briefing. Resumo:

- `index.html` — Home
- `sobre.html` — Sobre a Dra. Claudia
- `servicos.html` — Serviços / Especialidades
- `depoimentos.html` — Depoimentos
- `contato.html` — Contato (WhatsApp, telefone, mapa, formulário)
