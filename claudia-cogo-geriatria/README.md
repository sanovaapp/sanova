# Site — Dra. Claudia Cogo · Geriatria

Site institucional do consultório da Dra. Claudia Cogo (médica geriatra).
Construído conforme `docs/briefing.md`, seguindo a identidade visual oficial
(`assets/logo/identidade-visual.webp`): oliva escuro, creme, taupe e dourado,
com a tagline **Saúde · Prevenção · Longevidade**.

## Visualizar o site

Basta abrir `index.html` no navegador, ou rodar um servidor local:

```
python3 -m http.server 8000
```

e acessar `http://localhost:8000`.

## Estrutura

```
claudia-cogo-geriatria/
├── index.html           # Home (hero, serviços, mini-bio, depoimentos, CTA)
├── sobre.html           # Trajetória e filosofia de cuidado
├── servicos.html        # 8 serviços com "para quem é indicado"
├── depoimentos.html     # Grade de depoimentos + nota CFM
├── contato.html         # WhatsApp, telefone, mapa, formulário
├── css/style.css        # Design system da marca (mobile-first, WCAG AA)
├── js/main.js           # Menu, formulário→WhatsApp, carrossel, links wa.me
├── assets/
│   ├── images/claudia-retrato.webp    # Foto profissional (recebida)
│   └── logo/identidade-visual.webp    # Prancha da identidade (referência)
└── docs/briefing.md     # Especificação completa
```

## Como atualizar o número de WhatsApp

Todos os botões de WhatsApp são preenchidos pelo `js/main.js`. Edite **um único
lugar** — a constante `CONFIG.whatsapp` no topo de `js/main.js`:

```js
whatsapp: "5599999999999", // 55 + DDD + número, só dígitos
```

(Os `href` estáticos `https://wa.me/55XXXXXXXXXXX` no HTML servem apenas de
fallback sem JavaScript — recomendo substituí-los também com um busca-e-troca.)

## Pendências de conteúdo (TODO)

Todos os placeholders estão marcados no código com `<!-- TODO: ... -->`.

| Item | Onde substituir | Status |
|---|---|---|
| Foto profissional | `assets/images/claudia-retrato.webp` | ✅ recebida e aplicada |
| Identidade visual | `assets/logo/identidade-visual.webp` | ✅ recebida (logo recriado em HTML/CSS; falta SVG/PNG isolado) |
| Número de WhatsApp | `js/main.js` (`CONFIG.whatsapp`) + `href` estáticos | ⬜ pendente |
| CRM / RQE | `sobre.html` (hero) + rodapé de todas as páginas + badge no hero da home | ⬜ pendente |
| Nome completo | rodapé de todas as páginas | ⬜ pendente |
| Telefone | `contato.html` + rodapés (`tel:+55...`) | ⬜ pendente |
| E-mail | `contato.html` + rodapés (`mailto:`) | ⬜ pendente |
| Endereço do consultório | `contato.html` + rodapés + JSON-LD em `index.html` | ⬜ pendente |
| Mapa (Google Maps embed) | `contato.html` (bloco `map-placeholder`, instruções no comentário) | ⬜ pendente |
| Horários de atendimento | `contato.html` | ⬜ pendente |
| Convênios / particular | `contato.html` | ⬜ pendente |
| Instagram (@) | rodapé de todas as páginas (`href="#"`) | ⬜ pendente |
| Lista final de serviços | `servicos.html` (paliativos, domiciliar e telemedicina aguardam confirmação) | ⬜ pendente |
| Depoimentos reais | `depoimentos.html` + carrossel em `index.html` (textos atuais são ilustrativos) | ⬜ pendente |
| Domínio real | `<link rel="canonical">` e `og:url` em todas as páginas | ⬜ pendente |
| Formação/experiência | `sobre.html` (cards de trajetória) | ⬜ pendente |

## Notas técnicas

- **Stack:** HTML + CSS + JS puro, sem build. Funciona abrindo `index.html`
  direto ou em qualquer hospedagem estática.
- **Acessibilidade:** corpo com 18px, contraste AA, alvos de toque ≥ 56px,
  HTML semântico, navegação por teclado, `skip-link`, `prefers-reduced-motion`.
- **SEO:** title/description por página, Open Graph, JSON-LD `Physician`
  na home (atualizar com endereço/telefone reais).
- **Formulário de contato:** não envia dados a servidor — abre o WhatsApp com
  a mensagem preenchida.
- **Fontes:** Cormorant Garamond (títulos) + Inter (corpo), via Google Fonts.
- **Logo:** recriado em HTML/CSS (monograma SVG + tipografia) usando a prancha
  como referência, até a cliente enviar o arquivo isolado.
