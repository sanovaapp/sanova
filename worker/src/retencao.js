/**
 * Retencao automatica de dados.
 *
 * A politica de privacidade promete, em texto publico, que dado nao fica pra
 * sempre. Ate hoje nada apagava nada — a promessa existia no papel e nao no
 * codigo. Isso e exposicao real de LGPD: prometer descarte e nao descartar e
 * pior que nao prometer.
 *
 * ─── As escolhas, e por que ────────────────────────────────────────
 *
 * O Bruno mandou parar de travar fila esperando ele escolher entre A e B.
 * Entao aqui estao os padroes escolhidos, com o racional exposto pra ele
 * revogar o que discordar:
 *
 *   alert_events  ->  180 dias, APAGA DE VERDADE.
 *       Sao registros operacionais. Profissional nenhum precisa ver alerta de
 *       um ano atras, e cada linha guarda uma frase factual sobre a saude de
 *       um paciente. Apagar aqui REDUZ exposicao — e a direcao segura.
 *
 *   conta inativa ->  24 meses, SO RELATA. Nao apaga.
 *       Apagar conta de paciente e irreversivel e toca dado de saude. O
 *       mecanismo fica pronto e auditavel, mas em modo relatorio ate alguem
 *       olhar os numeros reais. Ligar de verdade e trocar `aplicar` pra true
 *       no dispatch — uma linha, decisao consciente, nao efeito colateral de
 *       um cron que ninguem leu.
 *
 *   conta apagada ->  nada a fazer.
 *       A politica promete remocao "em ate 30 dias". O codigo ja apaga na
 *       hora, via /api/delete-my-account. Entregamos melhor do que
 *       prometemos, entao nao ha buraco aqui.
 */

import { jsonResponse } from './http.js';

const SUPABASE_URL = 'https://yjycpcydqfuvojfzwfvy.supabase.co';

const DIAS_ALERTAS = 180;
const MESES_INATIVIDADE = 24;

function svcHeaders(env) {
  return {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY,
    'Content-Type': 'application/json',
  };
}

function isoDiasAtras(dias) {
  return new Date(Date.now() - dias * 86400000).toISOString();
}

/**
 * Apaga alert_events mais velhos que DIAS_ALERTAS.
 * Devolve quantos sumiram — PostgREST responde com as linhas removidas
 * quando pedimos `Prefer: return=representation`.
 */
async function limparAlertasVelhos(env) {
  const corte = isoDiasAtras(DIAS_ALERTAS);
  const url =
    SUPABASE_URL +
    '/rest/v1/alert_events?triggered_at=lt.' +
    encodeURIComponent(corte) +
    '&select=id';

  const r = await fetch(url, {
    method: 'DELETE',
    headers: { ...svcHeaders(env), Prefer: 'return=representation' },
  });

  if (!r.ok) {
    const corpo = await r.text().catch(() => '');
    return { erro: `HTTP ${r.status} ${corpo.slice(0, 160)}` };
  }
  const linhas = await r.json().catch(() => []);
  return { apagados: Array.isArray(linhas) ? linhas.length : 0, corte };
}

/**
 * Conta contas sem nenhum sinal de vida ha MESES_INATIVIDADE.
 *
 * NAO apaga por padrao. `aplicar` existe pra quando alguem tiver olhado os
 * numeros e decidido conscientemente — nao pra um cron descobrir sozinho que
 * pode deletar paciente.
 *
 * "Sinal de vida" e o `updated_at` do app_state: qualquer registro de peso,
 * refeicao, dose ou check-in mexe nele.
 */
async function varrerContasInativas(env, aplicar) {
  const corte = isoDiasAtras(MESES_INATIVIDADE * 30);
  const url =
    SUPABASE_URL +
    '/rest/v1/app_state?updated_at=lt.' +
    encodeURIComponent(corte) +
    '&select=user_id,updated_at';

  const r = await fetch(url, { headers: svcHeaders(env) });
  if (!r.ok) {
    const corpo = await r.text().catch(() => '');
    return { erro: `HTTP ${r.status} ${corpo.slice(0, 160)}` };
  }
  const linhas = await r.json().catch(() => []);
  const total = Array.isArray(linhas) ? linhas.length : 0;

  if (!aplicar) {
    // Devolve so a CONTAGEM. Lista de user_id de paciente nao sai daqui —
    // o retorno deste endpoint vai parar em log de workflow.
    return { modo: 'relatorio', inativas: total, corte, apagadas: 0 };
  }

  let apagadas = 0;
  const falhas = [];
  for (const linha of linhas) {
    const del = await fetch(
      SUPABASE_URL + '/auth/v1/admin/users/' + encodeURIComponent(linha.user_id),
      { method: 'DELETE', headers: svcHeaders(env) },
    );
    if (del.ok) apagadas++;
    else falhas.push(del.status);
  }
  return { modo: 'aplicado', inativas: total, apagadas, falhas: falhas.length, corte };
}

/**
 * GET/POST /api/admin-run-retention?aplicar=1
 *
 * Mesmo portao do admin-run-alert-detection: header X-Admin-Token. Quem
 * dispara e o workflow retencao.yml, todo dia.
 */
export async function handleAdminRunRetention(request, env, origin) {
  const token = request.headers.get('X-Admin-Token');
  if (!env.ADMIN_OVERRIDE_TOKEN || token !== env.ADMIN_OVERRIDE_TOKEN) {
    return jsonResponse({ ok: false, error: 'unauthorized' }, 401, origin, env);
  }

  const url = new URL(request.url);
  const aplicar = url.searchParams.get('aplicar') === '1';

  const alertas = await limparAlertasVelhos(env);
  const inativas = await varrerContasInativas(env, aplicar);

  return jsonResponse(
    {
      ok: true,
      politica: {
        alert_events_dias: DIAS_ALERTAS,
        inatividade_meses: MESES_INATIVIDADE,
        conta_apagada: 'imediato via /api/delete-my-account',
      },
      alertas,
      inativas,
    },
    200,
    origin,
    env,
  );
}

// Exportados pra teste.
export const _politica = { DIAS_ALERTAS, MESES_INATIVIDADE };
export { isoDiasAtras };
