/**
 * Supabase Admin — UPDATE em `subscriptions` via service_role.
 *
 * O Worker e o unico contexto que pode escrever nessa tabela com privilegio
 * total. A key nunca toca o client. RLS continua valendo pra qualquer outro
 * cliente.
 */

const SUPABASE_URL = 'https://yjycpcydqfuvojfzwfvy.supabase.co';

function _headers(env) {
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY ausente no Worker');
  return {
    'apikey': key,
    'Authorization': 'Bearer ' + key,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  };
}

/**
 * Cria ou atualiza a row de subscriptions pra um user (upsert).
 * Usa user_id como chave de conflito.
 */
export async function upsertSubscription(row, env) {
  const url = SUPABASE_URL + '/rest/v1/subscriptions?on_conflict=user_id';
  const resp = await fetch(url, {
    method: 'POST',
    headers: { ..._headers(env), 'Prefer': 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(row),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error('Supabase upsert: HTTP ' + resp.status + ' ' + JSON.stringify(data).slice(0, 200));
  }
  return data;
}

/**
 * Atualiza por user_id (PATCH parcial). row = campos a mudar.
 */
export async function updateSubscriptionByUser(userId, row, env) {
  const url = SUPABASE_URL + '/rest/v1/subscriptions?user_id=eq.' + encodeURIComponent(userId);
  const patchRow = { ...row, updated_at: new Date().toISOString() };
  const resp = await fetch(url, {
    method: 'PATCH',
    headers: _headers(env),
    body: JSON.stringify(patchRow),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error('Supabase update(user): HTTP ' + resp.status + ' ' + JSON.stringify(data).slice(0, 200));
  }
  return data;
}

/**
 * Atualiza pela mp_preapproval_id (PATCH parcial).
 * Usado quando o webhook traz so o preapproval_id.
 */
export async function updateSubscriptionByPreapproval(preapprovalId, row, env) {
  const url = SUPABASE_URL + '/rest/v1/subscriptions?mp_preapproval_id=eq.' + encodeURIComponent(preapprovalId);
  const patchRow = { ...row, updated_at: new Date().toISOString() };
  const resp = await fetch(url, {
    method: 'PATCH',
    headers: _headers(env),
    body: JSON.stringify(patchRow),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error('Supabase update(preapproval): HTTP ' + resp.status + ' ' + JSON.stringify(data).slice(0, 200));
  }
  return data;
}

/**
 * Busca user_id a partir de um e-mail Supabase (usado em fallback de webhook).
 * Lista todos os users e filtra — OK porque base e pequena. Pra escala, usar
 * RPC custom no Supabase.
 */
export async function findUserByEmail(email, env) {
  const url = SUPABASE_URL + '/auth/v1/admin/users?per_page=200';
  const resp = await fetch(url, {
    headers: _headers(env),
  });
  if (!resp.ok) return null;
  const data = await resp.json().catch(() => null);
  const users = (data && data.users) || [];
  const hit = users.find(u => (u.email || '').toLowerCase() === (email || '').toLowerCase());
  return hit ? hit.id : null;
}

/**
 * Conta linhas de uma tabela / view via REST. Usado como "ping" pra verificar
 * se a entidade existe no banco. Retorna { exists, count } ou { exists: false }
 * se erro de tabela inexistente.
 */
export async function countRows(tableName, env) {
  const url = SUPABASE_URL + '/rest/v1/' + tableName + '?select=*&limit=0';
  const resp = await fetch(url, {
    headers: { ..._headers(env), 'Prefer': 'count=exact' },
  });
  if (resp.status === 404 || resp.status === 400) {
    return { exists: false, count: 0 };
  }
  if (!resp.ok) return { exists: false, count: 0, error: 'HTTP ' + resp.status };
  // Supabase retorna Content-Range no header pra count exato
  const range = resp.headers.get('content-range') || '';
  const m = range.match(/\/(\d+)$/);
  return { exists: true, count: m ? Number(m[1]) : 0 };
}

/**
 * Checa se um e-mail e admin (via service_role, ignora RLS).
 */
export async function isEmailAdmin(email, env) {
  const userId = await findUserByEmail(email, env);
  if (!userId) return { found: false, isAdmin: false };
  const url = SUPABASE_URL + '/rest/v1/admins?user_id=eq.' + encodeURIComponent(userId) + '&select=user_id';
  const resp = await fetch(url, { headers: _headers(env) });
  if (!resp.ok) return { found: true, isAdmin: false, error: 'HTTP ' + resp.status };
  const data = await resp.json().catch(() => []);
  return { found: true, isAdmin: data.length > 0, userId };
}

/**
 * Gera magic link de login pra um e-mail. Permite Playwright/E2E logar
 * sem precisar de senha (Bruno mobile-only nao precisa expor a dele).
 * Retorna {action_link, ...}.
 */
export async function generateMagicLink(email, redirectTo, env) {
  const url = SUPABASE_URL + '/auth/v1/admin/generate_link';
  const resp = await fetch(url, {
    method: 'POST',
    headers: _headers(env),
    body: JSON.stringify({
      type: 'magiclink',
      email,
      options: redirectTo ? { redirect_to: redirectTo } : {},
    }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error('Supabase generateMagicLink: HTTP ' + resp.status + ' ' + JSON.stringify(data).slice(0, 200));
  }
  return data;
}

/**
 * v1.9.0: pega plano MP por tipo ('mensal' | 'anual').
 * Retorna { mp_plan_id, init_point } ou null se nao existir.
 */
export async function getMpPlan(tipo, env) {
  const url = SUPABASE_URL + '/rest/v1/mp_plans?tipo=eq.' + encodeURIComponent(tipo) + '&select=*';
  const resp = await fetch(url, { headers: _headers(env) });
  if (!resp.ok) return null;
  const arr = await resp.json().catch(() => []);
  return (Array.isArray(arr) && arr.length > 0) ? arr[0] : null;
}

/**
 * v1.9.0: upsert plano MP por tipo (chave de conflito).
 */
export async function upsertMpPlan(row, env) {
  const url = SUPABASE_URL + '/rest/v1/mp_plans?on_conflict=tipo';
  const resp = await fetch(url, {
    method: 'POST',
    headers: { ..._headers(env), 'Prefer': 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(row),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error('upsertMpPlan: HTTP ' + resp.status + ' ' + JSON.stringify(data).slice(0, 200));
  }
  return Array.isArray(data) ? data[0] : data;
}

/**
 * v1.11.0: lista as N subscriptions mais recentes (pra debug admin).
 * Junta auth.users via PostgREST embed pra trazer email.
 */
export async function listRecentSubscriptions(limit, env) {
  const url = SUPABASE_URL + '/rest/v1/subscriptions?select=*&order=updated_at.desc&limit=' + (limit || 10);
  const resp = await fetch(url, { headers: _headers(env) });
  if (!resp.ok) {
    return { ok: false, error: 'HTTP ' + resp.status };
  }
  const rows = await resp.json().catch(() => []);
  // Para cada user_id, busca email via admin API (n+1 burro mas baixo volume)
  const out = [];
  for (const r of rows) {
    let email = null;
    try {
      const u = await fetch(SUPABASE_URL + '/auth/v1/admin/users/' + r.user_id, {
        headers: _headers(env),
      });
      if (u.ok) {
        const ud = await u.json().catch(() => null);
        email = ud && ud.email ? ud.email : null;
      }
    } catch {}
    out.push({
      user_id_curto: r.user_id ? r.user_id.slice(0, 8) + '...' : null,
      email,
      status: r.status,
      trial_started_at: r.trial_started_at,
      trial_ends_at: r.trial_ends_at,
      subscription_started_at: r.subscription_started_at,
      subscription_ends_at: r.subscription_ends_at,
      mp_preapproval_id: r.mp_preapproval_id,
      mp_subscription_id: r.mp_subscription_id,
      updated_at: r.updated_at,
    });
  }
  return { ok: true, count: out.length, subscriptions: out };
}
