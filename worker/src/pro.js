/**
 * Sanova API — Painel Profissional (Fase 1)
 *
 * 6 rotas, todas via JWT Supabase:
 *   POST /api/pro-register         — cria pro (qualquer user logado)
 *   GET  /api/pro-me               — cadastro do pro logado          requirePro
 *   GET  /api/pro-patients         — lista resumida de vinculados    requirePro
 *   GET  /api/pro-patient?link_id  — detalhe de 1 paciente          requirePro
 *   POST /api/link-professional    — paciente vincula via invite     JWT paciente
 *   POST /api/unlink-professional  — paciente revoga                 JWT paciente
 *
 * Resumo importante de seguranca:
 *   · Resposta de pro-patients/patient NUNCA vaza app_state bruto.
 *     So resumos pre-computados pelo Worker.
 *   · pro-patient valida que o link pertence ao pro logado E esta active.
 *   · Escrita em professionals/patient_links/storage so via service_role
 *     daqui — nao depender de RLS pra autorizacao final.
 */

import { jsonResponse, isOriginAllowed } from './http.js';
import { CRITERIOS_PM, calcEstadoProtecaoMuscular, gerarInviteCode } from './clinical.js';

const SUPABASE_URL = 'https://yjycpcydqfuvojfzwfvy.supabase.co';

function svcHeaders(env) {
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY ausente');
  return {
    'apikey': key,
    'Authorization': 'Bearer ' + key,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  };
}

/**
 * Valida JWT do usuario (paciente OU pro) e retorna {id, email} ou null.
 */
async function verifyJwt(request, env) {
  const authz = request.headers.get('Authorization') || '';
  const m = authz.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const resp = await fetch(SUPABASE_URL + '/auth/v1/user', {
    headers: {
      'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': 'Bearer ' + m[1].trim(),
    },
  });
  if (!resp.ok) return null;
  const u = await resp.json().catch(() => null);
  return u && u.id ? u : null;
}

/**
 * Middleware: usuario logado E linha em public.professionals.
 * Retorna { user, pro } ou Response com 401/403.
 */
async function requirePro(request, env, origin) {
  const user = await verifyJwt(request, env);
  if (!user) {
    return { error: jsonResponse({ ok: false, error: 'auth_required' }, 401, origin, env) };
  }
  const proResp = await fetch(
    SUPABASE_URL + '/rest/v1/professionals?user_id=eq.' + encodeURIComponent(user.id) + '&select=*',
    { headers: svcHeaders(env) }
  );
  const arr = await proResp.json().catch(() => []);
  if (!Array.isArray(arr) || arr.length === 0) {
    return { error: jsonResponse({ ok: false, error: 'not_a_professional' }, 403, origin, env) };
  }
  return { user, pro: arr[0] };
}

// ════════════════════════════════════════════════════════════════════
// POST /api/pro-register
// ════════════════════════════════════════════════════════════════════
export async function handleProRegister(request, env, origin) {
  if (!isOriginAllowed(origin, env)) {
    return jsonResponse({ ok: false, error: 'origin_not_allowed' }, 403, origin, env);
  }
  const user = await verifyJwt(request, env);
  if (!user) return jsonResponse({ ok: false, error: 'auth_required' }, 401, origin, env);

  let body;
  try { body = await request.json(); } catch { body = {}; }
  const nome = (body.nome || '').trim();
  const tipo = (body.tipo || '').trim();
  const registro = (body.registro || '').trim() || null;
  const titulo_exibido = (body.titulo_exibido || '').trim() || null;

  if (!nome || nome.length < 2 || nome.length > 100) {
    return jsonResponse({ ok: false, error: 'nome_invalido' }, 400, origin, env);
  }
  if (!['medico', 'nutricionista', 'outro'].includes(tipo)) {
    return jsonResponse({ ok: false, error: 'tipo_invalido' }, 400, origin, env);
  }

  // Idempotencia: ja existe pro pra esse user?
  const exists = await fetch(
    SUPABASE_URL + '/rest/v1/professionals?user_id=eq.' + encodeURIComponent(user.id) + '&select=*',
    { headers: svcHeaders(env) }
  );
  const existing = await exists.json().catch(() => []);
  if (Array.isArray(existing) && existing.length > 0) {
    return jsonResponse({ ok: true, pro: existing[0], created: false }, 200, origin, env);
  }

  // Gera invite_code unico (até 5 tentativas)
  let invite_code = null;
  for (let i = 0; i < 5; i++) {
    const c = gerarInviteCode();
    const check = await fetch(
      SUPABASE_URL + '/rest/v1/professionals?invite_code=eq.' + encodeURIComponent(c) + '&select=id',
      { headers: svcHeaders(env) }
    );
    const dup = await check.json().catch(() => []);
    if (!Array.isArray(dup) || dup.length === 0) { invite_code = c; break; }
  }
  if (!invite_code) {
    return jsonResponse({ ok: false, error: 'invite_code_collision' }, 500, origin, env);
  }

  const row = { user_id: user.id, nome, tipo, registro, titulo_exibido, invite_code };
  const insert = await fetch(SUPABASE_URL + '/rest/v1/professionals', {
    method: 'POST',
    headers: svcHeaders(env),
    body: JSON.stringify(row),
  });
  const created = await insert.json().catch(() => null);
  if (!insert.ok) {
    return jsonResponse({ ok: false, error: 'insert_failed', detail: created }, 500, origin, env);
  }
  return jsonResponse(
    { ok: true, pro: Array.isArray(created) ? created[0] : created, created: true },
    200, origin, env
  );
}

