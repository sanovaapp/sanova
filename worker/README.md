# sanova-api — Worker Cloudflare

Backend do Sanova. Substitui o proxy Manus.space (que esta morrendo).

## Rotas

| Metodo | Rota | O que faz |
|---|---|---|
| GET | `/api/health` | Healthcheck publico |
| POST | `/api/analyze-photo` | Reconhece prato a partir de foto base64 |
| POST | `/api/analyze-text` | Estima macros a partir de descricao em texto |
| POST | `/api/mp-webhook` | (proxima sessao) Webhook do Mercado Pago |

## Secrets necessarios

```bash
wrangler secret put GEMINI_API_KEY
# (proximos)
# wrangler secret put MP_ACCESS_TOKEN_SANDBOX
# wrangler secret put MP_WEBHOOK_SECRET
# wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

## Vars publicas

Definidos em `wrangler.toml`:

- `ALLOWED_ORIGINS` — lista de origins do PWA permitidos (CORS)
- `GEMINI_MODEL` — modelo (default `gemini-2.5-flash`)

## Dev local

```bash
npm install
wrangler dev
# server local em http://localhost:8787
```

## Deploy

```bash
npm install
wrangler deploy
```

## Testar `/api/analyze-text` (sandbox)

```bash
curl -X POST https://sanova-api.contatosanovaapp.workers.dev/api/analyze-text \
  -H "Origin: https://sanovaapp.github.io" \
  -H "Content-Type: application/json" \
  -d '{"text":"PF com arroz, feijao, frango grelhado e salada"}'
```

## Estrutura

```
worker/
├── package.json
├── wrangler.toml
├── README.md
└── src/
    ├── index.js          # Roteador HTTP
    ├── http.js           # CORS + helpers
    ├── prompts.js        # Prompts PT-BR
    └── providers/
        └── gemini.js     # Adapter Gemini
```

## Como trocar de provider (futuro)

Implementa `OpenAIProvider` em `src/providers/openai.js` com mesma
interface (`analyzePhoto`, `analyzeText`) e troca 1 linha no `index.js`.
