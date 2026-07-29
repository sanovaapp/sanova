/**
 * Sanova API — Fase 2 Alertas Profissionais
 *
 * 4 rotas + 1 job de deteccao:
 *   GET  /api/pro-alerts-prefs       — lista prefs do pro logado           requirePro
 *   POST /api/pro-alerts-prefs       — upsert 1 pref (bloqueia 🔴 pra off) requirePro
 *   GET  /api/pro-alerts-list        — lista eventos ativos (30d, !dismissed) requirePro
 *   POST /api/pro-alerts-dismiss     — marca dismissed_at                  requirePro
 *   POST /api/admin-run-alert-detection — dispara detecção (workflow_dispatch)
 *
 * Contexto Fable T49.1 + T50:
 *   - 10 chaves: 5 🔴 (sempre imediato) + 5 🟡 (opt-in per pro)
 *   - Framing best-effort, SEM garantia
 *   - Linguagem = LIMIAR FACTUAL, não conclusão clínica (longe de SaMD)
 *   - Alertas 🔴 sao nao-configuraveis, disparam mesmo com opt-out geral
 */

import { jsonResponse, isOriginAllowed } from './http.js';
import { SUPABASE_URL, svcHeadersFor, requirePro } from './pro.js';

// ─── Definicao das 10 chaves ────────────────────────────────────────
// severity: 'red' (imediato, nao-configuravel) | 'yellow' (opt-in)
// janela_dias: janela pra dedup (nao dispara de novo dentro desse periodo)
// factual: gerador de mensagem factual (nao clinica). Recebe (contexto)
//   com dados brutos e devolve string. NUNCA usa "risco", "perigo",
//   "grave" — so numeros e limiares.
export const ALERT_KEYS = {
  crit_kcal_piso: {
    severity: 'red',
    label: 'Calorias abaixo do piso fisiológico',
    janela_dias: 7,
    dedup_horas: 24,
    factual: (c) => `Média de calorias nos últimos 7 dias: ${Math.round(c.kcalMedia7d || 0)} kcal (piso fisiológico: ${c.pisoKcal} kcal para ${c.sexo === 'M' ? 'homem' : 'mulher'}).`,
  },
  sintomas_gi: {
    severity: 'red',
    label: 'Sintomas GI persistentes',
    janela_dias: 3,
    dedup_horas: 24,
    factual: (c) => `Registros de sintomas GI (náusea/vômito/diarreia) em ${c.diasComSintoma}/3 últimos dias.`,
  },
  sinais_raros_graves: {
    severity: 'red',
    label: 'Sinais raros graves',
    janela_dias: 0,
    dedup_horas: 12,
    factual: (c) => `Registro reportado: ${c.sinal}.`,
  },
  perda_rapida: {
    severity: 'red',
    label: 'Perda de peso >1,5 kg/sem sustentada',
    janela_dias: 14,
    dedup_horas: 48,
    factual: (c) => `Perda média nas últimas 2 semanas: ${(c.perdaSemanal || 0).toFixed(2).replace('.', ',')} kg/semana (limiar: 1,50 kg/semana).`,
  },
  dose_atrasada: {
    severity: 'red',
    label: 'Dose atrasada >7 dias',
    janela_dias: 0,
    dedup_horas: 24,
    factual: (c) => `Última dose registrada há ${c.diasAtraso} dias (esperada em ${c.freq === 'semanal' ? '7 dias' : '1 dia'}).`,
  },
  prot_insuficiente: {
    severity: 'yellow',
    label: 'Proteína insuficiente',
    janela_dias: 7,
    dedup_horas: 24,
    factual: (c) => `Média de proteína nos últimos 7 dias: ${Math.round(c.protMedia7d || 0)}g (meta: ${Math.round(c.protMeta || 0)}g).`,
  },
  agua_insuficiente: {
    severity: 'yellow',
    label: 'Água insuficiente',
    janela_dias: 3,
    dedup_horas: 24,
    factual: (c) => `Média de água nos últimos 3 dias: ${Math.round(c.aguaMedia3d || 0)}ml (meta: ${c.aguaMeta}ml).`,
  },
  exerc_insuficiente: {
    severity: 'yellow',
    label: 'Exercício resistido insuficiente',
    janela_dias: 14,
    dedup_horas: 48,
    factual: (c) => `Sessões de exercício resistido nos últimos 14 dias: ${c.sessoes14d} (meta semanal: ${c.metaSem || 3}).`,
  },
  estoque_acabando: {
    severity: 'yellow',
    label: 'Estoque acabando',
    janela_dias: 0,
    dedup_horas: 24,
    factual: (c) => `Estoque atual: ${c.doses} doses (~${c.diasRestantes} dias).`,
  },
  sem_registros: {
    severity: 'yellow',
    label: 'Sem registros há 3+ dias',
    janela_dias: 0,
    dedup_horas: 24,
    factual: (c) => `Último registro há ${c.diasSemReg} dias.`,
  },
};

