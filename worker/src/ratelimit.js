/**
 * Limite de chamadas por IP.
 *
 * Motivo: ate aqui qualquer um podia martelar os endpoints sem nenhum freio.
 * Os dois estragos possiveis sao diferentes e ambos reais:
 *
 *   - `/api/analyze-photo` e `/api/analyze-text` chamam a Gemini, que e paga
 *     POR CHAMADA. Um laco de terceiro vira fatura do Bruno.
 *   - As rotas de auth e de assinatura sao onde se tenta forca bruta e onde
 *     um laco causa escrita repetida no Supabase.
 *
 * Usa a API nativa de rate limiting do Cloudflare Workers, configurada em
 * `wrangler.toml`. Escolha deliberada: nao exige criar KV nem Durable Object
 * (recurso externo que alguem teria que provisionar a mao). O binding sobe
 * junto com o deploy.
 *
 * FALHA ABERTA de proposito: se o binding nao existir — ambiente local,
 * versao antiga do runtime, teste — a requisicao passa. Um app de saude que
 * derruba o proprio acesso porque o limitador nao carregou e pior que um app
 * sem limitador.
 */

import { jsonResponse } from './http.js';

// Cada faixa tem um binding proprio em wrangler.toml, porque a API nativa
// fixa o teto na configuracao e nao no codigo.
//
// Os numeros sao por IP, por minuto, e generosos de proposito: paciente em
// rede movel compartilhada (CGNAT) divide IP com desconhecidos, e cortar
// alguem no meio de um registro de refeicao seria pior que o abuso que
// estamos evitando.
const FAIXAS = [
  {
    binding: 'RL_IA',
    limite: 20,
    rotas: ['/api/analyze-photo', '/api/analyze-text'],
    motivo: 'chamada de IA, paga por uso',
  },
  {
    binding: 'RL_ESCRITA',
    limite: 60,
    rotas: [
      '/api/pro-register',
      '/api/link-professional',
      '/api/unlink-professional',
      '/api/mp-create-preapproval',
      '/api/delete-my-account',
      '/api/export-my-data',
      '/api/pro-assets',
    ],
    motivo: 'escreve no banco ou toca cobranca',
  },
];

/**
 * Identidade do chamador. `CF-Connecting-IP` e preenchido pela propria
 * Cloudflare e nao pode ser forjado pelo cliente — diferente de
 * `X-Forwarded-For`, que pode.
 */
function chaveDe(request, pathname) {
  const ip = request.headers.get('CF-Connecting-IP') || 'sem-ip';
  return `${ip}:${pathname}`;
}

/**
 * Devolve uma Response 429 quando o teto estourou, ou null pra deixar passar.
 *
 * Nao lanca nunca: qualquer problema no limitador vira "deixa passar".
 */
export async function checarLimite(request, env, url, origin) {
  const faixa = FAIXAS.find((f) => f.rotas.includes(url.pathname));
  if (!faixa) return null;

  const limiter = env[faixa.binding];
  if (!limiter || typeof limiter.limit !== 'function') return null;

  let dentro = true;
  try {
    const r = await limiter.limit({ key: chaveDe(request, url.pathname) });
    dentro = r?.success !== false;
  } catch (e) {
    console.warn('[ratelimit] binding falhou, deixando passar:', e?.message || e);
    return null;
  }

  if (dentro) return null;

  console.warn(`[ratelimit] 429 em ${url.pathname} (${faixa.motivo})`);

  // A mensagem e pro paciente, nao pro atacante: diz o que fazer, nao como o
  // limite funciona.
  return jsonResponse(
    {
      ok: false,
      error: 'rate_limited',
      message: 'Muitas tentativas em pouco tempo. Espere um minuto e tente de novo.',
    },
    429,
    origin,
    env,
  );
}

// Exportado so pra teste — mantem a lista de rotas verificavel sem subir worker.
export const _faixas = FAIXAS;