// ════════════════════════════════════════════════════════════════════
// GET /api/pro-me
// ════════════════════════════════════════════════════════════════════
export async function handleProMe(request, env, origin) {
  if (!isOriginAllowed(origin, env)) {
    return jsonResponse({ ok: false, error: 'origin_not_allowed' }, 403, origin, env);
  }
  const ctx = await requirePro(request, env, origin);
  if (ctx.error) return ctx.error;
  return jsonResponse({ ok: true, pro: ctx.pro }, 200, origin, env);
}

// ════════════════════════════════════════════════════════════════════
// Helper: busca app_state + email pra um patient_user_id
// ════════════════════════════════════════════════════════════════════
async function _carregaPaciente(patient_user_id, env) {
  const stateUrl = SUPABASE_URL + '/rest/v1/app_state?user_id=eq.' +
    encodeURIComponent(patient_user_id) + '&select=*';
  const stResp = await fetch(stateUrl, { headers: svcHeaders(env) });
  const stArr = await stResp.json().catch(() => []);
  const state = (Array.isArray(stArr) && stArr[0]) ? stArr[0] : null;
  // O state JSONB vive em campo `state` (schema atual)
  const S = state && state.state ? state.state : null;

  // Email pra fallback de nome (a UI pode escolher)
  let email = null;
  try {
    const u = await fetch(SUPABASE_URL + '/auth/v1/admin/users/' + patient_user_id, {
      headers: svcHeaders(env),
    });
    if (u.ok) {
      const ud = await u.json().catch(() => null);
      email = ud && ud.email ? ud.email : null;
    }
  } catch {}

  return { S, email };
}

/**
 * Computa metricas necessarias pra calcEstadoProtecaoMuscular a partir do
 * estado S do paciente, considerando media de N dias.
 * Retorna { M, kcal, prot, sexo, prot_pct, kcal_pct, peso_delta, dias_sem_registro,
 *           ultima_dose_ha_dias, medicamento, nome }.
 */
