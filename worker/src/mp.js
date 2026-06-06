/**
 * Mercado Pago — Preapproval (assinatura recorrente).
 *
 * Sandbox usa o mesmo endpoint da producao; o que muda e o ACCESS_TOKEN
 * (sandbox: "TEST-..." / producao: "APP_USR-...").
 *
 * Docs: https://www.mercadopago.com.br/developers/pt/reference/subscriptions/_preapproval/post
 */

const MP_API = 'https://api.mercadopago.com';

/**
 * Cria preapproval (assinatura recorrente) no Mercado Pago.
 *
 * @param {object} params
 * @param {string} params.userId        — UUID Supabase do paciente
 * @param {string} params.payerEmail    — e-mail do paciente
 * @param {string} params.backUrl       — URL pra onde MP redireciona apos confirmar
 * @param {object} env                  — env do Worker (acesso a MP_ACCESS_TOKEN_SANDBOX)
 * @returns {Promise<{init_point: string, id: string, status: string}>}
 */
export async function createPreapproval({ userId, payerEmail, backUrl, plano }, env) {
  const token = env.MP_ACCESS_TOKEN_SANDBOX || env.MP_ACCESS_TOKEN;
  if (!token) throw new Error('MP_ACCESS_TOKEN ausente no Worker');

  // v1.8.0: mensal R$19,90/mes vs anual R$199 a cada 12 meses
  const planoNormalizado = (plano === 'anual') ? 'anual' : 'mensal';
  const auto_recurring = planoNormalizado === 'anual'
    ? { frequency: 12, frequency_type: 'months', transaction_amount: 199.00, currency_id: 'BRL' }
    : { frequency: 1,  frequency_type: 'months', transaction_amount: 19.90,  currency_id: 'BRL' };
  const reason = planoNormalizado === 'anual'
    ? 'Sanova — assinatura anual'
    : 'Sanova — assinatura mensal';

  const body = {
    reason,
    external_reference: 'sanova_' + userId,
    payer_email: payerEmail,
    back_url: backUrl,
    status: 'pending',
    auto_recurring,
  };

  const resp = await fetch(MP_API + '/preapproval', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const msg = (data && data.message) ? data.message : ('HTTP ' + resp.status);
    throw new Error('MP createPreapproval: ' + msg);
  }
  return data; // { id, status, init_point, ... }
}

/**
 * Busca o estado atual de uma preapproval no MP.
 */
export async function getPreapproval(preapprovalId, env) {
  const token = env.MP_ACCESS_TOKEN_SANDBOX || env.MP_ACCESS_TOKEN;
  if (!token) throw new Error('MP_ACCESS_TOKEN ausente no Worker');

  const resp = await fetch(MP_API + '/preapproval/' + preapprovalId, {
    headers: { 'Authorization': 'Bearer ' + token },
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const msg = (data && data.message) ? data.message : ('HTTP ' + resp.status);
    throw new Error('MP getPreapproval: ' + msg);
  }
  return data;
}

/**
 * Cria um Test User (pagador fictício) no MP.
 * Usado pra teste sandbox — o pagador real do Bruno tava bloqueando
 * cartoes de teste.
 *
 * Docs: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/test/accounts
 */
export async function createTestUser(env, siteId = 'MLB') {
  const token = env.MP_ACCESS_TOKEN_SANDBOX || env.MP_ACCESS_TOKEN;
  if (!token) throw new Error('MP_ACCESS_TOKEN ausente no Worker');

  // v1.2.1: adicionado description + idempotency key — MP atualizou validacao
  // e estava retornando "invalid site_id" sem esses campos.
  const idempKey = 'sanova-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);

  const resp = await fetch(MP_API + '/users/test', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idempKey,
    },
    body: JSON.stringify({
      site_id: siteId,
      description: 'Sanova sandbox test user',
    }),
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const msg = (data && data.message) ? data.message : ('HTTP ' + resp.status);
    throw new Error('MP createTestUser: ' + msg);
  }
  return data;
}

/**
 * Busca um pagamento avulso no MP (usado quando webhook traz type=payment).
 */
