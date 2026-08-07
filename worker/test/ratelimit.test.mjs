/**
 * Testes do limitador de chamadas.
 *
 * Rodam sem subir worker e sem rede: o binding do Cloudflare e substituido por
 * um dublê. Rodar com:
 *
 *   cd worker && npm test
 *
 * O que estes testes protegem, na ordem de gravidade:
 *
 *  1. Falha ABERTA. Se o limitador quebrar, o paciente ainda usa o app. Um
 *     app de saude que se auto-derruba porque um binding nao carregou e pior
 *     que um app sem limitador.
 *  2. A rota de IA esta coberta. E a unica que custa dinheiro por chamada.
 *  3. A resposta de 429 nao explica como o limite funciona.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { checarLimite, _faixas } from '../src/ratelimit.js';

const ENV = { ALLOWED_ORIGINS: 'https://sanova.app.br' };
const ORIGIN = 'https://sanova.app.br';

function req(ip = '203.0.113.7') {
  return new Request('https://api.exemplo/api/analyze-text', {
    method: 'POST',
    headers: { 'CF-Connecting-IP': ip },
  });
}

const rota = (p) => new URL('https://api.exemplo' + p);

/** Dublê do binding: responde sempre o mesmo `success`. */
const limitador = (success) => ({ limit: async () => ({ success }) });

test('deixa passar quando esta dentro do teto', async () => {
  const env = { ...ENV, RL_IA: limitador(true) };
  const r = await checarLimite(req(), env, rota('/api/analyze-text'), ORIGIN);
  assert.equal(r, null, 'dentro do teto nao deve bloquear');
});

test('devolve 429 quando estourou', async () => {
  const env = { ...ENV, RL_IA: limitador(false) };
  const r = await checarLimite(req(), env, rota('/api/analyze-text'), ORIGIN);
  assert.ok(r, 'deveria bloquear');
  assert.equal(r.status, 429);
  const corpo = await r.json();
  assert.equal(corpo.error, 'rate_limited');
});

test('a mensagem do 429 nao entrega como o limite funciona', async () => {
  const env = { ...ENV, RL_IA: limitador(false) };
  const r = await checarLimite(req(), env, rota('/api/analyze-text'), ORIGIN);
  const { message } = await r.json();
  for (const vazamento of ['20', '60', 'IP', 'RL_IA', 'namespace']) {
    assert.ok(
      !message.includes(vazamento),
      `a mensagem nao deveria conter "${vazamento}": ${message}`,
    );
  }
});

test('FALHA ABERTA: binding ausente deixa passar', async () => {
  const r = await checarLimite(req(), { ...ENV }, rota('/api/analyze-text'), ORIGIN);
  assert.equal(r, null, 'sem binding a requisicao tem que passar');
});

test('FALHA ABERTA: binding que lanca excecao deixa passar', async () => {
  const env = {
    ...ENV,
    RL_IA: { limit: async () => { throw new Error('binding indisponivel'); } },
  };
  const r = await checarLimite(req(), env, rota('/api/analyze-text'), ORIGIN);
  assert.equal(r, null, 'excecao no limitador nao pode derrubar a requisicao');
});

test('rota fora das faixas nunca e limitada', async () => {
  const env = { ...ENV, RL_IA: limitador(false), RL_ESCRITA: limitador(false) };
  for (const p of ['/api/health', '/api/pro-patients', '/api/nao-existe']) {
    assert.equal(
      await checarLimite(req(), env, rota(p), ORIGIN),
      null,
      `${p} nao deveria ser limitada`,
    );
  }
});

test('as duas rotas de IA estao cobertas — sao as que custam por chamada', async () => {
  const env = { ...ENV, RL_IA: limitador(false) };
  for (const p of ['/api/analyze-photo', '/api/analyze-text']) {
    const r = await checarLimite(req(), env, rota(p), ORIGIN);
    assert.equal(r?.status, 429, `${p} tem que estar coberta`);
  }
});

test('IPs diferentes usam chaves diferentes', async () => {
  const vistas = [];
  const env = {
    ...ENV,
    RL_IA: { limit: async ({ key }) => { vistas.push(key); return { success: true }; } },
  };
  await checarLimite(req('203.0.113.7'), env, rota('/api/analyze-text'), ORIGIN);
  await checarLimite(req('198.51.100.2'), env, rota('/api/analyze-text'), ORIGIN);
  assert.equal(new Set(vistas).size, 2, 'um IP nao pode consumir o teto do outro');
});

test('nenhuma rota aparece em duas faixas', () => {
  const todas = _faixas.flatMap((f) => f.rotas);
  assert.equal(
    new Set(todas).size,
    todas.length,
    'rota repetida faria a faixa mais frouxa mascarar a mais apertada',
  );
});