function _resumoPaciente(S, dias) {
  const profile = (S && S.profile) || {};
  const sexo = profile.sex || 'F';
  // Metricas computadas: o monolito guarda em S.metas (snapshot da ultima geracao)
  // ou pode recomputar — pra Fase 1, usamos o snapshot.
  const M = (S && S.metas) ? S.metas : (S && S._meta) || {};

  const daily = (S && Array.isArray(S.daily)) ? S.daily : [];
  // Pega ultimos N dias com dado registrado
  const recentes = daily.slice(-dias);
  let kcalSoma = 0, protSoma = 0, n = 0;
  for (const d of recentes) {
    const k = Number(d.kcalConsumed || d.kcal || 0);
    const p = Number(d.protConsumed || d.prot || d.proteina || 0);
    if (k > 0 || p > 0) { kcalSoma += k; protSoma += p; n++; }
  }
  const kcalMedia = n > 0 ? Math.round(kcalSoma / n) : 0;
  const protMedia = n > 0 ? Math.round(protSoma / n) : 0;

  // Peso: delta 30d
  const weights = (S && Array.isArray(S.weights)) ? S.weights : [];
  const w30 = weights.slice(-30);
  let peso_delta_30d = null;
  if (w30.length >= 2) {
    peso_delta_30d = Number((w30[w30.length - 1].kg - w30[0].kg).toFixed(1));
  }

  // Aplicacoes (doses)
  const apps = (S && Array.isArray(S.applications)) ? S.applications : [];
  const ultima = apps.length > 0 ? apps[apps.length - 1] : null;
  let ultima_dose_ha_dias = null;
  if (ultima && ultima.date) {
    const dt = new Date(ultima.date);
    if (!isNaN(dt)) {
      ultima_dose_ha_dias = Math.floor((Date.now() - dt.getTime()) / (1000 * 60 * 60 * 24));
    }
  }

  // Dias sem registro: olha o ultimo daily com kcal ou prot
  let dias_sem_registro = 999;
  for (let i = daily.length - 1; i >= 0; i--) {
    const d = daily[i];
    if (Number(d.kcalConsumed || d.kcal || 0) > 0 || Number(d.protConsumed || d.prot || 0) > 0) {
      if (d.date) {
        const dt = new Date(d.date);
        if (!isNaN(dt)) {
          dias_sem_registro = Math.floor((Date.now() - dt.getTime()) / (1000 * 60 * 60 * 24));
        }
      }
      break;
    }
  }
  if (daily.length === 0) dias_sem_registro = null;

  return {
    nome: profile.name || profile.nome || null,
    sexo,
    M,
    kcal: kcalMedia,
    prot: protMedia,
    medicamento: (S && S.caneta && S.caneta.farmaco) || null,
    ultima_dose_ha_dias,
    dias_sem_registro,
    peso_delta_30d,
    prot_pct: M.pm ? Math.round((protMedia / M.pm) * 100) : 0,
    kcal_pct: M.meta ? Math.round((kcalMedia / M.meta) * 100) : 0,
  };
}

// ════════════════════════════════════════════════════════════════════
// GET /api/pro-patients
// ════════════════════════════════════════════════════════════════════
export async function handleProPatients(request, env, origin) {
  if (!isOriginAllowed(origin, env)) {
    return jsonResponse({ ok: false, error: 'origin_not_allowed' }, 403, origin, env);
  }
  const ctx = await requirePro(request, env, origin);
  if (ctx.error) return ctx.error;

  // Lista vinculos ativos do pro
  const linksUrl = SUPABASE_URL + '/rest/v1/patient_links' +
    '?professional_id=eq.' + encodeURIComponent(ctx.pro.id) +
    '&status=eq.active&select=*';
  const linksResp = await fetch(linksUrl, { headers: svcHeaders(env) });
  const links = await linksResp.json().catch(() => []);
  if (!Array.isArray(links)) {
    return jsonResponse({ ok: false, error: 'links_query_failed' }, 500, origin, env);
  }

  const pacientes = [];
  for (const link of links) {
    const { S, email } = await _carregaPaciente(link.patient_user_id, env);
    if (!S) {
      pacientes.push({
        link_id: link.id,
        nome: email || '—',
        estado_pm: 'aguardando',
        inativo: true,
        dias_sem_registro: null,
      });
      continue;
    }
    const r = _resumoPaciente(S, 7);
    const estado = calcEstadoProtecaoMuscular(r.M, r.kcal, r.prot, r.sexo, { periodo: 'semana' });
    pacientes.push({
      link_id: link.id,
      nome: r.nome || email || '—',
      estado_pm: estado.estado,
      medicamento: r.medicamento,
      ultima_dose_ha_dias: r.ultima_dose_ha_dias,
      dias_sem_registro: r.dias_sem_registro,
      peso_delta_30d: r.peso_delta_30d,
      prot_media_7d_pct: r.prot_pct,
      kcal_media_7d_pct: r.kcal_pct,
      inativo: r.dias_sem_registro !== null && r.dias_sem_registro >= 4,
    });
  }

  // Ordenacao: risco > atencao > aguardando > protegida
  const ordemEstado = { risco: 0, atencao: 1, aguardando: 2, protegida: 3 };
  pacientes.sort((a, b) => {
    const oa = ordemEstado[a.estado_pm] ?? 9;
    const ob = ordemEstado[b.estado_pm] ?? 9;
    if (oa !== ob) return oa - ob;
    return (b.dias_sem_registro || 0) - (a.dias_sem_registro || 0);
  });

  // Agregado pro header ("faixa-resumo")
  const total = pacientes.length;
  const protegidas = pacientes.filter(p => p.estado_pm === 'protegida').length;
  const atencao = pacientes.filter(p => p.estado_pm === 'atencao').length;
  const risco = pacientes.filter(p => p.estado_pm === 'risco').length;
  const aguardando = pacientes.filter(p => p.estado_pm === 'aguardando').length;

  return jsonResponse({
    ok: true,
    pro: { nome: ctx.pro.nome, invite_code: ctx.pro.invite_code },
    resumo: { total, protegidas, atencao, risco, aguardando },
    pacientes,
  }, 200, origin, env);
}