const RED_KEYS = Object.keys(ALERT_KEYS).filter(k => ALERT_KEYS[k].severity === 'red');
const YELLOW_KEYS = Object.keys(ALERT_KEYS).filter(k => ALERT_KEYS[k].severity === 'yellow');

// ─── Helpers ────────────────────────────────────────────────────────
function diasAtras(dateStr) {
  if (!dateStr) return Infinity;
  const d = new Date(dateStr + 'T12:00:00');
  const ms = Date.now() - d.getTime();
  return Math.floor(ms / 86400000);
}

// ─── Deteccao dos 10 alertas pra 1 paciente ────────────────────────
// Recebe app_state cru + profile agregado. Devolve array de eventos
// a inserir: [{alert_key, severity, factual_message, dedup_key, contexto}].
// Cada evento tem dedup_key = alert_key + ':' + patient_user_id + ':' +
// truncate(triggered_at, dedup_horas). Se ja existir row nao-dismissed
// dentro da janela, worker NAO insere de novo.
export function detectarAlertas(patient_user_id, state) {
  const eventos = [];
  const daily = Array.isArray(state.daily) ? state.daily : [];
  const weights = (Array.isArray(state.weights) ? state.weights : []).slice()
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const profile = state.profile || {};
  const caneta = state.caneta || {};

  const sexo = profile.sex || 'F';
  const pisoKcal = sexo === 'M' ? 1500 : 1200;
  const protMeta = Number(profile.protein_target_g) || 100;
  const aguaMeta = Number(profile.water_target_ml) || 2000;
  const metaSem = Number(state.exercMetaSem) || 3;

  // Ultimos 7 dias
  const hoje = new Date();
  const isoHoje = hoje.toISOString().slice(0, 10);
  function dsAtras(n) {
    const d = new Date(hoje);
    d.setDate(hoje.getDate() - n);
    return d.toISOString().slice(0, 10);
  }
  const last7 = Array.from({ length: 7 }, (_, i) => dsAtras(6 - i));
  const last3 = Array.from({ length: 3 }, (_, i) => dsAtras(2 - i));
  const last14 = Array.from({ length: 14 }, (_, i) => dsAtras(13 - i));

  const rec = (ds) => daily.find(x => x.date === ds) || {};

  // 1. crit_kcal_piso — media 7d abaixo do piso
  const kcal7 = last7.map(ds => Number(rec(ds).kcalConsumed) || 0).filter(v => v > 0);
  if (kcal7.length >= 5) {
    const kcalMedia7d = kcal7.reduce((s, v) => s + v, 0) / kcal7.length;
    if (kcalMedia7d < pisoKcal) {
      eventos.push({
        alert_key: 'crit_kcal_piso',
        severity: 'red',
        factual_message: ALERT_KEYS.crit_kcal_piso.factual({ kcalMedia7d, pisoKcal, sexo }),
      });
    }
  }

  // 2. sintomas_gi — GI reportado em 3 dias consecutivos
  const giKeys = ['nausea', 'nauseas', 'vomito', 'vomitos', 'diarreia'];
  const diasComSintoma = last3.filter(ds => {
    const r = rec(ds);
    const sym = String(r.symptom || '').toLowerCase();
    return giKeys.some(k => sym.includes(k));
  }).length;
  if (diasComSintoma >= 3) {
    eventos.push({
      alert_key: 'sintomas_gi',
      severity: 'red',
      factual_message: ALERT_KEYS.sintomas_gi.factual({ diasComSintoma }),
    });
  }

  // 3. sinais_raros_graves — flag no daily
  const raros = ['hipoglicemia', 'dor abdominal severa', 'queda de cabelo intensa'];
  for (const ds of last3) {
    const r = rec(ds);
    const sym = String(r.symptom || '').toLowerCase();
    const bate = raros.find(x => sym.includes(x));
    if (bate) {
      eventos.push({
        alert_key: 'sinais_raros_graves',
        severity: 'red',
        factual_message: ALERT_KEYS.sinais_raros_graves.factual({ sinal: bate }),
        dedup_extra: bate,
      });
      break;
    }
  }

  // 4. perda_rapida — >1,5 kg/sem sustentada por 14d
  if (weights.length >= 2) {
    const w14 = weights.filter(w => (w.date || '') >= last14[0]);
    if (w14.length >= 2) {
      const w0 = Number(w14[0].weight);
      const wf = Number(w14[w14.length - 1].weight);
      const dias = Math.max(1, diasAtras(w14[0].date) - diasAtras(w14[w14.length - 1].date));
      const perdaSemanal = ((w0 - wf) / dias) * 7;
      if (perdaSemanal > 1.5) {
        eventos.push({
          alert_key: 'perda_rapida',
          severity: 'red',
          factual_message: ALERT_KEYS.perda_rapida.factual({ perdaSemanal }),
        });
      }
    }
  }

  // 5. dose_atrasada — >7d desde ultima aplicacao (para semanal)
  const ultima = caneta.ultima || null;
  const freq = caneta.freq || 'semanal';
  if (ultima) {
    const diasAtraso = diasAtras(ultima);
    const limite = freq === 'diaria' ? 3 : 7;
    if (diasAtraso > limite) {
      eventos.push({
        alert_key: 'dose_atrasada',
        severity: 'red',
        factual_message: ALERT_KEYS.dose_atrasada.factual({ diasAtraso, freq }),
      });
    }
  }

  // 6. prot_insuficiente — media 7d abaixo de 80% da meta
  const prot7 = last7.map(ds => Number(rec(ds).proteinG) || 0);
  const prot7comReg = prot7.filter(v => v > 0);
  if (prot7comReg.length >= 5) {
    const protMedia7d = prot7.reduce((s, v) => s + v, 0) / 7;
    if (protMedia7d < protMeta * 0.6) {
      eventos.push({
        alert_key: 'prot_insuficiente',
        severity: 'yellow',
        factual_message: ALERT_KEYS.prot_insuficiente.factual({ protMedia7d, protMeta }),
      });
    }
  }

  // 7. agua_insuficiente — media 3d abaixo de 60% da meta
  const agua3 = last3.map(ds => Number(rec(ds).waterMl) || 0);
  const agua3comReg = agua3.filter(v => v > 0);
  if (agua3comReg.length >= 2) {
    const aguaMedia3d = agua3.reduce((s, v) => s + v, 0) / 3;
    if (aguaMedia3d < aguaMeta * 0.6) {
      eventos.push({
        alert_key: 'agua_insuficiente',
        severity: 'yellow',
        factual_message: ALERT_KEYS.agua_insuficiente.factual({ aguaMedia3d, aguaMeta }),
      });
    }
  }

  // 8. exerc_insuficiente — <meta*2 sessoes em 14 dias
  const resistidos = ['musculacao', 'musculação', 'resistido', 'resistidos', 'peso', 'pesos'];
  const sessoes14d = last14.filter(ds => {
    const r = rec(ds);
    const ex = String(r.exercicio || '').toLowerCase();
    return resistidos.some(k => ex.includes(k));
  }).length;
  const minima14d = metaSem * 2;
  if (sessoes14d < Math.max(2, minima14d - 2)) {
    eventos.push({
      alert_key: 'exerc_insuficiente',
      severity: 'yellow',
      factual_message: ALERT_KEYS.exerc_insuficiente.factual({ sessoes14d, metaSem }),
    });
  }

  // 9. estoque_acabando — <7d
  const estoque = Number(caneta.estoqueAtual) || 0;
  const dosesPorSemana = freq === 'semanal' ? 1 : 7;
  const diasRestantes = estoque > 0 ? Math.floor(estoque / dosesPorSemana * 7) : 0;
  if (estoque > 0 && diasRestantes < 7) {
    eventos.push({
      alert_key: 'estoque_acabando',
      severity: 'yellow',
      factual_message: ALERT_KEYS.estoque_acabando.factual({ doses: estoque, diasRestantes }),
    });
  }

  // 10. sem_registros — nada em 3+ dias
  const ultReg = daily
    .filter(d => (d.proteinG || 0) > 0 || (d.waterMl || 0) > 0 || (d.refeicoes && d.refeicoes.length))
    .map(d => d.date)
    .sort()
    .pop();
  if (ultReg) {
    const diasSemReg = diasAtras(ultReg);
    if (diasSemReg >= 3) {
      eventos.push({
        alert_key: 'sem_registros',
        severity: 'yellow',
        factual_message: ALERT_KEYS.sem_registros.factual({ diasSemReg }),
      });
    }
  }

  // Anexa dedup_key em cada evento
  const dedupHoje = new Date().toISOString().slice(0, 10);
  return eventos.map(ev => ({
    ...ev,
    dedup_key: `${ev.alert_key}:${patient_user_id}:${dedupHoje}${ev.dedup_extra ? ':' + ev.dedup_extra : ''}`,
  }));
}