export async function getPayment(paymentId, env) {
  const token = env.MP_ACCESS_TOKEN_SANDBOX || env.MP_ACCESS_TOKEN;
  if (!token) throw new Error('MP_ACCESS_TOKEN ausente no Worker');

  const resp = await fetch(MP_API + '/v1/payments/' + paymentId, {
    headers: { 'Authorization': 'Bearer ' + token },
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const msg = (data && data.message) ? data.message : ('HTTP ' + resp.status);
    throw new Error('MP getPayment: ' + msg);
  }
  return data;
}

/**
 * Valida a assinatura HMAC do webhook do Mercado Pago.
 *
 * Header: x-signature: ts=<unix>,v1=<hex>
 * Template a assinar: "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"
 * HMAC-SHA256 do template com MP_WEBHOOK_SECRET → comparar com v1
 *
 * Docs: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
 */
export async function verifyWebhookSignature(request, body, env) {
  const secret = env.MP_WEBHOOK_SECRET;
  if (!secret) return { ok: false, reason: 'missing_secret' };

  const sigHeader = request.headers.get('x-signature');
  const requestId = request.headers.get('x-request-id') || '';
  if (!sigHeader) return { ok: false, reason: 'missing_signature_header' };

  // x-signature vem como "ts=1700000000,v1=abc123..."
  const parts = sigHeader.split(',').reduce((acc, p) => {
    const [k, v] = p.split('=');
    if (k && v) acc[k.trim()] = v.trim();
    return acc;
  }, {});
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return { ok: false, reason: 'invalid_signature_format' };

  // data.id vem da query string ou do body
  const url = new URL(request.url);
  const dataId = url.searchParams.get('data.id')
    || url.searchParams.get('id')
    || (body && body.data && body.data.id)
    || (body && body.id)
    || '';

  const template = `id:${dataId};request-id:${requestId};ts:${ts};`;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(template));
  const computed = [...new Uint8Array(sig)]
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // Comparacao tempo-constante
  if (computed.length !== v1.length) return { ok: false, reason: 'mismatch' };
  let diff = 0;
  for (let i = 0; i < computed.length; i++) {
    diff |= computed.charCodeAt(i) ^ v1.charCodeAt(i);
  }
  return { ok: diff === 0, reason: diff === 0 ? 'valid' : 'mismatch' };
}

/**
 * v1.9.0: cria preapproval_plan publico no MP (mensal ou anual).
 * Retorna { id, init_point, ... } — id usado em /api/mp-create-preapproval
 * pra montar URL de checkout sem amarrar payer_email.
 *
 * Doc: https://www.mercadopago.com.br/developers/pt/reference/subscriptions/_preapproval_plan/post
 */
export async function createPreapprovalPlanMP({ tipo, backUrl }, env) {
  const token = env.MP_ACCESS_TOKEN_SANDBOX || env.MP_ACCESS_TOKEN;
  if (!token) throw new Error('MP_ACCESS_TOKEN ausente no Worker');

  const planoNormalizado = (tipo === 'anual') ? 'anual' : 'mensal';
  const auto_recurring = planoNormalizado === 'anual'
    ? { frequency: 12, frequency_type: 'months', transaction_amount: 199.00, currency_id: 'BRL' }
    : { frequency: 1,  frequency_type: 'months', transaction_amount: 19.90,  currency_id: 'BRL' };
  const reason = planoNormalizado === 'anual'
    ? 'Sanova — assinatura anual'
    : 'Sanova — assinatura mensal';

  const body = {
    reason,
    auto_recurring,
    back_url: backUrl,
    payment_methods_allowed: {
      payment_types: [{ id: 'credit_card' }],
      payment_methods: [],
    },
  };

  const resp = await fetch(MP_API + '/preapproval_plan', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const msg = (data && data.message) ? data.message : ('HTTP ' + resp.status);
    throw new Error('MP createPreapprovalPlan: ' + msg);
  }
  return data;
}

/**
 * v1.9.0: monta URL de checkout publico do preapproval_plan.
 * Paciente loga com QUALQUER conta MP — sem amarra de email.
 * external_reference vai como sanova_<userId> pra webhook reconciliar.
 */
export function buildCheckoutUrlForPlan({ planId, userId, backUrl }) {
  const params = new URLSearchParams({
    preapproval_plan_id: planId,
    external_reference: 'sanova_' + userId,
  });
  if (backUrl) params.set('back_url', backUrl);
  return 'https://www.mercadopago.com.br/subscriptions/checkout?' + params.toString();
}