// ════════════════════════════════════════════════════════════════════
// GET /api/pro-patient?link_id=...
// ════════════════════════════════════════════════════════════════════
export async function handleProPatient(request, env, origin) {
  if (!isOriginAllowed(origin, env)) {
    return jsonResponse({ ok: false, error: 'origin_not_allowed' }, 403, origin, env);
  }
  const ctx = await requirePro(request, env, origin);
  if (ctx.error) return ctx.error;

  const url = new URL(request.url);
  const link_id = url.searchParams.get('link_id');
  if (!link_id) {
    return jsonResponse({ ok: false, error: 'missing_link_id' }, 400, origin, env);
  }

  // VERIFICACAO DUPLA: link existe, pertence ao pro logado, esta active.
  const linkUrl = SUPABASE_URL + '/rest/v1/patient_links?id=eq.' + encodeURIComponent(link_id) + '&select=*';
  const linkResp = await fetch(linkUrl, { headers: svcHeaders(env) });
  const arr = await linkResp.json().catch(() => []);
  const link = (Array.isArray(arr) && arr[0]) || null;
  if (!link) {
    return jsonResponse({ ok: false, error: 'link_not_found' }, 404, origin, env);
  }
  if (link.professional_id !== ctx.pro.id) {
    return jsonResponse({ ok: false, error: 'forbidden' }, 403, origin, env);
  }
  if (link.status !== 'active') {
    return jsonResponse({ ok: false, error: 'link_revoked' }, 403, origin, env);
  }

  const { S, email } = await _carregaPaciente(link.patient_user_id, env);
  if (!S) {
    return jsonResponse({
      ok: true, paciente: { nome: email, estado_pm: 'aguardando' },
      detalhe: null, consentido_em: link.consented_at,
    }, 200, origin, env);
  }

  const r7 = _resumoPaciente(S, 7);
  const r15 = _resumoPaciente(S, 15);
  const r30 = _resumoPaciente(S, 30);
  const e7 = calcEstadoProtecaoMuscular(r7.M, r7.kcal, r7.prot, r7.sexo, { periodo: 'semana' });
  const e15 = calcEstadoProtecaoMuscular(r15.M, r15.kcal, r15.prot, r15.sexo, { periodo: '15d' });
  const e30 = calcEstadoProtecaoMuscular(r30.M, r30.kcal, r30.prot, r30.sexo, { periodo: 'mes' });

  // Serie de peso (ate 90d) — exibida em grafico no painel
  const weights = (S && Array.isArray(S.weights)) ? S.weights.slice(-90) : [];
  const aplicacoes = (S && Array.isArray(S.applications)) ? S.applications.slice(-30) : [];

  return jsonResponse({
    ok: true,
    consentido_em: link.consented_at,
    paciente: {
      nome: r7.nome || email,
      medicamento: r7.medicamento,
      ultima_dose_ha_dias: r7.ultima_dose_ha_dias,
    },
    metricas: {
      '7d':  { kcal: r7.kcal,  prot: r7.prot,  kcal_pct: r7.kcal_pct,  prot_pct: r7.prot_pct,  estado: e7 },
      '15d': { kcal: r15.kcal, prot: r15.prot, kcal_pct: r15.kcal_pct, prot_pct: r15.prot_pct, estado: e15 },
      '30d': { kcal: r30.kcal, prot: r30.prot, kcal_pct: r30.kcal_pct, prot_pct: r30.prot_pct, estado: e30 },
    },
    peso: { serie: weights, delta_30d: r30.peso_delta_30d },
    aplicacoes,
  }, 200, origin, env);
}

