/**
 * Sanova API Worker
 * ─────────────────────────────────────────────────────────────
 * Rotas:
 *   POST /api/analyze-photo       — Reconhece prato a partir de foto (base64)
 *   POST /api/analyze-text        — Estima macros a partir de descricao em texto
 *   POST /api/mp-create-preapproval — Cria assinatura recorrente MP, devolve URL
 *   POST /api/mp-webhook          — Recebe notificacao MP, atualiza Supabase
 *   GET  /api/health              — Healthcheck publico
 *   GET  /api/debug-gemini        — Diagnostico Gemini (status/keyHint)
 *
 * Provider de IA: Gemini 2.5 Flash via adapter (trocavel).
 * Cobranca: Mercado Pago (sandbox via MP_ACCESS_TOKEN_SANDBOX).
 * Escrita Supabase: service_role key (so o Worker tem; nunca no client).
 */

import { GeminiProvider } from './providers/gemini.js';
import { jsonResponse, corsHeaders, isOriginAllowed } from './http.js';
import { createPreapproval, getPreapproval, getPayment, verifyWebhookSignature, createTestUser } from './mp.js';
import { updateSubscriptionByUser, updateSubscriptionByPreapproval, findUserByEmail } from './supabase.js';

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
        return jsonResponse({ ok: true, version: '1.1.1' }, 200, origin, env);
      }

      // v1.1.0: cria assinatura recorrente no MP e devolve URL de checkout
      if (url.pathname === '/api/mp-create-preapproval' && request.method === 'POST') {
        return await handleMpCreatePreapproval(request, env, origin);
      }

      // v1.1.0: recebe notificacao do MP, valida HMAC, atualiza Supabase
      if (url.pathname === '/api/mp-webhook' && request.method === 'POST') {
        return await handleMpWebhook(request, env);
      }

      // v1.0.1: endpoint de diagnostico — chama Gemini com prompt trivial e
      // retorna status/body cru. Sem CORS check (pra abrir no browser).
      // Usado pra debugar billing/quota/modelo. NAO vaza a API key.
      if (url.pathname === '/api/debug-gemini' && request.method === 'GET') {
        return await handleDebugGemini(env);
      }

      // v1.1.1: helper pra criar Test User no MP sandbox (Bruno usa pra logar
      // no checkout em vez da conta real dele). Sem CORS check.
      // Acesso: GET /api/mp-create-test-user (1 chamada gera 1 conta)
      if (url.pathname === '/api/mp-create-test-user' && request.method === 'GET') {
        return await handleMpCreateTestUser(env);
      }

      if (url.pathname === '/api/analyze-photo' && request.method === 'POST') {
        return await handleAnalyzePhoto(request, env, origin);
      }

      if (url.pathname === '/api/analyze-text' && request.method === 'POST') {
        return await handleAnalyzeText(request, env, origin);
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

// ─── /api/mp-create-preapproval ──────────────────────────────
// Recebe { userId, email } do app, cria assinatura recorrente no MP,
// devolve { init_point } com a URL de checkout pro paciente pagar.
// Tambem grava mp_preapproval_id na linha do Supabase pra rastreamento.
async function handleMpCreatePreapproval(request, env, origin) {
  if (!isOriginAllowed(origin, env)) {
    return jsonResponse({ ok: false, error: 'origin_not_allowed' }, 403, origin, env);
  }

  const body = await request.json().catch(() => ({}));
  const userId = body.userId;
  const email = body.email;
  const backUrl = body.backUrl || 'https://sanovaapp.github.io/sanova/?mp_return=1';

  if (!userId || !email) {
    return jsonResponse(
      { ok: false, error: 'missing_params', message: 'userId e email obrigatorios.' },
      400, origin, env
    );
  }

  try {
    const preapproval = await createPreapproval({ userId, payerEmail: email, backUrl }, env);

    // Grava preapproval_id na assinatura existente (criada pelo trigger no signup)
    try {
      await updateSubscriptionByUser(userId, {
        mp_preapproval_id: preapproval.id,
      }, env);
    } catch (e) {
      console.error('[mp-create-preapproval] supabase update falhou:', e.message);
      // Nao bloqueia o checkout — paciente ainda pode pagar; webhook reconcilia depois.
    }

    return jsonResponse({
      ok: true,
      init_point: preapproval.init_point,
      preapproval_id: preapproval.id,
      status: preapproval.status,
    }, 200, origin, env);
  } catch (err) {
    console.error('[mp-create-preapproval] erro:', err);
    return jsonResponse(
      { ok: false, error: 'mp_error', message: String(err.message || err) },
      500, origin, env
    );
  }
}

// ─── /api/mp-webhook ─────────────────────────────────────────
// Mercado Pago chama esse endpoint quando algo muda na assinatura/pagamento.
// Tipos esperados:
//   - type=subscription_preapproval ou type=preapproval -> mudou status da assinatura
//   - type=payment                                       -> houve pagamento (cobrar mes)
//   - type=subscription_authorized_payment               -> pagamento da assinatura cobrado
// Sempre validar HMAC com MP_WEBHOOK_SECRET antes de agir.
async function handleMpWebhook(request, env) {
  const rawBody = await request.text();
  let body = {};
  try { body = JSON.parse(rawBody); } catch (e) {}

  // 1) Valida assinatura HMAC (rejeita silenciosamente se invalida)
  const sig = await verifyWebhookSignature(request, body, env);
  if (!sig.ok) {
    console.warn('[mp-webhook] HMAC invalido:', sig.reason);
    // MP exige 200 mesmo em rejeicao silenciosa pra nao retentar infinito;
    // mas pra defender de spam, devolvemos 401 em DEV. Em prod manter 200.
    return new Response(JSON.stringify({ ok: false, error: sig.reason }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const type = url.searchParams.get('type') || body.type || body.action || '';
  const dataId = url.searchParams.get('data.id') || url.searchParams.get('id')
              || (body && body.data && body.data.id) || (body && body.id) || '';

  console.log('[mp-webhook] type=' + type + ' dataId=' + dataId);

  try {
    // ── PREAPPROVAL (status da assinatura mudou) ──
    if (type === 'preapproval' || type === 'subscription_preapproval') {
      const pa = await getPreapproval(dataId, env);
      // pa.status: pending | authorized | paused | cancelled
      let status = 'trial';
      let extraFields = { mp_preapproval_id: pa.id };

      if (pa.status === 'authorized') {
        status = 'active';
        extraFields.subscription_started_at = pa.date_created || new Date().toISOString();
      } else if (pa.status === 'cancelled' || pa.status === 'paused') {
        status = 'canceled';
        extraFields.subscription_ends_at = new Date().toISOString();
      }

      const userId = await _resolveUserId(pa, env);
      if (userId) {
        await updateSubscriptionByUser(userId, { status, ...extraFields }, env);
      } else {
        // Fallback: tenta achar pelo preapproval_id ja gravado
        await updateSubscriptionByPreapproval(pa.id, { status, ...extraFields }, env);
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // ── PAYMENT (cobranca recorrente confirmada) ──
    if (type === 'payment' || type === 'subscription_authorized_payment') {
      const pay = await getPayment(dataId, env);
      // pay.status: approved | rejected | refunded | charged_back ...
      // Vincular pelo external_reference (sanova_<user_id>) se presente
      const extRef = pay.external_reference || '';
      const userId = extRef.startsWith('sanova_') ? extRef.replace(/^sanova_/, '') : null;

      if (pay.status === 'approved' && userId) {
        await updateSubscriptionByUser(userId, {
          status: 'active',
          subscription_started_at: pay.date_approved || new Date().toISOString(),
        }, env);
      } else if ((pay.status === 'refunded' || pay.status === 'charged_back') && userId) {
        await updateSubscriptionByUser(userId, { status: 'canceled' }, env);
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // Tipo desconhecido — apenas reconhece
    return new Response(JSON.stringify({ ok: true, ignored: type }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[mp-webhook] erro processando:', err);
    return new Response(JSON.stringify({ ok: false, error: String(err.message || err) }), {
      status: 200, // 200 pra evitar retentativas infinitas; logamos pra investigar
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Resolve user_id a partir de uma preapproval do MP.
// Prioridade: external_reference (sanova_<uuid>) > payer_email.
async function _resolveUserId(pa, env) {
  if (pa.external_reference && pa.external_reference.startsWith('sanova_')) {
    return pa.external_reference.replace(/^sanova_/, '');
  }
  if (pa.payer_email) {
    return await findUserByEmail(pa.payer_email, env);
  }
  return null;
}

// ─── /api/mp-create-test-user (v1.1.1) ───────────────────────
// Cria um Test User do MP sandbox e retorna credenciais cruas
// pra Bruno copiar. Sem CORS, sem auth — endpoint temporario,
// remover quando sandbox testing terminar.
async function handleMpCreateTestUser(env) {
  try {
    const user = await createTestUser(env);
    // Retorna formato amigavel pra Bruno copiar do browser
    return new Response(
      JSON.stringify(
        {
          ok: true,
          email: user.email,
          password: user.password,
          nickname: user.nickname,
          id: user.id,
          site_status: user.site_status,
          como_usar:
            'Em uma aba anonima, va no checkout do app Sanova e faca login no MP com esse email/password. Depois preencha cartao de teste 5031 4332 1540 6351 nome APRO.',
        },
        null,
        2
      ),
      { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: String(err.message || err) }, null, 2),
      { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }
}