// ─── GET/POST /api/pro-alerts-prefs ────────────────────────────────
export async function handleProAlertsPrefs(request, env, origin) {
  if (!isOriginAllowed(origin, env)) {
    return jsonResponse({ ok: false, error: 'origin_not_allowed' }, 403, origin, env);
  }
  const ctx = await requirePro(request, env, origin);
  if (ctx.error) return ctx.error;

  if (request.method === 'GET') {
    const u = SUPABASE_URL + '/rest/v1/professional_alert_prefs?professional_id=eq.' +
      encodeURIComponent(ctx.pro.id) + '&select=alert_key,frequencia,updated_at';
    const r = await fetch(u, { headers: svcHeadersFor(env) });
    const rows = await r.json().catch(() => []);
    // Merge com defaults — se pref nao existe, retorna 'imediato' pra red / 'off' pra yellow
    const byKey = {};
    (Array.isArray(rows) ? rows : []).forEach(x => { byKey[x.alert_key] = x; });
    const prefs = Object.keys(ALERT_KEYS).map(k => {
      const def = ALERT_KEYS[k];
      const existente = byKey[k];
      return {
        alert_key: k,
        label: def.label,
        severity: def.severity,
        frequencia: existente ? existente.frequencia : (def.severity === 'red' ? 'imediato' : 'off'),
        editavel: def.severity !== 'red',
      };
    });
    return jsonResponse({ ok: true, prefs }, 200, origin, env);
  }

  if (request.method === 'POST') {
    let body = {};
    try { body = await request.json(); } catch {}
    const alert_key = body.alert_key;
    const frequencia = body.frequencia;
    if (!alert_key || !ALERT_KEYS[alert_key]) {
      return jsonResponse({ ok: false, error: 'alert_key_invalido' }, 400, origin, env);
    }
    if (!['off','imediato','diario','semanal','mensal'].includes(frequencia)) {
      return jsonResponse({ ok: false, error: 'frequencia_invalida' }, 400, origin, env);
    }
    // Bloqueia off pra 🔴 (Fable T50 — dever de cuidado nao-negociavel)
    if (ALERT_KEYS[alert_key].severity === 'red' && frequencia !== 'imediato') {
      return jsonResponse({ ok: false, error: 'alerta_critico_nao_editavel' }, 400, origin, env);
    }
    const upsertUrl = SUPABASE_URL + '/rest/v1/professional_alert_prefs?on_conflict=professional_id,alert_key';
    const r = await fetch(upsertUrl, {
      method: 'POST',
      headers: {
        ...svcHeadersFor(env),
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify({
        professional_id: ctx.pro.id,
        alert_key,
        frequencia,
        updated_at: new Date().toISOString(),
      }),
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      return jsonResponse({ ok: false, error: 'upsert_falhou', detail: txt.slice(0, 200) }, 500, origin, env);
    }
    return jsonResponse({ ok: true }, 200, origin, env);
  }

  return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405, origin, env);
}

// ─── GET /api/pro-alerts-list ──────────────────────────────────────
export async function handleProAlertsList(request, env, origin) {
  if (!isOriginAllowed(origin, env)) {
    return jsonResponse({ ok: false, error: 'origin_not_allowed' }, 403, origin, env);
  }
  const ctx = await requirePro(request, env, origin);
  if (ctx.error) return ctx.error;

  const desde = new Date(Date.now() - 30 * 86400000).toISOString();
  const u = SUPABASE_URL + '/rest/v1/alert_events'
    + '?professional_id=eq.' + encodeURIComponent(ctx.pro.id)
    + '&triggered_at=gte.' + encodeURIComponent(desde)
    + '&dismissed_at=is.null'
    + '&order=triggered_at.desc'
    + '&select=id,patient_user_id,alert_key,severity,factual_message,triggered_at';
  const r = await fetch(u, { headers: svcHeadersFor(env) });
  const rows = await r.json().catch(() => []);
  const eventos = (Array.isArray(rows) ? rows : []).map(ev => ({
    ...ev,
    label: (ALERT_KEYS[ev.alert_key] || {}).label || ev.alert_key,
    patient_user_id_curto: (ev.patient_user_id || '').slice(0, 8) + '...',
  }));
  return jsonResponse({ ok: true, eventos, total: eventos.length }, 200, origin, env);
}

// ─── POST /api/pro-alerts-dismiss ──────────────────────────────────
export async function handleProAlertsDismiss(request, env, origin) {
  if (!isOriginAllowed(origin, env)) {
    return jsonResponse({ ok: false, error: 'origin_not_allowed' }, 403, origin, env);
  }
  const ctx = await requirePro(request, env, origin);
  if (ctx.error) return ctx.error;
  let body = {};
  try { body = await request.json(); } catch {}
  const event_id = body.event_id;
  if (!event_id) return jsonResponse({ ok: false, error: 'missing_event_id' }, 400, origin, env);

  const u = SUPABASE_URL + '/rest/v1/alert_events'
    + '?id=eq.' + encodeURIComponent(event_id)
    + '&professional_id=eq.' + encodeURIComponent(ctx.pro.id);
  const r = await fetch(u, {
    method: 'PATCH',
    headers: {
      ...svcHeadersFor(env),
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({ dismissed_at: new Date().toISOString() }),
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    return jsonResponse({ ok: false, error: 'dismiss_falhou', detail: txt.slice(0, 200) }, 500, origin, env);
  }
  return jsonResponse({ ok: true }, 200, origin, env);
}

// ─── POST /api/admin-run-alert-detection ───────────────────────────
// Roda a deteccao pra todos os vinculos ativos ou pra 1 (patient_user_id).
// Auth: admin token no header X-Admin-Token (matches env.ADMIN_OVERRIDE_TOKEN).
// Retorna resumo (nao os eventos inseridos individualmente — evita context bloat).
export async function handleAdminRunAlertDetection(request, env, origin) {
  const token = request.headers.get('X-Admin-Token');
  if (!env.ADMIN_OVERRIDE_TOKEN || token !== env.ADMIN_OVERRIDE_TOKEN) {
    return jsonResponse({ ok: false, error: 'unauthorized' }, 401, origin, env);
  }

  const url = new URL(request.url);
  const patient_user_id = url.searchParams.get('patient_user_id') || null;

  // 1. Pega vinculos ativos
  let linksUrl = SUPABASE_URL + '/rest/v1/patient_links?status=eq.active&select=id,professional_id,patient_user_id';
  if (patient_user_id) linksUrl += '&patient_user_id=eq.' + encodeURIComponent(patient_user_id);
  const linksResp = await fetch(linksUrl, { headers: svcHeadersFor(env) });
  const links = await linksResp.json().catch(() => []);
  if (!Array.isArray(links) || !links.length) {
    return jsonResponse({ ok: true, links: 0, eventos_inseridos: 0 }, 200, origin, env);
  }

  // 2. Pega prefs de todos os pros envolvidos
  const proIds = [...new Set(links.map(l => l.professional_id))];
  const prefsUrl = SUPABASE_URL + '/rest/v1/professional_alert_prefs?professional_id=in.('
    + proIds.join(',') + ')&select=professional_id,alert_key,frequencia';
  const prefsResp = await fetch(prefsUrl, { headers: svcHeadersFor(env) });
  const prefsRaw = await prefsResp.json().catch(() => []);
  const prefsByProKey = {};
  (Array.isArray(prefsRaw) ? prefsRaw : []).forEach(p => {
    prefsByProKey[p.professional_id + ':' + p.alert_key] = p.frequencia;
  });
  function prefDe(pro_id, key) {
    const p = prefsByProKey[pro_id + ':' + key];
    if (p !== undefined) return p;
    return ALERT_KEYS[key].severity === 'red' ? 'imediato' : 'off';
  }

  // 3. Pega app_state de todos os pacientes envolvidos (dedup)
  const patientIds = [...new Set(links.map(l => l.patient_user_id))];
  const statesUrl = SUPABASE_URL + '/rest/v1/app_state?user_id=in.('
    + patientIds.join(',') + ')&select=user_id,state';
  const statesResp = await fetch(statesUrl, { headers: svcHeadersFor(env) });
  const statesRaw = await statesResp.json().catch(() => []);
  const stateByPatient = {};
  (Array.isArray(statesRaw) ? statesRaw : []).forEach(r => {
    if (r && r.state) stateByPatient[r.user_id] = r.state;
  });

  // 4. Detecta + dedup + insere
  let processados = 0, candidatos = 0, filtradosPref = 0, deduplicados = 0, inseridos = 0;
  for (const link of links) {
    processados++;
    const state = stateByPatient[link.patient_user_id];
    if (!state) continue;
    const eventos = detectarAlertas(link.patient_user_id, state);
    candidatos += eventos.length;
    for (const ev of eventos) {
      // filtra por pref do pro
      const freq = prefDe(link.professional_id, ev.alert_key);
      if (freq === 'off') { filtradosPref++; continue; }
      // dedup: existe alert_events com mesmo dedup_key nao-dismissed
      // dentro da dedup_horas?
      const dedupHoras = ALERT_KEYS[ev.alert_key].dedup_horas || 24;
      const desde = new Date(Date.now() - dedupHoras * 3600 * 1000).toISOString();
      const checkUrl = SUPABASE_URL + '/rest/v1/alert_events'
        + '?dedup_key=eq.' + encodeURIComponent(ev.dedup_key)
        + '&professional_id=eq.' + encodeURIComponent(link.professional_id)
        + '&triggered_at=gte.' + encodeURIComponent(desde)
        + '&select=id&limit=1';
      const check = await fetch(checkUrl, { headers: svcHeadersFor(env) });
      const existentes = await check.json().catch(() => []);
      if (Array.isArray(existentes) && existentes.length > 0) {
        deduplicados++;
        continue;
      }
      // insere
      const ins = await fetch(SUPABASE_URL + '/rest/v1/alert_events', {
        method: 'POST',
        headers: {
          ...svcHeadersFor(env),
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          professional_id: link.professional_id,
          patient_user_id: link.patient_user_id,
          alert_key: ev.alert_key,
          severity: ev.severity,
          factual_message: ev.factual_message,
          dedup_key: ev.dedup_key,
          delivered_via: 'log',
        }),
      });
      if (ins.ok) inseridos++;
    }
  }

  return jsonResponse({
    ok: true,
    links: links.length,
    processados,
    candidatos,
    filtradosPref,
    deduplicados,
    inseridos,
  }, 200, origin, env);
}
