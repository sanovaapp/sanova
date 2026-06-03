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
