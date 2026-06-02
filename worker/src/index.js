/**
 * Sanova API Worker
 * ─────────────────────────────────────────────────────────────
 * Rotas:
 *   POST /api/analyze-photo  — Reconhece prato a partir de foto (base64)
 *   POST /api/analyze-text   — Estima macros a partir de descricao em texto
 *   POST /api/mp-webhook     — (proxima sessao) Recebe notificacao do MP
 *   GET  /api/health         — Healthcheck publico
 *
 * Provider de IA: Gemini 2.5 Flash via adapter (trocavel).
 * Prompt em PT-BR, focado em comida brasileira.
 */

import { GeminiProvider } from './providers/gemini.js';
import { jsonResponse, corsHeaders, isOriginAllowed } from './http.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';

    // ─── CORS preflight ─────────────────────────────────────
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin, env),
      });
    }

    // ─── Routes ─────────────────────────────────────────────
    try {
      if (url.pathname === '/api/health' && request.method === 'GET') {
        return jsonResponse({ ok: true, version: '1.0.2' }, 200, origin, env);
      }

      // v1.0.1: endpoint de diagnostico — chama Gemini com prompt trivial e
      // retorna status/body cru. Sem CORS check (pra abrir no browser).
      // Usado pra debugar billing/quota/modelo. NAO vaza a API key.
      if (url.pathname === '/api/debug-gemini' && request.method === 'GET') {
        return await handleDebugGemini(env);
      }

      if (url.pathname === '/api/analyze-photo' && request.method === 'POST') {
        return await handleAnalyzePhoto(request, env, origin);
      }

      if (url.pathname === '/api/analyze-text' && request.method === 'POST') {
        return await handleAnalyzeText(request, env, origin);
      }

      if (url.pathname === '/api/mp-webhook' && request.method === 'POST') {
        return jsonResponse(
          { ok: false, error: 'mp-webhook nao implementado nesta versao' },
          501,
          origin,
          env
        );
      }

      return jsonResponse({ ok: false, error: 'not_found' }, 404, origin, env);
    } catch (err) {
      console.error('[sanova-api] erro nao tratado:', err);
      return jsonResponse(
        { ok: false, error: 'internal_error', message: String(err?.message || err) },
        500,
        origin,
        env
      );
    }
  },
};

// ─── /api/analyze-photo ───────────────────────────────────────
// v1.0.2: aceita 2 schemas pra compat com o app legado (Manus.space):
//   - NOVO: { image: "base64", mimeType: "image/jpeg" }
//   - LEGADO: { imageBase64: "data:image/jpeg;base64,<base64>" }
async function handleAnalyzePhoto(request, env, origin) {
  if (!isOriginAllowed(origin, env)) {
    return jsonResponse({ ok: false, error: 'origin_not_allowed' }, 403, origin, env);
  }

  const body = await request.json().catch(() => ({}));
  const raw = body.image || body.imageBase64;
  const context = body.context;

  if (!raw || typeof raw !== 'string') {
    return jsonResponse(
      { ok: false, error: 'missing_image', message: 'Envie image ou imageBase64 como string.' },
      400,
      origin,
      env
    );
  }

  // Extrai mimeType do prefixo data: se houver; senao usa o explicito; default jpeg
  const dataUrlMatch = raw.match(/^data:([^;]+);base64,(.*)$/);
  const cleanBase64 = dataUrlMatch ? dataUrlMatch[2] : raw.replace(/^data:[^;]+;base64,/, '');
  const mimeType = dataUrlMatch ? dataUrlMatch[1] : (body.mimeType || 'image/jpeg');

  const provider = new GeminiProvider(env);
  const result = await provider.analyzePhoto(cleanBase64, mimeType, context);

  return jsonResponse({ ok: true, ...result }, 200, origin, env);
}

// ─── /api/analyze-text ────────────────────────────────────────
async function handleAnalyzeText(request, env, origin) {
  if (!isOriginAllowed(origin, env)) {
    return jsonResponse({ ok: false, error: 'origin_not_allowed' }, 403, origin, env);
  }

  const body = await request.json().catch(() => ({}));
  // v1.0.2: aceita "text" (novo) ou "description" (legado Manus)
  const text = body.text || body.description;
  const context = body.context;

  if (!text || typeof text !== 'string' || text.trim().length < 2) {
    return jsonResponse(
      { ok: false, error: 'missing_text', message: 'Envie text ou description com a descricao do prato.' },
      400,
      origin,
      env
    );
  }

  const provider = new GeminiProvider(env);
  const result = await provider.analyzeText(text.trim(), context);

  return jsonResponse({ ok: true, ...result }, 200, origin, env);
}

// ─── /api/debug-gemini ───────────────────────────────────────
// Faz uma chamada minima ao Gemini ("diga oi") e retorna status + body cru
// pra revelar erros de billing/quota/modelo. Mascara a API key na resposta.
async function handleDebugGemini(env) {
  const model = env.GEMINI_MODEL || 'gemini-2.5-flash';
  const hasKey = !!env.GEMINI_API_KEY;
  const keyHint = hasKey
    ? env.GEMINI_API_KEY.slice(0, 6) + '...' + env.GEMINI_API_KEY.slice(-4)
    : 'AUSENTE';

  if (!hasKey) {
    return new Response(
      JSON.stringify({ ok: false, stage: 'missing_key', model, keyHint }, null, 2),
      { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;
  const body = {
    contents: [{ role: 'user', parts: [{ text: 'Responda apenas "ok"' }] }],
    generationConfig: { temperature: 0 },
  };

  let resp, txt;
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    txt = await resp.text();
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, stage: 'fetch_failed', error: String(e), model, keyHint }, null, 2),
      { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }

  let bodyParsed;
  try { bodyParsed = JSON.parse(txt); } catch { bodyParsed = txt.slice(0, 800); }

  return new Response(
    JSON.stringify(
      {
        ok: resp.ok,
        stage: resp.ok ? 'success' : 'gemini_error',
        httpStatus: resp.status,
        model,
        keyHint,
        body: bodyParsed,
      },
      null,
      2
    ),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    }
  );
}