// ════════════════════════════════════════════════════════════════════
// POST /api/link-professional   (paciente vincula)
// ════════════════════════════════════════════════════════════════════
export async function handleLinkProfessional(request, env, origin) {
  if (!isOriginAllowed(origin, env)) {
    return jsonResponse({ ok: false, error: 'origin_not_allowed' }, 403, origin, env);
  }
  const user = await verifyJwt(request, env);
  if (!user) return jsonResponse({ ok: false, error: 'auth_required' }, 401, origin, env);

  let body;
  try { body = await request.json(); } catch { body = {}; }
  const invite = (body.invite_code || '').trim().toUpperCase();
  const consent_version = (body.consent_version || '').trim();
  if (!/^SAN-[A-Z0-9]{4}$/.test(invite)) {
    return jsonResponse({ ok: false, error: 'invite_invalido' }, 400, origin, env);
  }
  if (!consent_version) {
    return jsonResponse({ ok: false, error: 'consent_required' }, 400, origin, env);
  }

  // Busca o pro
  const proResp = await fetch(
    SUPABASE_URL + '/rest/v1/professionals?invite_code=eq.' + encodeURIComponent(invite) + '&select=*',
    { headers: svcHeaders(env) }
  );
  const proArr = await proResp.json().catch(() => []);
  const pro = (Array.isArray(proArr) && proArr[0]) || null;
  if (!pro) {
    return jsonResponse({ ok: false, error: 'codigo_nao_encontrado' }, 404, origin, env);
  }

  // Upsert vinculo (re-ativa caso existisse revoked)
  const linkRow = {
    professional_id: pro.id,
    patient_user_id: user.id,
    status: 'active',
    consent_version,
    consented_at: new Date().toISOString(),
    revoked_at: null,
  };
  const ins = await fetch(
    SUPABASE_URL + '/rest/v1/patient_links?on_conflict=professional_id,patient_user_id',
    {
      method: 'POST',
      headers: {
        ...svcHeaders(env),
        'Prefer': 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify(linkRow),
    }
  );
  const created = await ins.json().catch(() => null);
  if (!ins.ok) {
    return jsonResponse({ ok: false, error: 'insert_failed', detail: created }, 500, origin, env);
  }
  return jsonResponse({
    ok: true,
    profissional: {
      nome: pro.nome,
      titulo_exibido: pro.titulo_exibido,
      foto_url: pro.foto_url,
      logo_url: pro.logo_url,
    },
    link: Array.isArray(created) ? created[0] : created,
  }, 200, origin, env);
}

// ════════════════════════════════════════════════════════════════════
// POST /api/pro-assets   (pro envia foto/logo)
//   Body: { kind: 'foto' | 'logo', data_base64: '...', content_type: 'image/jpeg' }
//   Limita pra 2MB depois de decode. Salva em bucket 'pro-assets' como
//   {pro_id}/{kind}.{ext}. Atualiza professionals.foto_url ou logo_url.
// ════════════════════════════════════════════════════════════════════
export async function handleProAssets(request, env, origin) {
  if (!isOriginAllowed(origin, env)) {
    return jsonResponse({ ok: false, error: 'origin_not_allowed' }, 403, origin, env);
  }
  const ctx = await requirePro(request, env, origin);
  if (ctx.error) return ctx.error;

  let body;
  try { body = await request.json(); } catch { body = {}; }
  const kind = body.kind === 'logo' ? 'logo' : 'foto';
  const contentType = body.content_type || 'image/jpeg';
  const dataB64 = (body.data_base64 || '').replace(/^data:[^;]+;base64,/, '');
  if (!dataB64) return jsonResponse({ ok: false, error: 'no_data' }, 400, origin, env);
  if (!/^image\/(jpeg|png|webp)$/.test(contentType)) {
    return jsonResponse({ ok: false, error: 'tipo_nao_suportado', detail: 'jpeg/png/webp' }, 400, origin, env);
  }

  // Decode + limite 2MB
  let bytes;
  try {
    const bin = atob(dataB64);
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  } catch {
    return jsonResponse({ ok: false, error: 'base64_invalido' }, 400, origin, env);
  }
  if (bytes.length > 2 * 1024 * 1024) {
    return jsonResponse({ ok: false, error: 'arquivo_grande', detail: 'max 2MB' }, 400, origin, env);
  }

  const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
  const objectPath = ctx.pro.id + '/' + kind + '.' + ext;

  // Upload via Storage API (service_role). upsert=true sobrescreve.
  const upUrl = SUPABASE_URL + '/storage/v1/object/pro-assets/' + objectPath;
  const upResp = await fetch(upUrl, {
    method: 'POST',
    headers: {
      'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY,
      'Content-Type': contentType,
      'x-upsert': 'true',
      'cache-control': 'public, max-age=3600',
    },
    body: bytes,
  });
  if (!upResp.ok) {
    const t = await upResp.text().catch(() => '');
    return jsonResponse({ ok: false, error: 'upload_failed', status: upResp.status, detail: t.slice(0, 200) }, 500, origin, env);
  }

  // URL pública (bucket é public)
  const publicUrl = SUPABASE_URL + '/storage/v1/object/public/pro-assets/' + objectPath + '?v=' + Date.now();
  const patch = {};
  patch[kind + '_url'] = publicUrl;
  const patchResp = await fetch(SUPABASE_URL + '/rest/v1/professionals?id=eq.' + encodeURIComponent(ctx.pro.id), {
    method: 'PATCH',
    headers: svcHeaders(env),
    body: JSON.stringify(patch),
  });
  if (!patchResp.ok) {
    return jsonResponse({ ok: false, error: 'patch_failed' }, 500, origin, env);
  }

  return jsonResponse({ ok: true, kind, url: publicUrl }, 200, origin, env);
}

// ════════════════════════════════════════════════════════════════════
// GET /api/my-professionals   (paciente lista pros vinculados ativos)
// ════════════════════════════════════════════════════════════════════
export async function handleMyProfessionals(request, env, origin) {
  if (!isOriginAllowed(origin, env)) {
    return jsonResponse({ ok: false, error: 'origin_not_allowed' }, 403, origin, env);
  }
  const user = await verifyJwt(request, env);
  if (!user) return jsonResponse({ ok: false, error: 'auth_required' }, 401, origin, env);

  // Join via 2 queries (RLS bloqueia paciente de ler professionals direto)
  const linksUrl = SUPABASE_URL + '/rest/v1/patient_links?patient_user_id=eq.' +
    encodeURIComponent(user.id) + '&status=eq.active&select=id,professional_id,consented_at,consent_version';
  const linksResp = await fetch(linksUrl, { headers: svcHeaders(env) });
  const links = await linksResp.json().catch(() => []);
  if (!Array.isArray(links) || links.length === 0) {
    return jsonResponse({ ok: true, professionals: [] }, 200, origin, env);
  }

  const proIds = links.map(l => l.professional_id);
  const inList = '(' + proIds.map(id => '"' + id + '"').join(',') + ')';
  const prosUrl = SUPABASE_URL + '/rest/v1/professionals?id=in.' + encodeURIComponent(inList) +
    '&select=id,nome,tipo,registro,titulo_exibido,foto_url,logo_url';
  const prosResp = await fetch(prosUrl, { headers: svcHeaders(env) });
  const pros = await prosResp.json().catch(() => []);

  // Merge: pra cada link, anexa o pro
  const proMap = {};
  if (Array.isArray(pros)) pros.forEach(p => { proMap[p.id] = p; });
  const result = links.map(l => ({
    link_id: l.id,
    consented_at: l.consented_at,
    consent_version: l.consent_version,
    pro: proMap[l.professional_id] || null,
  })).filter(r => r.pro);

  return jsonResponse({ ok: true, professionals: result }, 200, origin, env);
}

// ════════════════════════════════════════════════════════════════════
// POST /api/unlink-professional   (paciente revoga)
// ════════════════════════════════════════════════════════════════════
export async function handleUnlinkProfessional(request, env, origin) {
  if (!isOriginAllowed(origin, env)) {
    return jsonResponse({ ok: false, error: 'origin_not_allowed' }, 403, origin, env);
  }
  const user = await verifyJwt(request, env);
  if (!user) return jsonResponse({ ok: false, error: 'auth_required' }, 401, origin, env);

  // v1.28.4: aceita ?link_id=... pra revogar 1 vinculo especifico (paciente
  // pode ter varios pros). Sem link_id, revoga todos os ativos.
  let body;
  try { body = await request.json(); } catch { body = {}; }
  const linkId = (body.link_id || '').trim();

  const patch = {
    status: 'revoked',
    revoked_at: new Date().toISOString(),
  };
  let url;
  if (linkId) {
    url = SUPABASE_URL + '/rest/v1/patient_links?id=eq.' + encodeURIComponent(linkId) +
      '&patient_user_id=eq.' + encodeURIComponent(user.id) + '&status=eq.active';
  } else {
    url = SUPABASE_URL + '/rest/v1/patient_links?patient_user_id=eq.' +
      encodeURIComponent(user.id) + '&status=eq.active';
  }
  const r = await fetch(url, {
    method: 'PATCH',
    headers: svcHeaders(env),
    body: JSON.stringify(patch),
  });
  if (!r.ok) {
    return jsonResponse({ ok: false, error: 'update_failed' }, 500, origin, env);
  }
  return jsonResponse({ ok: true }, 200, origin, env);
}

export { CRITERIOS_PM };
