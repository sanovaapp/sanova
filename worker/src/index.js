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
import { createPreapproval, getPreapproval, getPayment, verifyWebhookSignature, createTestUser, createPreapprovalPlanMP, buildCheckoutUrlForPlan } from './mp.js';
import { updateSubscriptionByUser, updateSubscriptionByPreapproval, findUserByEmail, countRows, isEmailAdmin, generateMagicLink, getMpPlan, upsertMpPlan, listRecentSubscriptions } from './supabase.js';
import { requireAdmin } from './auth.js';
import { handleProRegister, handleProMe, handleProPatients, handleProPatient, handleLinkProfessional, handleUnlinkProfessional, handleMyProfessionals, handleProAssets } from './pro.js';

// v1.24.0: gate de admin pras rotas /api/admin-*.
// Retorna Response 401/403 se nao autorizado, ou null pra deixar passar.
async function gateAdmin(request, env, origin) {
  const r = await requireAdmin(request, env);
  if (r.ok) return null;
  return jsonResponse(
    { ok: false, error: r.error || 'unauthorized' },
    r.status || 401,
    origin,
    env
  );
}

// v1.24.0: limite generico de payload pra endpoints publicos.
// Aceita ate maxBytes; corta acima disso com 413.
async function readBodyWithLimit(request, maxBytes) {
  const cl = Number(request.headers.get('content-length') || 0);
  if (cl && cl > maxBytes) return { tooBig: true, size: cl };
  const buf = await request.arrayBuffer();
  if (buf.byteLength > maxBytes) return { tooBig: true, size: buf.byteLength };
  return { tooBig: false, text: new TextDecoder().decode(buf) };
}

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
        return jsonResponse({ ok: true, version: '1.28.8' }, 200, origin, env);
      }

      // ─── Painel Profissional (Fase 1) ────────────────────────
      if (url.pathname === '/api/pro-register' && request.method === 'POST') {
        return await handleProRegister(request, env, origin);
      }
      if (url.pathname === '/api/pro-me' && request.method === 'GET') {
        return await handleProMe(request, env, origin);
      }
      if (url.pathname === '/api/pro-patients' && request.method === 'GET') {
        return await handleProPatients(request, env, origin);
      }
      if (url.pathname === '/api/pro-patient' && request.method === 'GET') {
        return await handleProPatient(request, env, origin);
      }
      if (url.pathname === '/api/link-professional' && request.method === 'POST') {
        return await handleLinkProfessional(request, env, origin);
      }
      if (url.pathname === '/api/unlink-professional' && request.method === 'POST') {
        return await handleUnlinkProfessional(request, env, origin);
      }
      // v1.28.4: paciente lista os pros vinculados ativos (pra UI co-branding + revogar)
      if (url.pathname === '/api/my-professionals' && request.method === 'GET') {
        return await handleMyProfessionals(request, env, origin);
      }
      // v1.28.5: pro envia foto/logo (base64) — salva no bucket pro-assets
      if (url.pathname === '/api/pro-assets' && request.method === 'POST') {
        return await handleProAssets(request, env, origin);
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

      // v1.2.0: debug do estado admin (tabela existe? bruno e admin?)
      // Acessar via GET /api/debug-admin no browser. Sem dados sensiveis.
      if (url.pathname === '/api/debug-admin' && request.method === 'GET') {
        return await handleDebugAdmin(env);
      }

      // v1.24.0: TODAS as rotas /api/admin-* exigem auth (JWT Supabase no
      // header Authorization, OU X-Admin-Token pra GitHub Actions).
      // Sem isso, qualquer um na internet acionava simulate-active / lia
      // emails de pacientes. Auditoria Manus 09/06/2026.
      if (url.pathname.startsWith('/api/admin-') && request.method === 'GET') {
        const gate = await gateAdmin(request, env, origin);
        if (gate) return gate;
      }

      // v1.3.0: helpers admin pra testar o pipeline sem precisar pagamento real.
      if (url.pathname === '/api/admin-simulate-active' && request.method === 'GET') {
        return await handleAdminSimulate(env, 'active');
      }
      if (url.pathname === '/api/admin-revert-trial' && request.method === 'GET') {
        return await handleAdminSimulate(env, 'trial');
      }

      // v1.4.0: gera magic link pro Bruno (E2E testing via Playwright)
      if (url.pathname === '/api/admin-magic-link-bruno' && request.method === 'GET') {
        return await handleAdminMagicLink(env);
      }

      // v1.5.0: seeda app_state do Bruno no Supabase com profile completo
      // pra E2E nao depender de localStorage (que sync sobrescreve).
      if (url.pathname === '/api/admin-seed-bruno-profile' && request.method === 'GET') {
        return await handleAdminSeedProfile(env);
      }

      // v1.25.0 (Fable prints v2): seed completo com 7d daily + 7 pesagens +
      // refeicoes com proteina. Resolve race com sync (updatedAt + ownedBy).
      if (url.pathname === '/api/admin-seed-fixture-completa' && request.method === 'GET') {
        return await handleAdminSeedFixtureCompleta(env);
      }

      // v1.28.7 (Fable Turno 14): conta-demo "Mariana" (demo@sanova.app),
      // 13 semanas de dados realistas pra gravacao dos videos promocionais.
      // Idempotente (re-seed antes de cada gravacao). Inclui pro-demo
      // "Dra. Ana" vinculada + 2 pacientes-sombra (João verde, Carla vermelha).
      if (url.pathname === '/api/admin-seed-demo' && request.method === 'GET') {
        return await handleAdminSeedDemo(env);
      }

      // v1.28.9: diagnostico admin — lista patient_links + professionals
      // (debug do dashboard pro que mostrou PACIENTES (0) apos seed).
      if (url.pathname === '/api/admin-debug-pro-state' && request.method === 'GET') {
        const SUPABASE_URL = 'https://yjycpcydqfuvojfzwfvy.supabase.co';
        const svcH = {
          'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY,
        };
        const [pros, links] = await Promise.all([
          fetch(SUPABASE_URL + '/rest/v1/professionals?select=id,user_id,nome,invite_code', { headers: svcH })
            .then(r => r.json()).catch(e => ({ erro: e.message })),
          fetch(SUPABASE_URL + '/rest/v1/patient_links?select=*&limit=50', { headers: svcH })
            .then(r => r.json()).catch(e => ({ erro: e.message })),
        ]);
        return jsonResponse({ ok: true, professionals: pros, patient_links: links }, 200, origin, env);
      }

      // v1.27.0 (Fable prints v3): bootstrap completo de conta fixture
      // dedicada (fixture@sanova.app). Cria user se nao existe, seeda
      // app_state, marca subscription active, gera magic link. 1 chamada.
      // Evita mexer na subscription real do fundador durante prints.
      if (url.pathname === '/api/admin-fixture-bootstrap' && request.method === 'GET') {
        // v1.28.3 (Fable Turno 5 #1): ?modo=incompleta cria fixture com 3 dias
        // parciais (sem refeicoes em 2 deles) pra exercitar o gate do balanco
        // que com 7 dias completos da fixture default nunca dispara.
        const modo = url.searchParams.get('modo') || 'completa';
        return await handleAdminFixtureBootstrap(env, modo);
      }

      // v1.6.0: aplica templates de email branded Sanova via Supabase Management API.
      // Requer env.SUPABASE_MGMT_TOKEN (PAT do dashboard). Idempotente.
      if (url.pathname === '/api/admin-set-email-templates' && request.method === 'GET') {
        return await handleAdminSetEmailTemplates(env);
      }

      // v1.7.0: configura site_url + uri_allow_list pra reset/magic link
      // nao darem 404 (caem em sanovaapp.github.io/ em vez de /sanova/).
      if (url.pathname === '/api/admin-set-auth-urls' && request.method === 'GET') {
        return await handleAdminSetAuthUrls(env);
      }

      // v1.9.0: cria os 2 preapproval_plan no MP (mensal+anual) se ainda
      // nao existem na tabela mp_plans. Idempotente.
      if (url.pathname === '/api/admin-ensure-mp-plans' && request.method === 'GET') {
        return await handleAdminEnsureMpPlans(env);
      }

      // v1.10.0: FORÇA recriação dos planos no MP (mesmo se já existem
      // no Supabase). Usado quando muda payment_methods_allowed ou amount.
      if (url.pathname === '/api/admin-recreate-mp-plans' && request.method === 'GET') {
        return await handleAdminRecreateMpPlans(env);
      }

      // v1.11.0: lista as N subscriptions mais recentes (debug pos-pagamento).
      // Sem CORS check — endpoint só usado por Bruno via workflow gateway.
      if (url.pathname === '/api/admin-recent-subscriptions' && request.method === 'GET') {
        return await handleAdminRecentSubscriptions(env);
      }

      // v1.12.0: reconcilia status das subscriptions consultando o MP.
      // Para cada subscription com mp_preapproval_id, pega o status real
      // na API do MP e atualiza no Supabase. Resolve casos onde webhook
      // gravou ID mas não atualizou status (race / webhook perdido).
      if (url.pathname === '/api/admin-reconcile-subscriptions' && request.method === 'GET') {
        return await handleAdminReconcileSubscriptions(env);
      }

      // v1.13.0: retorna preapprovals + payments raw do MP. Debug profundo
      // pra entender por que esposa pagou mas preapproval ficou pending.
      if (url.pathname === '/api/admin-debug-mp-state' && request.method === 'GET') {
        return await handleAdminDebugMpState(env);
      }

      // v1.14.0: reconcilia subscriptions buscando payments por preapproval_id
      // (em vez de external_reference, que MP nao copia do plano pro payment).
      // Resolve o caso real da esposa do Bruno (Claudia Cogo) em produção.
      if (url.pathname === '/api/admin-reconcile-via-preapproval-id' && request.method === 'GET') {
        return await handleAdminReconcileViaPreapprovalId(env);
      }

      // v1.15.0: lista TODOS os payments da conta MP nos ultimos N dias.
      // Diagnostico cego pra ver o que MP de fato registrou.
      if (url.pathname === '/api/admin-list-recent-payments' && request.method === 'GET') {
        return await handleAdminListRecentPayments(env);
      }

      // v1.16.0: pega o payment ID 162849895214 (esposa do Bruno) com TODOS
      // os campos. Vou caçar campo que liga ao preapproval/subscription.
      if (url.pathname === '/api/admin-debug-cogo-payment' && request.method === 'GET') {
        return await handleAdminDebugCogoPayment(env);
      }

      // v1.17.0: reconcilia varrendo payments recentes e usando
      // point_of_interaction.transaction_data.subscription_id (ID REAL).
      if (url.pathname === '/api/admin-reconcile-via-payments' && request.method === 'GET') {
        return await handleAdminReconcileViaPayments(env);
      }

      // v1.18.0: pega preapproval REAL ce7d87ef (Claudia) com tudo.
      if (url.pathname === '/api/admin-debug-cogo-real' && request.method === 'GET') {
        return await handleAdminDebugCogoReal(env);
      }

      // v1.19.0: reconcilia LINKANDO preapproval inicial (com external_reference)
      // a preapproval autorizada (sem external_reference) via plano + timestamp.
      if (url.pathname === '/api/admin-reconcile-final' && request.method === 'GET') {
        return await handleAdminReconcileFinal(env);
      }

      // v1.20.0: cleanup falsos positivos do reconcile-final v1. Pra cada
      // subscription active, confirma no MP que charged_quantity > 0. Se
      // não, reverte pra trial.
      if (url.pathname === '/api/admin-cleanup-false-positives' && request.method === 'GET') {
        return await handleAdminCleanupFalsePositives(env);
      }

      // v1.21.0: cleanup CORRETO — pra cada active, busca preapprovals do
      // user via external_reference=sanova_<userId>. Só confirma se HOUVER
      // preapproval authorized COM charged_quantity > 0 dessa busca.
      if (url.pathname === '/api/admin-cleanup-v2' && request.method === 'GET') {
        return await handleAdminCleanupV2(env);
      }

      // v1.23.0: lista payment_methods_allowed dos planos MP (verifica PIX
      // sem precisar entrar no painel MP). Bruno: pendência D removida.
      if (url.pathname === '/api/admin-check-payment-methods' && request.method === 'GET') {
        return await handleAdminCheckPaymentMethods(env);
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

  // v1.24.0: cap em ~6MB JSON (foto base64 grande de celular ~4-5MB).
  // Bloqueia atacante que mandaria 50MB pra estourar Worker/Gemini.
  const lim = await readBodyWithLimit(request, 6 * 1024 * 1024);
  if (lim.tooBig) {
    return jsonResponse({ ok: false, error: 'payload_too_large', max: 6291456 }, 413, origin, env);
  }
  let body;
  try { body = JSON.parse(lim.text || '{}'); } catch { body = {}; }
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

  // v1.24.0: cap em 16KB (descricao de prato em pt-BR raramente passa de 500 chars).
  const lim = await readBodyWithLimit(request, 16 * 1024);
  if (lim.tooBig) {
    return jsonResponse({ ok: false, error: 'payload_too_large', max: 16384 }, 413, origin, env);
  }
  let body;
  try { body = JSON.parse(lim.text || '{}'); } catch { body = {}; }
  // v1.0.2: aceita "text" (novo) ou "description" (legado Manus)
  const text = body.text || body.description;
  const context = body.context;

  // Cap adicional no campo text: 2000 chars (defesa em profundidade).
  if (text && typeof text === 'string' && text.length > 2000) {
    return jsonResponse({ ok: false, error: 'text_too_long', max: 2000 }, 413, origin, env);
  }

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

// ─── /api/mp-create-preapproval (v1.9.0) ─────────────────────
// REFATORADO: nao cria mais preapproval direto (que amarrava payer_email
// e quebrava quando email Sanova != email conta MP).
//
// Agora retorna init_point do preapproval_plan publico (mensal ou anual),
// com external_reference=sanova_<userId> pra webhook reconciliar.
// Paciente loga no MP com QUALQUER conta — sem mismatch de email.
async function handleMpCreatePreapproval(request, env, origin) {
  if (!isOriginAllowed(origin, env)) {
    return jsonResponse({ ok: false, error: 'origin_not_allowed' }, 403, origin, env);
  }

  const body = await request.json().catch(() => ({}));
  const userId = body.userId;
  const planoIn = body.plano;
  const backUrl = body.backUrl || 'https://sanova.app.br/?mp_return=1';
  const tipo = (planoIn === 'anual') ? 'anual' : 'mensal';

  if (!userId) {
    return jsonResponse(
      { ok: false, error: 'missing_params', message: 'userId obrigatorio.' },
      400, origin, env
    );
  }

  try {
    // 1) garante que o plano existe (auto-cria se faltar)
    let plano = await getMpPlan(tipo, env);
    if (!plano) {
      const created = await createPreapprovalPlanMP({ tipo, backUrl }, env);
      plano = await upsertMpPlan({
        tipo,
        mp_plan_id: created.id,
        init_point: created.init_point,
        reason: created.reason,
        amount: created.auto_recurring && created.auto_recurring.transaction_amount,
      }, env);
    }

    const checkoutUrl = buildCheckoutUrlForPlan({
      planId: plano.mp_plan_id,
      userId,
      backUrl,
    });

    return jsonResponse({
      ok: true,
      init_point: checkoutUrl,
      plan_id: plano.mp_plan_id,
      tipo,
    }, 200, origin, env);
  } catch (err) {
    console.error('[mp-create-preapproval] erro:', err);
    return jsonResponse(
      { ok: false, error: 'mp_error', message: String(err.message || err) },
      500, origin, env
    );
  }
}

// ─── /api/admin-ensure-mp-plans (v1.9.0) ─────────────────────
// Idempotente. Cria mensal+anual se nao existem no Supabase.mp_plans.
async function handleAdminEnsureMpPlans(env) {
  const backUrl = 'https://sanova.app.br/?mp_return=1';
  const result = {};
  try {
    for (const tipo of ['mensal', 'anual']) {
      let p = await getMpPlan(tipo, env);
      if (!p) {
        const created = await createPreapprovalPlanMP({ tipo, backUrl }, env);
        p = await upsertMpPlan({
          tipo,
          mp_plan_id: created.id,
          init_point: created.init_point,
          reason: created.reason,
          amount: created.auto_recurring && created.auto_recurring.transaction_amount,
        }, env);
        result[tipo] = { criado: true, mp_plan_id: p.mp_plan_id, init_point: p.init_point };
      } else {
        result[tipo] = { criado: false, mp_plan_id: p.mp_plan_id, init_point: p.init_point };
      }
    }
    return new Response(
      JSON.stringify({ ok: true, planos: result }, null, 2),
      { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: String(err.message || err) }, null, 2),
      { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }
}

// ─── /api/admin-recreate-mp-plans (v1.10.0) ──────────────────
// FORÇA recriação dos planos (mesmo se já existem no Supabase).
// Usado quando muda payment_methods_allowed/amount/reason no MP.
// Os planos antigos no MP ficam ativos até MP arquivar, mas
// Supabase passa a apontar pros novos imediatamente.
async function handleAdminRecreateMpPlans(env) {
  const backUrl = 'https://sanova.app.br/?mp_return=1';
  const result = {};
  try {
    for (const tipo of ['mensal', 'anual']) {
      const created = await createPreapprovalPlanMP({ tipo, backUrl }, env);
      const p = await upsertMpPlan({
        tipo,
        mp_plan_id: created.id,
        init_point: created.init_point,
        reason: created.reason,
        amount: created.auto_recurring && created.auto_recurring.transaction_amount,
      }, env);
      result[tipo] = { mp_plan_id: p.mp_plan_id, init_point: p.init_point };
    }
    return new Response(
      JSON.stringify({ ok: true, recriado: true, planos: result, nota: 'Planos antigos no MP continuam existindo mas Supabase aponta pros novos. Proximo /api/mp-create-preapproval usa os novos.' }, null, 2),
      { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: String(err.message || err) }, null, 2),
      { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }
}

// ─── /api/admin-recent-subscriptions (v1.11.0) ───────────────
// Lista últimas 10 rows de subscriptions com email do paciente.
// Usado pra validar webhook MP em produção (ex: confirmar que
// pagamento real virou status='active' na tabela).
async function handleAdminRecentSubscriptions(env) {
  try {
    const result = await listRecentSubscriptions(10, env);
    return new Response(
      JSON.stringify(result, null, 2),
      { status: result.ok ? 200 : 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: String(err.message || err) }, null, 2),
      { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }
}

// ─── /api/admin-cleanup-v2 (v1.21.0) ─────────────────────────
// Cleanup CORRETO. Pra cada sub active, busca preapprovals com
// external_reference=sanova_<userId>. Se houver authorized + charged
// > 0, confirma com esse ID. Senão, reverte pra trial.
async function handleAdminCleanupV2(env) {
  const token = env.MP_ACCESS_TOKEN_SANDBOX || env.MP_ACCESS_TOKEN;
  if (!token) {
    return new Response(JSON.stringify({ ok: false, error: 'MP_ACCESS_TOKEN ausente' }, null, 2),
      { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  }
  const log = [];
  try {
    const subs = await listRecentSubscriptions(20, env);
    const candidatos = (subs.subscriptions || []).filter(s =>
      s.status === 'active' &&
      s.mp_preapproval_id &&
      !s.mp_preapproval_id.startsWith('admin-simulated-')
    );
    for (const s of candidatos) {
      const item = { email: s.email, mp_preapproval_id_anterior: s.mp_preapproval_id };
      try {
        const userId = await findUserByEmail(s.email, env);
        if (!userId) { item.nota = 'user nao encontrado por email'; log.push(item); continue; }
        item.user_id_curto = userId.slice(0, 8) + '...';
        // search por preapprovals com external_reference UNICO
        const extRef = 'sanova_' + userId;
        const r = await fetch('https://api.mercadopago.com/preapproval/search?external_reference=' + encodeURIComponent(extRef) + '&limit=10', {
          headers: { 'Authorization': 'Bearer ' + token },
        });
        if (!r.ok) { item.nota = 'search HTTP ' + r.status; log.push(item); continue; }
        const j = await r.json().catch(() => ({}));
        const minhas = j.results || [];
        item.preapprovals_encontradas = minhas.map(p => ({
          id: p.id,
          status: p.status,
          charged: p.summarized && p.summarized.charged_quantity || 0,
        }));
        const real = minhas.find(p => p.status === 'authorized' && p.summarized && p.summarized.charged_quantity > 0);
        if (real) {
          await updateSubscriptionByUser(userId, {
            status: 'active',
            mp_preapproval_id: real.id,
            subscription_started_at: (real.summarized && real.summarized.last_charged_date) || real.date_created,
          }, env);
          item.acao = 'mantido active com ID real ' + real.id;
        } else {
          await updateSubscriptionByUser(userId, {
            status: 'trial',
            mp_preapproval_id: null,
            subscription_started_at: null,
            subscription_ends_at: null,
          }, env);
          item.acao = 'revertido pra trial (sem cobranca real)';
        }
        log.push(item);
      } catch (err) {
        item.erro = String(err.message || err);
        log.push(item);
      }
    }
    return new Response(JSON.stringify({ ok: true, total: candidatos.length, log }, null, 2),
      { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err.message || err), parcial: log }, null, 2),
      { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  }
}

// ─── /api/admin-check-payment-methods (v1.23.0) ──────────────
// Lista payment_methods_allowed dos preapproval_plans cadastrados no
// Supabase (mp_plans). Usado pra verificar se PIX/boleto/cartão já
// estão aceitos sem precisar entrar no painel MP.
async function handleAdminCheckPaymentMethods(env) {
  const token = env.MP_ACCESS_TOKEN_SANDBOX || env.MP_ACCESS_TOKEN;
  if (!token) return new Response(JSON.stringify({ ok: false, error: 'MP_ACCESS_TOKEN ausente' }, null, 2),
    { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  const out = [];
  try {
    for (const tipo of ['mensal', 'anual']) {
      const p = await getMpPlan(tipo, env);
      if (!p) { out.push({ tipo, status: 'plano nao encontrado no supabase' }); continue; }
      try {
        const r = await fetch('https://api.mercadopago.com/preapproval_plan/' + p.mp_plan_id, {
          headers: { 'Authorization': 'Bearer ' + token },
        });
        if (!r.ok) { out.push({ tipo, mp_plan_id: p.mp_plan_id, erro: 'HTTP ' + r.status }); continue; }
        const j = await r.json().catch(() => ({}));
        out.push({
          tipo,
          mp_plan_id: p.mp_plan_id,
          status: j.status,
          reason: j.reason,
          auto_recurring: j.auto_recurring,
          payment_methods_allowed: j.payment_methods_allowed,
        });
      } catch (e) {
        out.push({ tipo, mp_plan_id: p.mp_plan_id, erro: String(e.message || e) });
      }
    }
    return new Response(JSON.stringify({ ok: true, planos: out }, null, 2),
      { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err.message || err), parcial: out }, null, 2),
      { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  }
}

// ─── /api/admin-cleanup-false-positives (v1.20.0) ────────────
// Pra cada sub status=active com mp_preapproval_id real (nao admin),
// confirma no MP via summarized.charged_quantity. Se zero, reverte
// pra trial. Resolve falsos positivos do reconcile-final v1.
async function handleAdminCleanupFalsePositives(env) {
  const log = [];
  try {
    const subs = await listRecentSubscriptions(20, env);
    const candidatos = (subs.subscriptions || []).filter(s =>
      s.status === 'active' &&
      s.mp_preapproval_id &&
      !s.mp_preapproval_id.startsWith('admin-simulated-')
    );
    for (const s of candidatos) {
      const item = { email: s.email, mp_preapproval_id: s.mp_preapproval_id };
      try {
        const pa = await getPreapproval(s.mp_preapproval_id, env);
        const charged = (pa.summarized && pa.summarized.charged_quantity) || 0;
        const chargedAmount = (pa.summarized && pa.summarized.charged_amount) || 0;
        item.charged_quantity = charged;
        item.charged_amount = chargedAmount;
        item.mp_status = pa.status;
        if (charged > 0 && chargedAmount > 0) {
          item.acao = 'mantido (paga real)';
        } else {
          // resolve user_id via external_reference (pode estar na preapproval inicial via Supabase)
          const userId = await _resolveUserId(pa, env) || null;
          // se nao conseguiu via preapproval real, usa email -> user
          const finalUserId = userId || (await findUserByEmail(s.email, env));
          if (finalUserId) {
            await updateSubscriptionByUser(finalUserId, {
              status: 'trial',
              mp_preapproval_id: null,
              subscription_started_at: null,
              subscription_ends_at: null,
            }, env);
            item.acao = 'revertido pra trial (sem pagamento real)';
          } else {
            item.acao = 'sem user_id — manual';
          }
        }
        log.push(item);
      } catch (err) {
        item.erro = String(err.message || err);
        log.push(item);
      }
    }
    return new Response(JSON.stringify({ ok: true, total: candidatos.length, log }, null, 2),
      { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err.message || err), parcial: log }, null, 2),
      { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  }
}

// ─── /api/admin-reconcile-final (v1.19.0) ────────────────────
// FIX DEFINITIVO: cada subscription com mp_preapproval_id pending
// → preapproval inicial tem external_reference (sanova_<userId>)
// → busca preapprovals authorized do mesmo plan + janela [-1h, +2h]
// → atualiza Supabase com user resolvido e ID real
async function handleAdminReconcileFinal(env) {
  const token = env.MP_ACCESS_TOKEN_SANDBOX || env.MP_ACCESS_TOKEN;
  if (!token) {
    return new Response(JSON.stringify({ ok: false, error: 'MP_ACCESS_TOKEN ausente' }, null, 2),
      { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  }
  const log = [];
  try {
    const subs = await listRecentSubscriptions(20, env);
    const alvos = (subs.subscriptions || []).filter(s =>
      s.mp_preapproval_id &&
      !s.mp_preapproval_id.startsWith('admin-simulated-') &&
      s.status !== 'active'
    );
    // v1.20.0: rastreia IDs reais já usados por outras subscriptions (mesmo deste run)
    const realIdsUsados = new Set(
      (subs.subscriptions || []).filter(s => s.status === 'active' && s.mp_preapproval_id).map(s => s.mp_preapproval_id)
    );
    for (const s of alvos) {
      const item = { email: s.email, mp_preapproval_id_inicial: s.mp_preapproval_id };
      try {
        const paInicial = await getPreapproval(s.mp_preapproval_id, env);
        const extRef = paInicial.external_reference || '';
        const userId = extRef.startsWith('sanova_') ? extRef.replace(/^sanova_/, '') : null;
        const created = paInicial.date_created;
        const amount = paInicial.auto_recurring && paInicial.auto_recurring.transaction_amount;
        item.user_id_curto = userId ? userId.slice(0, 8) + '...' : null;
        item.amount = amount;
        item.preapproval_inicial_status = paInicial.status;
        if (!userId || !created) {
          item.nota = 'sem user_id/date — pula';
          log.push(item); continue;
        }
        // v1.19.1: a inicial pending nao tem plan_id; filtra so por timestamp + amount
        const t0 = new Date(created); t0.setHours(t0.getHours() - 1);
        const t1 = new Date(created); t1.setHours(t1.getHours() + 24);
        const searchUrl = 'https://api.mercadopago.com/preapproval/search'
          + '?status=authorized'
          + '&date_created_from=' + t0.toISOString()
          + '&date_created_to=' + t1.toISOString()
          + '&limit=50';
        const r = await fetch(searchUrl, { headers: { 'Authorization': 'Bearer ' + token } });
        if (!r.ok) { item.nota = 'search HTTP ' + r.status; log.push(item); continue; }
        const sj = await r.json().catch(() => ({}));
        let candidatos = sj.results || [];
        // filtra por amount igual
        if (amount) {
          candidatos = candidatos.filter(c => c.auto_recurring && c.auto_recurring.transaction_amount === amount);
        }
        item.candidatos_count = candidatos.length;
        // pega a mais proxima no tempo
        const init = new Date(created).getTime();
        candidatos.sort((a, b) => Math.abs(new Date(a.date_created).getTime() - init) - Math.abs(new Date(b.date_created).getTime() - init));
        const matched = candidatos[0];
        if (!matched) { item.nota = 'nenhuma preapproval authorized casa'; log.push(item); continue; }
        // v1.20.0: se já foi atribuído a outra sub, pula (evita falso positivo)
        if (realIdsUsados.has(matched.id)) {
          item.nota = 'preapproval real já atribuída a outra subscription — pula';
          item.mp_preapproval_id_real = matched.id;
          log.push(item); continue;
        }
        // v1.20.0: exige pagamento real (charged_quantity > 0)
        const charged = (matched.summarized && matched.summarized.charged_quantity) || 0;
        if (charged < 1) {
          item.nota = 'preapproval authorized mas sem cobrança real ainda';
          item.mp_preapproval_id_real = matched.id;
          log.push(item); continue;
        }
        item.mp_preapproval_id_real = matched.id;
        item.matched_amount = matched.summarized && matched.summarized.charged_amount;
        item.matched_date = matched.date_created;
        await updateSubscriptionByUser(userId, {
          status: 'active',
          mp_preapproval_id: matched.id,
          subscription_started_at: (matched.summarized && matched.summarized.last_charged_date) || matched.date_created || new Date().toISOString(),
        }, env);
        realIdsUsados.add(matched.id);
        item.atualizado = 'active';
        log.push(item);
      } catch (err) {
        item.erro = String(err.message || err);
        log.push(item);
      }
    }
    return new Response(JSON.stringify({ ok: true, total: alvos.length, log }, null, 2),
      { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err.message || err), parcial: log }, null, 2),
      { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  }
}

// ─── /api/admin-debug-cogo-real (v1.18.0) ────────────────────
async function handleAdminDebugCogoReal(env) {
  const token = env.MP_ACCESS_TOKEN_SANDBOX || env.MP_ACCESS_TOKEN;
  if (!token) {
    return new Response(JSON.stringify({ ok: false, error: 'MP_ACCESS_TOKEN ausente' }, null, 2),
      { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  }
  try {
    const r = await fetch('https://api.mercadopago.com/preapproval/ce7d87ef74ea415ea081d5d56387b8a4', {
      headers: { 'Authorization': 'Bearer ' + token },
    });
    const txt = await r.text();
    let raw;
    try { raw = JSON.parse(txt); } catch { raw = txt; }
    return new Response(JSON.stringify({ ok: r.ok, http: r.status, raw }, null, 2),
      { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err.message || err) }, null, 2),
      { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  }
}

// ─── /api/admin-reconcile-via-payments (v1.17.0) ─────────────
// Verdadeiro fix definitivo: varre payments recentes da conta MP,
// extrai subscription_id REAL (point_of_interaction.transaction_data.
// subscription_id), busca preapproval real (que tem external_reference
// sanova_<userId>), resolve user, e atualiza subscriptions com status
// active + ID correto.
async function handleAdminReconcileViaPayments(env) {
  const token = env.MP_ACCESS_TOKEN_SANDBOX || env.MP_ACCESS_TOKEN;
  if (!token) {
    return new Response(JSON.stringify({ ok: false, error: 'MP_ACCESS_TOKEN ausente' }, null, 2),
      { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  }
  const log = [];
  try {
    // busca payments aprovados ultimos 30 dias
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    const searchUrl = 'https://api.mercadopago.com/v1/payments/search'
      + '?range=date_created&begin_date=' + start.toISOString()
      + '&end_date=' + end.toISOString()
      + '&status=approved&sort=date_created&criteria=desc&limit=50';
    const r = await fetch(searchUrl, { headers: { 'Authorization': 'Bearer ' + token } });
    if (!r.ok) {
      return new Response(JSON.stringify({ ok: false, erro: 'search HTTP ' + r.status }, null, 2),
        { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
    }
    const sj = await r.json().catch(() => ({}));
    const payments = sj.results || [];
    // só Sanova subscriptions (pra evitar processar outros vendas)
    const alvos = payments.filter(p =>
      (p.description || '').toLowerCase().includes('sanova') &&
      p.transaction_amount > 0
    );
    for (const pay of alvos) {
      const item = {
        payment_id: pay.id,
        payer_email: pay.payer && pay.payer.email,
        transaction_amount: pay.transaction_amount,
        date_approved: pay.date_approved,
      };
      try {
        // pega payment full (search nao traz point_of_interaction)
        const rf = await fetch('https://api.mercadopago.com/v1/payments/' + pay.id, {
          headers: { 'Authorization': 'Bearer ' + token },
        });
        const pf = await rf.json().catch(() => ({}));
        const tdata = pf.point_of_interaction && pf.point_of_interaction.transaction_data;
        const realSubId = tdata && tdata.subscription_id;
        item.subscription_id_real = realSubId;
        if (!realSubId) { item.nota = 'sem subscription_id no payment'; log.push(item); continue; }
        // busca preapproval real (ela TEM external_reference)
        const pa = await getPreapproval(realSubId, env);
        item.preapproval_status = pa.status;
        item.external_reference = pa.external_reference;
        const userId = await _resolveUserId(pa, env);
        if (!userId) { item.nota = 'user_id nao encontrado via external_reference'; log.push(item); continue; }
        await updateSubscriptionByUser(userId, {
          status: 'active',
          mp_preapproval_id: realSubId,
          subscription_started_at: pay.date_approved || pa.date_created || new Date().toISOString(),
        }, env);
        item.atualizado = 'active';
        item.user_id_curto = userId.slice(0, 8) + '...';
        log.push(item);
      } catch (err) {
        item.erro = String(err.message || err);
        log.push(item);
      }
    }
    return new Response(JSON.stringify({ ok: true, total_payments_sanova: alvos.length, log }, null, 2),
      { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err.message || err), parcial: log }, null, 2),
      { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  }
}

// ─── /api/admin-debug-cogo-payment (v1.16.0) ─────────────────
// Pega payment 162849895214 (esposa do Bruno) com TODOS os campos.
// Hardcoded — usado pra encontrar campo que liga payment a preapproval.
async function handleAdminDebugCogoPayment(env) {
  const token = env.MP_ACCESS_TOKEN_SANDBOX || env.MP_ACCESS_TOKEN;
  if (!token) {
    return new Response(JSON.stringify({ ok: false, error: 'MP_ACCESS_TOKEN ausente' }, null, 2),
      { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  }
  try {
    const r = await fetch('https://api.mercadopago.com/v1/payments/162849895214', {
      headers: { 'Authorization': 'Bearer ' + token },
    });
    const txt = await r.text();
    let raw;
    try { raw = JSON.parse(txt); } catch { raw = txt; }
    return new Response(JSON.stringify({ ok: r.ok, http: r.status, raw }, null, 2),
      { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err.message || err) }, null, 2),
      { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  }
}

// ─── /api/admin-list-recent-payments (v1.15.0) ───────────────
// Lista todos os payments da conta MP nos ultimos 7 dias.
// Diagnostico cego pra entender o que MP de fato registrou.
async function handleAdminListRecentPayments(env) {
  const token = env.MP_ACCESS_TOKEN_SANDBOX || env.MP_ACCESS_TOKEN;
  if (!token) {
    return new Response(JSON.stringify({ ok: false, error: 'MP_ACCESS_TOKEN ausente' }, null, 2),
      { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  }
  try {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 7);
    const url = 'https://api.mercadopago.com/v1/payments/search'
      + '?range=date_created'
      + '&begin_date=' + start.toISOString()
      + '&end_date=' + end.toISOString()
      + '&sort=date_created'
      + '&criteria=desc'
      + '&limit=20';
    const r = await fetch(url, { headers: { 'Authorization': 'Bearer ' + token } });
    if (!r.ok) {
      const txt = await r.text();
      return new Response(JSON.stringify({ ok: false, http: r.status, body: txt.slice(0, 500) }, null, 2),
        { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
    }
    const j = await r.json().catch(() => ({}));
    const resumo = (j.results || []).map(p => ({
      id: p.id,
      status: p.status,
      status_detail: p.status_detail,
      transaction_amount: p.transaction_amount,
      description: p.description,
      external_reference: p.external_reference,
      preapproval_id: p.preapproval_id,
      payer_email: p.payer && p.payer.email,
      date_created: p.date_created,
      date_approved: p.date_approved,
    }));
    return new Response(JSON.stringify({ ok: true, paging: j.paging, total: resumo.length, payments: resumo }, null, 2),
      { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err.message || err) }, null, 2),
      { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  }
}

// ─── /api/admin-reconcile-via-preapproval-id (v1.14.0) ───────
// Pra cada subscription com mp_preapproval_id pending no Supabase,
// busca payments via /v1/payments/search?preapproval_id=X. Se algum
// 'approved', marca subscription active. Resolve o caso real:
// MP não copia external_reference do plano pro payment individual.
async function handleAdminReconcileViaPreapprovalId(env) {
  const token = env.MP_ACCESS_TOKEN_SANDBOX || env.MP_ACCESS_TOKEN;
  if (!token) {
    return new Response(JSON.stringify({ ok: false, error: 'MP_ACCESS_TOKEN ausente' }, null, 2),
      { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  }
  const log = [];
  try {
    const subs = await listRecentSubscriptions(20, env);
    const alvos = (subs.subscriptions || []).filter(s =>
      s.mp_preapproval_id &&
      !s.mp_preapproval_id.startsWith('admin-simulated-') &&
      s.status !== 'active'
    );
    for (const s of alvos) {
      try {
        // busca payments associados a essa preapproval
        const r = await fetch('https://api.mercadopago.com/v1/payments/search?preapproval_id=' + encodeURIComponent(s.mp_preapproval_id), {
          headers: { 'Authorization': 'Bearer ' + token },
        });
        if (!r.ok) {
          log.push({ email: s.email, mp_preapproval_id: s.mp_preapproval_id, ok: false, erro: 'HTTP ' + r.status });
          continue;
        }
        const pj = await r.json().catch(() => ({}));
        const payments = pj.results || [];
        const approved = payments.find(p => p.status === 'approved');
        const item = {
          email: s.email,
          mp_preapproval_id: s.mp_preapproval_id,
          total_payments: payments.length,
          payments_resumo: payments.map(p => ({ id: p.id, status: p.status, amount: p.transaction_amount, date_approved: p.date_approved })),
        };
        if (approved) {
          // pega user_id via external_reference da preapproval
          const pa = await getPreapproval(s.mp_preapproval_id, env);
          const userId = await _resolveUserId(pa, env);
          const update = {
            status: 'active',
            mp_preapproval_id: s.mp_preapproval_id,
            subscription_started_at: approved.date_approved || pa.date_created || new Date().toISOString(),
          };
          if (userId) {
            await updateSubscriptionByUser(userId, update, env);
          } else {
            await updateSubscriptionByPreapproval(s.mp_preapproval_id, update, env);
          }
          item.atualizado = 'active';
          item.payment_aprovado_id = approved.id;
        } else {
          item.atualizado = false;
          item.nota = 'Nenhum payment approved encontrado';
        }
        log.push(item);
      } catch (err) {
        log.push({ email: s.email, mp_preapproval_id: s.mp_preapproval_id, erro: String(err.message || err) });
      }
    }
    return new Response(JSON.stringify({ ok: true, total: alvos.length, log }, null, 2),
      { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err.message || err), parcial: log }, null, 2),
      { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  }
}

// ─── /api/admin-debug-mp-state (v1.13.0) ─────────────────────
// Retorna preapprovals raw + payments associados (search por
// external_reference) pra debug profundo. Pra entender estado real
// no MP quando webhook nao trouxe paciente pra active.
async function handleAdminDebugMpState(env) {
  const token = env.MP_ACCESS_TOKEN_SANDBOX || env.MP_ACCESS_TOKEN;
  if (!token) {
    return new Response(JSON.stringify({ ok: false, error: 'MP_ACCESS_TOKEN ausente' }, null, 2),
      { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  }
  const out = [];
  try {
    const subs = await listRecentSubscriptions(20, env);
    const alvos = (subs.subscriptions || []).filter(s =>
      s.mp_preapproval_id && !s.mp_preapproval_id.startsWith('admin-simulated-')
    );
    for (const s of alvos) {
      const item = { email: s.email, supabase_status: s.status, mp_preapproval_id: s.mp_preapproval_id };
      try {
        const pa = await getPreapproval(s.mp_preapproval_id, env);
        item.preapproval_raw = {
          id: pa.id,
          status: pa.status,
          payer_id: pa.payer_id,
          payer_email: pa.payer_email,
          external_reference: pa.external_reference,
          preapproval_plan_id: pa.preapproval_plan_id,
          date_created: pa.date_created,
          last_modified: pa.last_modified,
          next_payment_date: pa.next_payment_date,
          summarized: pa.summarized,
          auto_recurring: pa.auto_recurring,
        };
      } catch (e) { item.preapproval_erro = String(e.message || e); }
      // busca payments por external_reference
      try {
        const userIdSeg = await _resolveUserId({ external_reference: s.mp_preapproval_id && (item.preapproval_raw && item.preapproval_raw.external_reference) }, env);
        const extRef = (item.preapproval_raw && item.preapproval_raw.external_reference) || ('sanova_' + (userIdSeg || ''));
        const r = await fetch('https://api.mercadopago.com/v1/payments/search?external_reference=' + encodeURIComponent(extRef), {
          headers: { 'Authorization': 'Bearer ' + token },
        });
        if (r.ok) {
          const pj = await r.json().catch(() => ({}));
          item.payments = (pj.results || []).map(p => ({
            id: p.id, status: p.status, status_detail: p.status_detail,
            transaction_amount: p.transaction_amount, date_approved: p.date_approved,
            external_reference: p.external_reference, payer_email: p.payer && p.payer.email,
          }));
        } else { item.payments_erro = 'HTTP ' + r.status; }
      } catch (e) { item.payments_erro = String(e.message || e); }
      out.push(item);
    }
    return new Response(JSON.stringify({ ok: true, debug: out }, null, 2),
      { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err.message || err), parcial: out }, null, 2),
      { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  }
}

// ─── /api/admin-reconcile-subscriptions (v1.12.0) ────────────
// Pega as ultimas N subscriptions que tem mp_preapproval_id mas
// status nao-active. Consulta status real no MP e atualiza.
async function handleAdminReconcileSubscriptions(env) {
  const log = [];
  try {
    const result = await listRecentSubscriptions(20, env);
    if (!result.ok) {
      return new Response(JSON.stringify({ ok: false, error: result.error }, null, 2),
        { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
    }
    // só processa quem tem preapproval real (não admin-simulated) e status nao-active
    const alvos = result.subscriptions.filter(s =>
      s.mp_preapproval_id &&
      !s.mp_preapproval_id.startsWith('admin-simulated-') &&
      s.status !== 'active'
    );
    for (const s of alvos) {
      try {
        const pa = await getPreapproval(s.mp_preapproval_id, env);
        const novoStatus = pa.status === 'authorized' ? 'active'
                         : (pa.status === 'cancelled' || pa.status === 'paused') ? 'canceled'
                         : 'trial';
        const userId = await _resolveUserId(pa, env);
        const update = { status: novoStatus, mp_preapproval_id: pa.id };
        if (novoStatus === 'active') {
          update.subscription_started_at = pa.date_created || new Date().toISOString();
        }
        if (userId) {
          await updateSubscriptionByUser(userId, update, env);
        } else {
          await updateSubscriptionByPreapproval(pa.id, update, env);
        }
        log.push({
          email: s.email,
          mp_preapproval_id: s.mp_preapproval_id,
          mp_status: pa.status,
          status_anterior: s.status,
          status_novo: novoStatus,
          atualizado: true,
        });
      } catch (err) {
        log.push({
          email: s.email,
          mp_preapproval_id: s.mp_preapproval_id,
          atualizado: false,
          erro: String(err.message || err),
        });
      }
    }
    return new Response(
      JSON.stringify({ ok: true, total_processados: alvos.length, log }, null, 2),
      { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: String(err.message || err), log }, null, 2),
      { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
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
    // v1.22.0: só ativa se charged_quantity > 0 (cobrança real).
    // Cogo case: preapproval inicial fica pending mas paciente paga via
    // preapproval REAL diferente (criada pelo plano). Só ativamos quando
    // confirmamos cobrança efetiva.
    if (type === 'preapproval' || type === 'subscription_preapproval') {
      const pa = await getPreapproval(dataId, env);
      const charged = (pa.summarized && pa.summarized.charged_quantity) || 0;
      let status = null;
      let extraFields = { mp_preapproval_id: pa.id };

      if (pa.status === 'authorized' && charged > 0) {
        status = 'active';
        extraFields.subscription_started_at =
          (pa.summarized && pa.summarized.last_charged_date) ||
          pa.date_created ||
          new Date().toISOString();
      } else if (pa.status === 'cancelled' || pa.status === 'paused') {
        status = 'canceled';
        extraFields.subscription_ends_at = new Date().toISOString();
      }

      if (status) {
        const userId = await _resolveUserId(pa, env);
        if (userId) {
          await updateSubscriptionByUser(userId, { status, ...extraFields }, env);
        } else {
          await updateSubscriptionByPreapproval(pa.id, { status, ...extraFields }, env);
        }
      }
      return new Response(JSON.stringify({ ok: true, preapproval_status: pa.status, charged }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }

    // ── PAYMENT (cobranca recorrente confirmada) ──
    // v1.22.0: AUTO-RECONCILIACAO. Usa point_of_interaction.transaction_data.
    // subscription_id (ID REAL da preapproval) que vem no payment.
    // - MP nao copia external_reference do preapproval_plan pro payment.
    // - A preapproval REAL tem external_reference=sanova_<userId> (uniq).
    // Sem precisar de admin-cleanup-v2 manual: cada payment approved ativa
    // o paciente automaticamente em segundos.
    if (type === 'payment' || type === 'subscription_authorized_payment') {
      const pay = await getPayment(dataId, env);
      const tdata = pay.point_of_interaction && pay.point_of_interaction.transaction_data;
      const realSubId = (tdata && tdata.subscription_id) || pay.preapproval_id || null;
      let userId = null;
      let preapprovalReal = null;
      if (realSubId) {
        try {
          preapprovalReal = await getPreapproval(realSubId, env);
          userId = await _resolveUserId(preapprovalReal, env);
        } catch (e) {
          console.warn('[mp-webhook] getPreapproval real falhou:', e.message);
        }
      }
      // Fallback: external_reference direto no payment (caso raro)
      if (!userId && pay.external_reference && pay.external_reference.startsWith('sanova_')) {
        userId = pay.external_reference.replace(/^sanova_/, '');
      }

      if (pay.status === 'approved') {
        const update = {
          status: 'active',
          subscription_started_at: pay.date_approved || new Date().toISOString(),
        };
        if (realSubId) update.mp_preapproval_id = realSubId;
        if (userId) {
          await updateSubscriptionByUser(userId, update, env);
          console.log('[mp-webhook] AUTO-ATIVADO user=' + userId.slice(0, 8) + '... preapproval=' + realSubId);
        } else if (realSubId) {
          await updateSubscriptionByPreapproval(realSubId, update, env);
        }
      } else if (pay.status === 'refunded' || pay.status === 'charged_back') {
        if (userId) {
          await updateSubscriptionByUser(userId, { status: 'canceled' }, env);
        } else if (realSubId) {
          await updateSubscriptionByPreapproval(realSubId, { status: 'canceled' }, env);
        }
      }
      return new Response(JSON.stringify({
        ok: true,
        payment_status: pay.status,
        real_subscription_id: realSubId,
        user_atualizado: userId ? userId.slice(0, 8) + '...' : null,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
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

// ─── /api/debug-admin (v1.2.0) ───────────────────────────────
// Verifica estado da infra admin:
//   - Tabela public.admins existe?
//   - Quantos admins cadastrados?
//   - Bruno (brunoambrozim@hotmail.com) é admin?
//   - View admin_metrics_v1 acessível?
// Sem dados sensiveis. Usado pra confirmar que migracoes aplicaram.
async function handleDebugAdmin(env) {
  const BRUNO_EMAIL = 'brunoambrozim@hotmail.com';
  try {
    const adminsTable = await countRows('admins', env);
    const metricsView = await countRows('admin_metrics_v1', env);
    const brunoAdmin = await isEmailAdmin(BRUNO_EMAIL, env);

    return new Response(
      JSON.stringify(
        {
          ok: true,
          tabela_admins: {
            existe: adminsTable.exists,
            total_admins: adminsTable.count,
            hint: adminsTable.exists ? null : 'Migration 20260603000000 nao aplicou ainda.',
          },
          view_admin_metrics: {
            existe: metricsView.exists,
            hint: metricsView.exists ? null : 'View admin_metrics_v1 nao existe.',
          },
          bruno: {
            email: BRUNO_EMAIL,
            usuario_supabase_encontrado: brunoAdmin.found,
            user_id_curto: brunoAdmin.userId ? brunoAdmin.userId.slice(0, 8) + '...' : null,
            e_admin: brunoAdmin.isAdmin,
          },
          proximo_passo: brunoAdmin.isAdmin
            ? '✅ Tudo pronto. Acesse sanovaapp.github.io/sanova/admin/'
            : (adminsTable.exists
              ? '⚠️ Tabela admins existe mas Bruno nao foi inserido. Migration de seed 20260603120000 ainda nao aplicou.'
              : '⚠️ Tabela admins nao existe. Verifique Supabase GitHub Integration.'),
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

// ─── /api/admin-simulate-active e /api/admin-revert-trial (v1.3.0) ───
// Helpers pra Bruno (founder) testar pipeline sem checkout MP real.
// Atualiza a subscription do brunoambrozim@hotmail.com via service_role.
// Hardcoded — so funciona pra esse e-mail.
async function handleAdminSimulate(env, novoStatus) {
  const BRUNO_EMAIL = 'brunoambrozim@hotmail.com';
  try {
    const userId = await findUserByEmail(BRUNO_EMAIL, env);
    if (!userId) {
      return new Response(
        JSON.stringify({ ok: false, error: 'bruno_nao_encontrado' }, null, 2),
        { status: 404, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      );
    }

    // Monta patch conforme status alvo
    const now = new Date().toISOString();
    let patch;
    if (novoStatus === 'active') {
      // v1.4.1: setar subscription_ends_at 30d future. Antes ficava o valor
      // antigo do banco (no passado) e SanovaAssinatura interpretava como
      // expired, derrubando o teste do pipeline.
      const endsAt = new Date(Date.now() + 30 * 86400000).toISOString();
      patch = {
        status: 'active',
        subscription_started_at: now,
        subscription_ends_at: endsAt,
        mp_preapproval_id: 'admin-simulated-' + Date.now(),
      };
    } else {
      // Volta pra trial limpo: 14 dias a partir de agora
      const trialEnd = new Date(Date.now() + 14 * 86400000).toISOString();
      patch = {
        status: 'trial',
        trial_started_at: now,
        trial_ends_at: trialEnd,
        subscription_started_at: null,
        subscription_ends_at: null,
        mp_preapproval_id: null,
      };
    }

    const updated = await updateSubscriptionByUser(userId, patch, env);
    return new Response(
      JSON.stringify({
        ok: true,
        email: BRUNO_EMAIL,
        user_id_curto: userId.slice(0, 8) + '...',
        status_novo: novoStatus,
        linha: Array.isArray(updated) ? updated[0] : updated,
        proximo_passo: novoStatus === 'active'
          ? '✅ Subscription marcada como active. Abre o app no celular e confirma que mostra "Assinatura ativa".'
          : '✅ Subscription voltou pra trial (14 dias novos).',
      }, null, 2),
      { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: String(err.message || err) }, null, 2),
      { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }
}

// ─── /api/admin-magic-link-bruno (v1.4.0) ─────────────────────
// Gera magic link de login pro Bruno via Supabase admin API.
// Usado por Playwright/E2E pra logar sem precisar de senha.
// Hardcoded — so funciona pra brunoambrozim@hotmail.com.
async function handleAdminMagicLink(env) {
  try {
    const link = await generateMagicLink(
      'brunoambrozim@hotmail.com',
      'https://sanova.app.br/',
      env
    );
    return new Response(
      JSON.stringify({
        ok: true,
        action_link: link.properties?.action_link || link.action_link,
        verification_type: link.properties?.verification_type,
        email_otp: link.properties?.email_otp,
        hashed_token: link.properties?.hashed_token,
        redirect_to: link.properties?.redirect_to,
        nota: 'Link unico, valido ate 1h. Abrir em browser limpo (sem sessao).',
      }, null, 2),
      { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: String(err.message || err) }, null, 2),
      { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }
}

// ─── /api/admin-set-auth-urls (v1.7.0) ───────────────────────
// Configura Site URL + Allowed Redirect URLs do Supabase Auth.
// Sem isso, reset password / magic link / confirm email caem na
// raiz sanovaapp.github.io (404) em vez de /sanova/.
async function handleAdminSetAuthUrls(env) {
  const PROJECT_REF = 'yjycpcydqfuvojfzwfvy';
  const token = env.SUPABASE_MGMT_TOKEN;
  if (!token) {
    return new Response(
      JSON.stringify({ ok: false, error: 'SUPABASE_MGMT_TOKEN nao setado no env do worker' }, null, 2),
      { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }

  // v1.28.6 (Fable Turno 10.1): site_url primario eh sanova.app.br;
  // sanovaapp.github.io mantido na allow list durante a transicao do DNS.
  const body = {
    site_url: 'https://sanova.app.br/',
    uri_allow_list: [
      'https://sanova.app.br/',
      'https://sanova.app.br/*',
      'https://sanovaapp.github.io/sanova/',
      'https://sanovaapp.github.io/sanova/*',
      'https://sanovaapp.github.io/',
      'http://localhost:8080/',
      'http://localhost:8080/*',
      'http://localhost:5500/',
      'http://localhost:5500/*',
    ].join(','),
  };

  try {
    const resp = await fetch('https://api.supabase.com/v1/projects/' + PROJECT_REF + '/config/auth', {
      method: 'PATCH',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const txt = await resp.text();
    let parsed;
    try { parsed = JSON.parse(txt); } catch { parsed = txt; }

    return new Response(
      JSON.stringify({
        ok: resp.ok,
        http_status: resp.status,
        management_api_response: parsed,
        site_url_set: body.site_url,
        uri_allow_list_set: body.uri_allow_list,
        nota: resp.ok ? 'site_url + uri_allow_list aplicados. Proximo reset/magic link cai em /sanova/ corretamente.' : 'Falhou — veja management_api_response.',
      }, null, 2),
      { status: resp.ok ? 200 : 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: String(err.message || err) }, null, 2),
      { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }
}

// ─── /api/admin-set-email-templates (v1.6.0) ─────────────────
// Aplica subjects + bodies branded Sanova em todos templates de auth via
// Supabase Management API. Requer env.SUPABASE_MGMT_TOKEN (PAT criado em
// supabase.com/dashboard/account/tokens).
//
// Idempotente — pode chamar quantas vezes quiser; sobrescreve a config.
// Project ref hardcoded (yjycpcydqfuvojfzwfvy) — escopo Sanova.
async function handleAdminSetEmailTemplates(env) {
  const PROJECT_REF = 'yjycpcydqfuvojfzwfvy';
  const token = env.SUPABASE_MGMT_TOKEN;
  if (!token) {
    return new Response(
      JSON.stringify({ ok: false, error: 'SUPABASE_MGMT_TOKEN nao setado no env do worker' }, null, 2),
      { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }

  // Body base — verde Sanova (#1f7a3a), Arial, 🌿, footer marca.
  const wrap = (h2, p1, btnLabel, p2) =>
    '<h2 style="color:#1f7a3a;font-family:Arial,sans-serif">🌿 ' + h2 + '</h2>' +
    '<p style="font-family:Arial,sans-serif;font-size:15px;color:#222">' + p1 + '</p>' +
    '<p><a href="{{ .ConfirmationURL }}" style="background:#1f7a3a;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-family:Arial,sans-serif;font-weight:bold">' + btnLabel + '</a></p>' +
    (p2 ? '<p style="font-family:Arial,sans-serif;font-size:13px;color:#666;margin-top:24px">' + p2 + '</p>' : '') +
    '<p style="font-family:Arial,sans-serif;font-size:12px;color:#999;margin-top:32px">🌿 Sanova — acompanhamento clínico GLP-1</p>';

  const body = {
    mailer_subjects_recovery:        '🌿 Sanova — recuperar acesso à sua conta',
    mailer_subjects_magic_link:      '🌿 Sanova — seu link de acesso',
    mailer_subjects_confirmation:    '🌿 Sanova — confirme seu e-mail',
    mailer_subjects_email_change:    '🌿 Sanova — confirme seu novo e-mail',
    mailer_subjects_invite:          '🌿 Você foi convidado para o Sanova',
    mailer_subjects_reauthentication:'🌿 Sanova — código de verificação',

    mailer_templates_recovery_content:     wrap('Sanova', 'Recebemos um pedido para redefinir sua senha do Sanova. Toque no botão abaixo para escolher uma nova:', 'Redefinir senha', 'Se você não pediu isso, pode ignorar este e-mail. Sua conta segue segura.'),
    mailer_templates_magic_link_content:   wrap('Sanova', 'Toque para entrar sem senha. Este link é único e expira em 1 hora:', 'Entrar no Sanova', 'Se não foi você, ignore este e-mail.'),
    mailer_templates_confirmation_content: wrap('Bem-vindo ao Sanova', 'Falta um passo pra começar. Confirme seu e-mail tocando abaixo:', 'Confirmar e-mail', ''),
    mailer_templates_email_change_content: wrap('Sanova', 'Você pediu para trocar o e-mail da sua conta Sanova. Toque abaixo para confirmar o novo:', 'Confirmar novo e-mail', ''),
    mailer_templates_invite_content:       wrap('Sanova', 'Você foi convidado para usar o Sanova. Toque abaixo para criar sua conta:', 'Aceitar convite', ''),
  };

  try {
    const resp = await fetch('https://api.supabase.com/v1/projects/' + PROJECT_REF + '/config/auth', {
      method: 'PATCH',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const txt = await resp.text();
    let parsed;
    try { parsed = JSON.parse(txt); } catch { parsed = txt; }

    return new Response(
      JSON.stringify({
        ok: resp.ok,
        http_status: resp.status,
        management_api_response: parsed,
        applied_subjects: Object.keys(body).filter(k => k.startsWith('mailer_subjects_')).length,
        applied_bodies:   Object.keys(body).filter(k => k.startsWith('mailer_templates_')).length,
        nota: resp.ok ? 'Templates aplicados. Próximo email de auth (signup/reset/magic) ja sai branded Sanova.' : 'Falhou — veja management_api_response.',
      }, null, 2),
      { status: resp.ok ? 200 : 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: String(err.message || err) }, null, 2),
      { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }
}

// ─── /api/admin-seed-bruno-profile (v1.5.0) ──────────────────
// Insere/atualiza app_state do Bruno no Supabase via service_role
// com profile completo. E2E (apos sync) puxa esse estado e o app
// nao mostra anamnese.
// v1.27.0 (Fable prints v3): bootstrap completo da conta fixture@sanova.app.
// Numa chamada: cria user (se nao existe), seeda fixture realista,
// marca subscription active, gera magic link. Workflow chama 1x e navega.
//
// Por que conta separada: simulate-active/revert-trial no usuario do Bruno
// fazem a assinatura real dele oscilar entre estados durante runs.
//
// v1.28.0 (Fable seguranca): senha NUNCA em texto. Gerada inline (UUID
// descartavel) — magic link nao precisa dela. Se user ja existe, faz
// PATCH com nova UUID a cada call, invalidando a senha antiga (que
// estava em texto cru em commits anteriores). Regra cravada no HANDOFF.
const FIXTURE_EMAIL = 'fixture@sanova.app';

async function handleAdminFixtureBootstrap(env, modo) {
  modo = modo || 'completa';
  try {
    // Senha descartavel: UUID gerado AGORA, usado 1x na chamada admin,
    // nunca exposto na response. Magic link funciona sem precisar dela.
    const senhaDescartavel = crypto.randomUUID();

    let userId = await findUserByEmail(FIXTURE_EMAIL, env);
    if (!userId) {
      const createResp = await fetch(
        'https://yjycpcydqfuvojfzwfvy.supabase.co/auth/v1/admin/users',
        {
          method: 'POST',
          headers: {
            'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: FIXTURE_EMAIL,
            password: senhaDescartavel,
            email_confirm: true,
            user_metadata: { kind: 'fixture-prints', created_by: 'admin-fixture-bootstrap' },
          }),
        }
      );
      const created = await createResp.json().catch(() => ({}));
      if (!createResp.ok) {
        return new Response(
          JSON.stringify({ ok: false, stage: 'create_user', detail: created }, null, 2),
          { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
        );
      }
      userId = created.id;
    } else {
      // User existente: ROTACIONA a senha a cada call. Invalida senhas
      // antigas que possam ter vazado em commits/sessoes anteriores.
      try {
        await fetch(
          'https://yjycpcydqfuvojfzwfvy.supabase.co/auth/v1/admin/users/' + userId,
          {
            method: 'PUT',
            headers: {
              'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
              'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ password: senhaDescartavel }),
          }
        );
      } catch (e) {
        // Rotacao falhou nao bloqueia o seed. Loga e segue.
        console.warn('[fixture-bootstrap] rotacao de senha falhou:', e.message);
      }
    }

    const hoje = new Date();
    const dStr = (d) => d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
    const minusDias = (n) => { const x = new Date(hoje); x.setDate(x.getDate() - n); return x; };

    // v1.28.3 (Fable Turno 5 #1): modo 'incompleta' cria 3 dias parciais
    // (apenas hoje + ontem + anteontem, sem refeicoes em 2 deles) pra
    // exercitar o gate do balanco que nunca dispara com 7d completos.
    const incompleta = (modo === 'incompleta');
    const fixtureMarker = incompleta ? 'incompleta-v1' : 'completa-v1';

    const weights = [];
    if (incompleta) {
      // Só 2 pesagens: hoje e há 3 dias. Gate de MA7 não dispara.
      weights.push({ date: dStr(minusDias(3)), weight: 92.3 });
      weights.push({ date: dStr(minusDias(0)), weight: 92.1 });
    } else {
      for (let i = 6; i >= 0; i--) weights.push({ date: dStr(minusDias(i)), weight: 92.0 + (i * 0.1) });
    }

    // v1.28.2 (Fable Turno 5 P0 #5): o seed escrevia refeicoes[].proteina por item mas
    // NAO escrevia os agregados dh.proteinG / dh.kcalConsumed / dh.kcalFromProt que o
    // app usa pra renderizar os Pilares de hoje. Resultado: lista mostrava "3 refeicoes
    // 1720 kcal" mas Pilares ficavam 0% prot, 0% kcal. Agora seed escreve os agregados.
    const daily = [];
    if (incompleta) {
      // 3 dias parciais: HOJE com 1 refeição leve; ONTEM zero refeições, só água;
      // ANTEONTEM 2 refeições mas sem proteína registrada. Estado realista de
      // paciente que esqueceu de logar — exercita gates de "dados insuficientes".
      const refsHoje = [{ kcal: 480, proteina: 28, kcalFonte: 'estimado' }];
      daily.push({
        date: dStr(minusDias(0)),
        refeicoes: refsHoje,
        proteinG: 28, kcalConsumed: 480, kcalFromPhoto: 480, kcalFromProt: 0,
        waterMl: 1200,
        sintomas: [],
      });
      daily.push({
        date: dStr(minusDias(1)),
        refeicoes: [],
        proteinG: 0, kcalConsumed: 0, kcalFromPhoto: 0, kcalFromProt: 0,
        waterMl: 800,
        sintomas: [],
      });
      const refsAnt = [
        { kcal: 620, proteina: 0, kcalFonte: 'estimado' },
        { kcal: 540, proteina: 0, kcalFonte: 'estimado' },
      ];
      daily.push({
        date: dStr(minusDias(2)),
        refeicoes: refsAnt,
        proteinG: 0, kcalConsumed: 1160, kcalFromPhoto: 1160, kcalFromProt: 0,
        waterMl: 1500,
        sintomas: [],
      });
    } else {
      for (let i = 6; i >= 0; i--) {
        const refeicoes = [
          { kcal: 520, proteina: 42, kcalFonte: 'estimado' },
          { kcal: 720, proteina: 58, kcalFonte: 'estimado' },
          { kcal: 480, proteina: 32, kcalFonte: 'estimado' },
        ];
        const totKcal = refeicoes.reduce((s, r) => s + r.kcal, 0);
        const totProt = refeicoes.reduce((s, r) => s + r.proteina, 0);
        daily.push({
          date: dStr(minusDias(i)),
          refeicoes,
          proteinG: totProt,
          kcalConsumed: totKcal,
          kcalFromPhoto: totKcal,
          kcalFromProt: 0,
          waterMl: 2200,
          sintomas: [],
        });
      }
    }

    const state = {
      profile: {
        name: 'Fixture (paciente teste)', sex: 'M', age: 40, heightCm: 178,
        weightKg: 92.6, weightStartKg: 114, weightGoalKg: 85,
        atividade: 'Moderada', activityLevel: 'Moderada',
        objetivo: 'reconstruir', exercicioResistido: true,
        startDate: '2025-12-01',
      },
      caneta: {
        tipo: 'frasco', farmaco: 'Tirzepatida', dose: '5', freq: 'semanal',
        concRotuloMg: 10, concRotuloMl: 1, volumeFrasco: 2,
        ultima: dStr(minusDias(3)),
      },
      daily, weights,
      applications: [
        { date: dStr(minusDias(10)), dose: '5' },
        { date: dStr(minusDias(3)), dose: '5' },
      ],
      insights: [],
      ownedBy: userId,
      updatedAt: Date.now(),
      _meta: { schemaVersion: 31, seededByE2E: true, seededAt: new Date().toISOString(), fixture: fixtureMarker },
    };

    const seedResp = await fetch(
      'https://yjycpcydqfuvojfzwfvy.supabase.co/rest/v1/app_state?on_conflict=user_id',
      {
        method: 'POST',
        headers: {
          'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify({ user_id: userId, state }),
      }
    );
    const seedData = await seedResp.json().catch(() => ({}));
    if (!seedResp.ok) {
      return new Response(
        JSON.stringify({ ok: false, stage: 'seed_state', detail: seedData }, null, 2),
        { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      );
    }

    // v1.28.1: trial_ends_at NOT NULL — bootstrap precisa popular
    // mesmo virando active na sequencia.
    const subPatch = {
      user_id: userId,
      status: 'active',
      trial_started_at: new Date().toISOString(),
      trial_ends_at: new Date(Date.now() + 30 * 86400000).toISOString(),
      subscription_started_at: new Date().toISOString(),
      subscription_ends_at: new Date(Date.now() + 30 * 86400000).toISOString(),
      mp_preapproval_id: 'fixture-simulated-' + Date.now(),
    };
    const subResp = await fetch(
      'https://yjycpcydqfuvojfzwfvy.supabase.co/rest/v1/subscriptions?on_conflict=user_id',
      {
        method: 'POST',
        headers: {
          'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify(subPatch),
      }
    );
    const subData = await subResp.json().catch(() => ({}));

    // v1.28.8 (cutover passo 4): origin oficial do prints agora e' sanova.app.br
    // (Bruno confirmou HTTPS + Enforce funcionando).
    const link = await generateMagicLink(
      FIXTURE_EMAIL,
      'https://sanova.app.br/',
      env
    );

    return new Response(
      JSON.stringify({
        ok: true,
        email: FIXTURE_EMAIL,
        user_id_curto: userId.slice(0, 8) + '...',
        action_link: link.properties?.action_link || link.action_link,
        fixture: fixtureMarker,
        subscription: subResp.ok ? (Array.isArray(subData) ? subData[0] : subData) : { erro: subData },
        contadores: {
          dias_completos: daily.length,
          pesagens: weights.length,
          aplicacoes: state.applications.length,
        },
      }, null, 2),
      { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: String(err.message || err) }, null, 2),
      { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }
}

// v1.25.0 (Fable prints v2): seed completo, simulando paciente em uso ativo.
// - 7 dias daily com 3 refeicoes COM proteina (kcal+prot reais)
// - 7 pesagens descendentes (~93 -> 92 kg) pra calcMA7 ter dados
// - Aplicacao recente da caneta (3d atras)
// - updatedAt: Date.now() (ms) e ownedBy garantem que sync NAO sobrescreve.
//
// Fable apontou: prints v1 mostrava '0g protein, 0 check-ins, 0 dias usando'
// por race com aoLogar (sync puxava state vazio do Supabase e sobrescrevia
// seed local do Playwright). Solucao: seedar AQUI, antes do magic link, e o
// sync legitimo do client vai puxar essa fixture.

// ════════════════════════════════════════════════════════════════════
// v1.28.7 (Fable Turno 14) — admin-seed-demo (Mariana)
// ════════════════════════════════════════════════════════════════════
// Conta-demo "Mariana" pra gravacao dos 3 videos promocionais. 13 semanas
// de dados realistas, login via magic link no celular do Bruno. Idempotente
// (re-seed sobrescreve state e re-rota senha; user permanece).
//
// Mariana: 38 anos, 1,65m, Emagrecer, 96 -> 84,2 kg em 13 semanas.
// Titulacao Tirzepatida 2,5 -> 5 -> 7,5 mg. Aderencia ~88% proteina.
// Semana 8 amarela de proposito (viagem, prot 60%, treinos 0). Recupera 9.
// Marco -10kg na semana 11.
//
// Tambem cria pro-demo "Dra. Ana" (nutricionista) vinculada a Mariana +
// 2 pacientes-sombra (Joao verde, Carla vermelha) pro semaforo do pro.html
// ter vida nas gravacoes.
const DEMO_EMAIL = 'demo@sanova.app';
const DEMO_PRO_EMAIL = 'dra.ana.demo@sanova.app';
const DEMO_SOMBRA_JOAO_EMAIL = 'joao.demo@sanova.app';
const DEMO_SOMBRA_CARLA_EMAIL = 'carla.demo@sanova.app';

async function _criarOuEncontrarUser(email, env) {
  let userId = await findUserByEmail(email, env);
  if (userId) {
    // Rotaciona senha pra invalidar antigas
    const novaSenha = crypto.randomUUID();
    await fetch(
      'https://yjycpcydqfuvojfzwfvy.supabase.co/auth/v1/admin/users/' + userId,
      {
        method: 'PUT',
        headers: {
          'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password: novaSenha }),
      }
    ).catch(() => {});
    return userId;
  }
  const senha = crypto.randomUUID();
  const r = await fetch(
    'https://yjycpcydqfuvojfzwfvy.supabase.co/auth/v1/admin/users',
    {
      method: 'POST',
      headers: {
        'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password: senha, email_confirm: true }),
    }
  );
  const d = await r.json().catch(() => ({}));
  return d.id;
}

function _buildMarianaState(userId) {
  const hoje = new Date();
  const dStr = (d) => d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
  const minusDias = (n) => { const x = new Date(hoje); x.setDate(x.getDate() - n); return x; };

  const TOTAL_DIAS = 91; // 13 semanas
  // Curva de peso: 96 → 84,2 em 91 dias, ~0,9 kg/semana, oscilacao diaria +-0,3
  const pesos = [];
  const inicio = 96.0;
  const fim = 84.2;
  const ritmoDia = (inicio - fim) / TOTAL_DIAS;
  for (let i = TOTAL_DIAS; i >= 0; i -= 2) {  // pesa a cada 2 dias (4-5x/sem)
    const baseDia = i;
    const peso = inicio - ritmoDia * (TOTAL_DIAS - baseDia);
    // Oscilacao diaria (pseudo-determinista pra idempotencia)
    const osc = ((baseDia * 7919) % 100 - 50) / 100 * 0.6;
    pesos.push({ date: dStr(minusDias(baseDia)), weight: Math.round((peso + osc) * 10) / 10 });
  }

  // Daily: refeicoes com prot/kcal por item, aderencia ~88%
  const daily = [];
  const semanasTitulacao = (dia) => {
    const semana = Math.floor((TOTAL_DIAS - dia) / 7);
    if (semana < 4) return '2,5';
    if (semana < 8) return '5';
    return '7,5';
  };
  const ehSemana8Amarela = (dia) => {
    const semana = Math.floor((TOTAL_DIAS - dia) / 7);
    return semana === 7;  // semana 8 (idx 7) é viagem
  };
  for (let i = TOTAL_DIAS - 1; i >= 0; i--) {
    const dataStr = dStr(minusDias(i));
    const amarela = ehSemana8Amarela(i);
    let refeicoes, proteinG, kcalConsumed, waterMl, exercicio;
    if (amarela) {
      // Viagem: prot ~60%, treinos 0, agua menor
      refeicoes = [
        { kcal: 580, proteina: 28, kcalFonte: 'estimado' },
        { kcal: 720, proteina: 34, kcalFonte: 'estimado' },
      ];
      proteinG = 62; kcalConsumed = 1300; waterMl = 1400;
      exercicio = 'nao';
    } else {
      // Normal: 3 refeicoes, ~105g prot, 4-5 treinos/sem
      const aderencia = (i * 13) % 100 < 88;
      const protMul = aderencia ? 1.0 : 0.65;
      refeicoes = [
        { kcal: 480, proteina: Math.round(38 * protMul), kcalFonte: 'estimado' },
        { kcal: 620, proteina: Math.round(42 * protMul), kcalFonte: 'estimado' },
        { kcal: 460, proteina: Math.round(28 * protMul), kcalFonte: 'estimado' },
      ];
      proteinG = refeicoes.reduce((s, r) => s + r.proteina, 0);
      kcalConsumed = refeicoes.reduce((s, r) => s + r.kcal, 0);
      waterMl = 2000 + ((i * 31) % 400);  // ~85% da meta (~2400)
      // Treino resistido 2-3x/semana (dias 1, 3, 5 da semana)
      const diaSem = i % 7;
      exercicio = (diaSem === 1 || diaSem === 3 || diaSem === 5) ? 'musculacao' : 'nao';
    }
    // Sintomas: enjoo leve nas semanas 1-2 de cada titulacao
    const sem = Math.floor((TOTAL_DIAS - i) / 7);
    const sintomas = [];
    if (sem === 0 || sem === 1 || sem === 4 || sem === 5 || sem === 8 || sem === 9) {
      if ((i % 3) === 0) sintomas.push('enjoo_leve');
    }
    daily.push({
      date: dataStr,
      refeicoes,
      proteinG,
      kcalConsumed,
      kcalFromPhoto: kcalConsumed,
      kcalFromProt: 0,
      waterMl,
      exercicio,
      sintomas,
    });
  }

  // Aplicacoes: semanal, com 1 atraso de 1 dia na semana 7
  const applications = [];
  for (let sem = 0; sem < 13; sem++) {
    const diasAtras = TOTAL_DIAS - 1 - sem * 7;
    const atraso = (sem === 6) ? 1 : 0;  // semana 7 (idx 6): 1 dia atraso
    const dose = sem < 4 ? '2.5' : sem < 8 ? '5' : '7.5';
    applications.push({ date: dStr(minusDias(diasAtras - atraso)), dose });
  }

  return {
    profile: {
      name: 'Mariana',
      sex: 'F', age: 38, heightCm: 165,
      weightKg: pesos[pesos.length - 1].weight,
      weightStartKg: 96.0,
      weightGoalKg: 78.0,
      atividade: 'Moderada', activityLevel: 'Moderada',
      objetivo: 'emagrecer', exercicioResistido: true,
      startDate: dStr(minusDias(TOTAL_DIAS)),
    },
    caneta: {
      tipo: 'caneta_unica', farmaco: 'Tirzepatida', dose: semanasTitulacao(0),
      freq: 'semanal', concRotuloMg: 5, concRotuloMl: 0.5, volumeFrasco: 0.5,
      ultima: applications[applications.length - 1].date,
    },
    daily, weights: pesos,
    applications,
    insights: [],
    // Marco -10kg na semana 11 (atingido)
    marcos: [
      { tipo: 'peso_perdido', valor: 10, atingidoEm: dStr(minusDias(TOTAL_DIAS - 77)) },
    ],
    ownedBy: userId,
    updatedAt: Date.now(),
    _meta: {
      schemaVersion: 31,
      seededByE2E: true,
      seededAt: new Date().toISOString(),
      fixture: 'demo-mariana-v1',
    },
  };
}

function _buildSombraJoaoState(userId) {
  // Joao: verde, paciente exemplar (proteção alta, peso descendo)
  const hoje = new Date();
  const dStr = (d) => d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
  const minusDias = (n) => { const x = new Date(hoje); x.setDate(x.getDate() - n); return x; };

  const daily = [];
  for (let i = 13; i >= 0; i--) {
    daily.push({
      date: dStr(minusDias(i)),
      refeicoes: [
        { kcal: 640, proteina: 48, kcalFonte: 'estimado' },
        { kcal: 820, proteina: 54, kcalFonte: 'estimado' },
        { kcal: 660, proteina: 40, kcalFonte: 'estimado' },
      ],
      proteinG: 142, kcalConsumed: 2120, kcalFromPhoto: 2120, kcalFromProt: 0,
      waterMl: 2800,
      exercicio: (i % 7 === 1 || i % 7 === 3 || i % 7 === 5) ? 'musculacao' : 'nao',
      sintomas: [],
    });
  }
  const weights = [];
  for (let i = 13; i >= 0; i--) weights.push({ date: dStr(minusDias(i)), weight: 92.0 - (13 - i) * 0.15 });

  return {
    profile: {
      name: 'João',
      sex: 'M', age: 45, heightCm: 178,
      weightKg: weights[weights.length - 1].weight,
      weightStartKg: 105, weightGoalKg: 82,
      activityLevel: 'Moderada', objetivo: 'emagrecer', exercicioResistido: true,
      startDate: dStr(minusDias(180)),
    },
    caneta: { farmaco: 'Tirzepatida', dose: '7.5', freq: 'semanal', ultima: dStr(minusDias(2)) },
    daily, weights, applications: [{ date: dStr(minusDias(2)), dose: '7.5' }],
    insights: [], ownedBy: userId, updatedAt: Date.now(),
    _meta: { schemaVersion: 31, fixture: 'demo-sombra-joao-v1' },
  };
}

function _buildSombraCarlaState(userId) {
  // Carla: vermelho, aderencia baixa (proteína 40%, peso parado)
  const hoje = new Date();
  const dStr = (d) => d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
  const minusDias = (n) => { const x = new Date(hoje); x.setDate(x.getDate() - n); return x; };

  const daily = [];
  for (let i = 13; i >= 0; i--) {
    daily.push({
      date: dStr(minusDias(i)),
      refeicoes: [
        { kcal: 400, proteina: 12, kcalFonte: 'estimado' },
        { kcal: 580, proteina: 18, kcalFonte: 'estimado' },
      ],
      proteinG: 30, kcalConsumed: 980, kcalFromPhoto: 980, kcalFromProt: 0,
      waterMl: 1200,
      exercicio: 'nao',
      sintomas: i < 4 ? ['enjoo_leve'] : [],
    });
  }
  const weights = [];
  for (let i = 13; i >= 0; i--) weights.push({ date: dStr(minusDias(i)), weight: 88.0 + ((i * 3) % 6) / 10 });

  return {
    profile: {
      name: 'Carla',
      sex: 'F', age: 52, heightCm: 162,
      weightKg: weights[weights.length - 1].weight,
      weightStartKg: 92, weightGoalKg: 75,
      activityLevel: 'Sedentário', objetivo: 'emagrecer', exercicioResistido: false,
      startDate: dStr(minusDias(60)),
    },
    caneta: { farmaco: 'Tirzepatida', dose: '5', freq: 'semanal', ultima: dStr(minusDias(5)) },
    daily, weights, applications: [{ date: dStr(minusDias(5)), dose: '5' }],
    insights: [], ownedBy: userId, updatedAt: Date.now(),
    _meta: { schemaVersion: 31, fixture: 'demo-sombra-carla-v1' },
  };
}

async function _upsertAppState(userId, state, env) {
  return fetch(
    'https://yjycpcydqfuvojfzwfvy.supabase.co/rest/v1/app_state?on_conflict=user_id',
    {
      method: 'POST',
      headers: {
        'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify({ user_id: userId, state }),
    }
  );
}

async function _ensureSubscriptionActive(userId, env) {
  const sub = {
    user_id: userId,
    status: 'active',
    trial_started_at: new Date().toISOString(),
    trial_ends_at: new Date(Date.now() + 365 * 86400000).toISOString(),
    subscription_started_at: new Date().toISOString(),
    subscription_ends_at: new Date(Date.now() + 365 * 86400000).toISOString(),
    mp_preapproval_id: 'demo-' + userId.slice(0, 8),
  };
  return fetch(
    'https://yjycpcydqfuvojfzwfvy.supabase.co/rest/v1/subscriptions?on_conflict=user_id',
    {
      method: 'POST',
      headers: {
        'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify(sub),
    }
  );
}

async function handleAdminSeedDemo(env) {
  try {
    // 1. Cria/encontra os 4 users
    const marianaId = await _criarOuEncontrarUser(DEMO_EMAIL, env);
    const proAnaId = await _criarOuEncontrarUser(DEMO_PRO_EMAIL, env);
    const joaoId = await _criarOuEncontrarUser(DEMO_SOMBRA_JOAO_EMAIL, env);
    const carlaId = await _criarOuEncontrarUser(DEMO_SOMBRA_CARLA_EMAIL, env);

    if (!marianaId || !proAnaId || !joaoId || !carlaId) {
      return new Response(
        JSON.stringify({ ok: false, error: 'falha_criar_users', ids: { marianaId, proAnaId, joaoId, carlaId } }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. App_state pra cada paciente
    await _upsertAppState(marianaId, _buildMarianaState(marianaId), env);
    await _upsertAppState(joaoId, _buildSombraJoaoState(joaoId), env);
    await _upsertAppState(carlaId, _buildSombraCarlaState(carlaId), env);

    // 3. Subscription ativa pra Mariana (camadas desbloqueadas)
    await _ensureSubscriptionActive(marianaId, env);
    await _ensureSubscriptionActive(joaoId, env);
    await _ensureSubscriptionActive(carlaId, env);

    // 4. Profissional Dra. Ana
    const proExistente = await fetch(
      'https://yjycpcydqfuvojfzwfvy.supabase.co/rest/v1/professionals?user_id=eq.' + encodeURIComponent(proAnaId) + '&select=id,invite_code',
      {
        headers: {
          'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY,
        },
      }
    );
    const proArr = await proExistente.json().catch(() => []);
    let proAnaProId;
    let inviteCode;
    if (Array.isArray(proArr) && proArr[0]) {
      proAnaProId = proArr[0].id;
      inviteCode = proArr[0].invite_code;
    } else {
      inviteCode = 'SAN-DEMO';
      // Verifica colisao do invite_code
      const colisao = await fetch(
        'https://yjycpcydqfuvojfzwfvy.supabase.co/rest/v1/professionals?invite_code=eq.' + inviteCode + '&select=id',
        { headers: { 'apikey': env.SUPABASE_SERVICE_ROLE_KEY, 'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY } }
      );
      const colArr = await colisao.json().catch(() => []);
      if (Array.isArray(colArr) && colArr[0]) {
        inviteCode = 'SAN-DEM2';
      }
      const ins = await fetch(
        'https://yjycpcydqfuvojfzwfvy.supabase.co/rest/v1/professionals',
        {
          method: 'POST',
          headers: {
            'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation',
          },
          body: JSON.stringify({
            user_id: proAnaId,
            nome: 'Dra. Ana Souza',
            tipo: 'nutricionista',
            registro: 'CRN-3 12345',
            titulo_exibido: 'Nutricionista clínica · CRN-3 12345',
            invite_code: inviteCode,
          }),
        }
      );
      const insArr = await ins.json().catch(() => []);
      proAnaProId = Array.isArray(insArr) && insArr[0] ? insArr[0].id : null;
    }

    // 5. Vincular Mariana + Joao + Carla a Dra. Ana
    if (proAnaProId) {
      for (const pacienteId of [marianaId, joaoId, carlaId]) {
        await fetch(
          'https://yjycpcydqfuvojfzwfvy.supabase.co/rest/v1/patient_links?on_conflict=professional_id,patient_user_id',
          {
            method: 'POST',
            headers: {
              'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
              'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY,
              'Content-Type': 'application/json',
              'Prefer': 'resolution=merge-duplicates',
            },
            body: JSON.stringify({
              professional_id: proAnaProId,
              patient_user_id: pacienteId,
              status: 'active',
              consent_version: 'v1-2026-06',
            }),
          }
        );
      }
    }

    // 6. Magic link da Mariana (pro Bruno logar no celular)
    const linkResp = await fetch(
      'https://yjycpcydqfuvojfzwfvy.supabase.co/auth/v1/admin/generate_link',
      {
        method: 'POST',
        headers: {
          'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'magiclink',
          email: DEMO_EMAIL,
          options: { redirect_to: 'https://sanova.app.br/' },
        }),
      }
    );
    const linkData = await linkResp.json().catch(() => ({}));

    // Magic link da Dra. Ana (pro Bruno logar no pro.html no celular)
    const linkProResp = await fetch(
      'https://yjycpcydqfuvojfzwfvy.supabase.co/auth/v1/admin/generate_link',
      {
        method: 'POST',
        headers: {
          'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'magiclink',
          email: DEMO_PRO_EMAIL,
          options: { redirect_to: 'https://sanova.app.br/pro.html' },
        }),
      }
    );
    const linkProData = await linkProResp.json().catch(() => ({}));

    return new Response(
      JSON.stringify({
        ok: true,
        demo: {
          mariana: {
            email: DEMO_EMAIL,
            user_id: marianaId,
            action_link: linkData.properties?.action_link || linkData.action_link,
            fixture: 'demo-mariana-v1',
          },
          dra_ana: {
            email: DEMO_PRO_EMAIL,
            pro_id: proAnaProId,
            invite_code: inviteCode,
            action_link: linkProData.properties?.action_link || linkProData.action_link,
          },
          sombras: { joao: joaoId, carla: carlaId },
        },
      }, null, 2),
      { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: 'seed_demo_failed', message: e.message, stack: e.stack }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function handleAdminSeedFixtureCompleta(env) {
  const BRUNO_EMAIL = 'brunoambrozim@hotmail.com';
  try {
    const userId = await findUserByEmail(BRUNO_EMAIL, env);
    if (!userId) {
      return new Response(
        JSON.stringify({ ok: false, error: 'bruno_nao_encontrado' }, null, 2),
        { status: 404, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      );
    }

    const hoje = new Date();
    const dStr = (d) => d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
    const minusDias = (n) => {
      const x = new Date(hoje);
      x.setDate(x.getDate() - n);
      return x;
    };

    // 7 pesagens descendentes: 92.6 -> 92.0
    const weights = [];
    for (let i = 6; i >= 0; i--) {
      const d = minusDias(i);
      weights.push({ date: dStr(d), weight: 92.0 + (i * 0.1) });
    }

    // 7 dias com 3 refeicoes cada (kcal + proteina REAIS).
    // Garante: kcal/dia >= 60% da meta_calorica (~2400 kcal estimada para Bruno)
    // E >= 2 refeicoes/dia → dias completos no gate da Fable.
    const daily = [];
    for (let i = 6; i >= 0; i--) {
      const d = minusDias(i);
      daily.push({
        date: dStr(d),
        refeicoes: [
          { kcal: 520, proteina: 42, kcalFonte: 'estimado' },  // cafe
          { kcal: 720, proteina: 58, kcalFonte: 'estimado' },  // almoco
          { kcal: 480, proteina: 32, kcalFonte: 'estimado' },  // jantar
        ],
        waterMl: 2200,
        sintomas: [],
      });
    }
    // Total/dia: 1720 kcal · 132g proteina

    const state = {
      profile: {
        name: 'Bruno', sex: 'M', age: 40, heightCm: 178,
        weightKg: 92.6, weightStartKg: 114, weightGoalKg: 85,
        atividade: 'Moderada', activityLevel: 'Moderada',
        objetivo: 'reconstruir', exercicioResistido: true,
        startDate: '2025-12-01',
      },
      caneta: {
        tipo: 'frasco', farmaco: 'Tirzepatida', dose: '5', freq: 'semanal',
        concRotuloMg: 10, concRotuloMl: 1, volumeFrasco: 2,
        ultima: dStr(minusDias(3)),
      },
      daily,
      weights,
      applications: [
        { date: dStr(minusDias(10)), dose: '5' },
        { date: dStr(minusDias(3)), dose: '5' },
      ],
      insights: [],
      ownedBy: userId,
      updatedAt: Date.now(),
      _meta: { schemaVersion: 31, seededByE2E: true, seededAt: new Date().toISOString(), fixture: 'completa-v1' },
    };

    const url = 'https://yjycpcydqfuvojfzwfvy.supabase.co/rest/v1/app_state?on_conflict=user_id';
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify({ user_id: userId, state }),
    });
    const data = await resp.json().catch(() => ({}));
    return new Response(
      JSON.stringify({
        ok: resp.ok,
        httpStatus: resp.status,
        email: BRUNO_EMAIL,
        user_id_curto: userId.slice(0, 8) + '...',
        fixture: 'completa-v1',
        contadores: {
          dias_completos: daily.length,
          refeicoes_total: daily.length * 3,
          pesagens: weights.length,
          aplicacoes: state.applications.length,
          kcal_por_dia: 520 + 720 + 480,
          prot_por_dia: 42 + 58 + 32,
        },
        supabase_resp: Array.isArray(data) ? data[0] : data,
      }, null, 2),
      { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: String(err.message || err) }, null, 2),
      { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }
}

async function handleAdminSeedProfile(env) {
  const BRUNO_EMAIL = 'brunoambrozim@hotmail.com';
  try {
    const userId = await findUserByEmail(BRUNO_EMAIL, env);
    if (!userId) {
      return new Response(
        JSON.stringify({ ok: false, error: 'bruno_nao_encontrado' }, null, 2),
        { status: 404, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      );
    }

    const state = {
      profile: {
        name: 'Bruno',
        sex: 'M',
        age: 40,
        heightCm: 178,
        weightKg: 92,
        weightStartKg: 114,
        weightGoalKg: 85,
        atividade: 'Moderada',
        activityLevel: 'Moderada',
        objetivo: 'reconstruir',
        exercicioResistido: true,
        startDate: '2025-12-01',
      },
      caneta: {
        tipo: 'frasco', farmaco: 'Tirzepatida', dose: '5', freq: 'semanal',
        concRotuloMg: 10, concRotuloMl: 1, volumeFrasco: 2,
        // 10mg/mL conc, dose 5mg → 50 UI · frasco de 2mL = 20mg cobre 4 doses
      },
      daily: [],
      weights: [],
      _meta: { schemaVersion: 31, seededByE2E: true, seededAt: new Date().toISOString() },
    };

    const url = 'https://yjycpcydqfuvojfzwfvy.supabase.co/rest/v1/app_state?on_conflict=user_id';
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify({ user_id: userId, state }),
    });
    const data = await resp.json().catch(() => ({}));
    return new Response(
      JSON.stringify({
        ok: resp.ok,
        httpStatus: resp.status,
        email: BRUNO_EMAIL,
        user_id_curto: userId.slice(0, 8) + '...',
        profile_seedado: state.profile,
        supabase_resp: Array.isArray(data) ? data[0] : data,
      }, null, 2),
      { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: String(err.message || err) }, null, 2),
      { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }
}
