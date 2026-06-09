/**
 * Sanova API Worker — autenticacao admin.
 *
 * Duas formas de provar que voce eh admin:
 *
 *  1) JWT do Supabase no header Authorization: Bearer <token>
 *     - Valida o token em /auth/v1/user (Supabase)
 *     - Pega o e-mail do usuario logado
 *     - Confere se ele esta na tabela admins (via isEmailAdmin)
 *     Caminho usado pelo painel /admin/ no navegador.
 *
 *  2) Override token no header X-Admin-Token: <token>
 *     - Compara em tempo constante com env.ADMIN_OVERRIDE_TOKEN
 *     Caminho usado por GitHub Actions (workflow gateway e cron),
 *     onde nao da pra ter sessao Supabase.
 *
 * Sem nenhuma das duas, /api/admin-* responde 401.
 */

import { isEmailAdmin } from './supabase.js';

const SUPABASE_URL = 'https://yjycpcydqfuvojfzwfvy.supabase.co';

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function _verifyJwt(token, env) {
  const resp = await fetch(SUPABASE_URL + '/auth/v1/user', {
    headers: {
      'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': 'Bearer ' + token,
    },
  });
  if (!resp.ok) return null;
  const u = await resp.json().catch(() => null);
  return u && u.email ? u : null;
}

/**
 * Valida que a requisicao tem permissao de admin.
 * Retorna { ok: true, via, email? } se OK,
 * ou { ok: false, status, error } se nao.
 */
export async function requireAdmin(request, env) {
  const override = request.headers.get('X-Admin-Token') || '';
  const overrideSecret = env.ADMIN_OVERRIDE_TOKEN || '';
  if (override && overrideSecret && timingSafeEqual(override, overrideSecret)) {
    return { ok: true, via: 'override' };
  }

  const authz = request.headers.get('Authorization') || '';
  const m = authz.match(/^Bearer\s+(.+)$/i);
  if (m) {
    const token = m[1].trim();
    const user = await _verifyJwt(token, env);
    if (user && user.email) {
      const check = await isEmailAdmin(user.email, env);
      if (check && check.isAdmin) {
        return { ok: true, via: 'jwt', email: user.email };
      }
      return { ok: false, status: 403, error: 'not_admin' };
    }
    return { ok: false, status: 401, error: 'invalid_token' };
  }

  return { ok: false, status: 401, error: 'auth_required' };
}
