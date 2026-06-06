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
import { updateSubscriptionByUser, updateSubscriptionByPreapproval, findUserByEmail, countRows, isEmailAdmin, generateMagicLink } from './supabase.js';

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
        return jsonResponse({ ok: true, version: '1.6.0' }, 200, origin, env);
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

      // v1.3.0: helpers admin pra testar o pipeline sem precisar pagamento real.
      // Bruno (founder) e o unico autorizado — hardcoded.
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

      // v1.6.0: aplica templates de email branded Sanova via Supabase Management API.
      // Requer env.SUPABASE_MGMT_TOKEN (PAT do dashboard). Idempotente.
      if (url.pathname === '/api/admin-set-email-templates' && request.method === 'GET') {
        return await handleAdminSetEmailTemplates(env);
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
      'https://sanovaapp.github.io/sanova/',
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
