/**
 * Pagamento aprovado tem que virar acesso liberado.
 *
 * Achado no diagnostico de 12/11/2026: o webhook marcava status='active' sem
 * gravar subscription_ends_at, e o app so libera quem tem essa data no
 * futuro. Quem pagava continuava vendo "expirado".
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calcValidade, FOLGA_DIAS } from '../src/mp.js';

const DIA = 86400000;

test('usa a proxima cobranca do Mercado Pago, mais a folga', () => {
  const v = calcValidade({ next_payment_date: '2027-01-10T12:00:00.000Z' }, '2026-12-10T12:00:00.000Z');
  assert.equal(v, new Date(Date.parse('2027-01-10T12:00:00.000Z') + FOLGA_DIAS * DIA).toISOString());
});

test('sem data do MP, conta um ciclo mensal a partir da cobranca', () => {
  const v = calcValidade({ auto_recurring: { frequency: 1, frequency_type: 'months' } }, '2026-12-10T12:00:00.000Z');
  assert.equal(v, new Date(Date.parse('2027-01-10T12:00:00.000Z') + FOLGA_DIAS * DIA).toISOString());
});

test('plano anual conta 12 meses', () => {
  const v = calcValidade({ auto_recurring: { frequency: 12, frequency_type: 'months' } }, '2026-12-10T12:00:00.000Z');
  assert.ok(v.startsWith('2027-12-13'));
});

test('data do MP no passado nao vale: cai no ciclo', () => {
  const v = calcValidade({ next_payment_date: '2026-01-01T00:00:00.000Z', auto_recurring: { frequency: 1, frequency_type: 'months' } }, '2026-12-10T12:00:00.000Z');
  assert.ok(Date.parse(v) > Date.parse('2026-12-10T12:00:00.000Z'));
});

test('preapproval ausente nao quebra e ainda da validade futura', () => {
  assert.ok(Date.parse(calcValidade(null)) > Date.now());
});

test('o webhook grava a validade nos dois caminhos de ativacao', () => {
  const src = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
  const hook = src.slice(src.indexOf('async function handleMpWebhook'), src.indexOf('async function _resolveUserId'));
  assert.equal((hook.match(/subscription_ends_at = calcValidade\(/g) || []).length, 2);
});

test('checkout e IA exigem sessao no servidor', () => {
  const src = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
  for (const fn of ['handleMpCreatePreapproval', 'handleAnalyzePhoto', 'handleAnalyzeText']) {
    const i = src.indexOf('async function ' + fn);
    assert.ok(src.slice(i, i + 1200).includes('verifyJwt(request, env)'), fn + ' sem checagem de sessao');
  }
});

test('o app manda a sessao nas chamadas de checkout e IA', () => {
  const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  for (const rota of ['/api/mp-create-preapproval', '/api/analyze-photo', '/api/analyze-text']) {
    let i = -1, n = 0;
    while ((i = html.indexOf("'" + rota + "'", i + 1)) !== -1) {
      if (!html.slice(i - 200, i).includes('fetch(')) continue;
      n++;
      assert.ok(html.slice(i, i + 300).includes("'Authorization'"), rota + ' sem Authorization');
    }
    assert.ok(n >= 1, rota + ' nao encontrada');
  }
});

test('ferramentas admin usam o MESMO token do checkout (nada de sandbox fixo)', () => {
  // Em producao, o cleanup diario com token sandbox nao acharia cobranca
  // nenhuma e rebaixaria todo pagante real pra trial.
  const src = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
  assert.equal(src.includes('env.MP_ACCESS_TOKEN_SANDBOX || env.MP_ACCESS_TOKEN'), false);
});

test('diagnostico do MP nunca devolve o valor de um token', async () => {
  const { diagnosticoMP, tipoDoToken } = await import('../src/mp.js');
  assert.equal(tipoDoToken('TEST-123'), 'teste (TEST-)');
  assert.equal(tipoDoToken('APP_USR-123'), 'producao (APP_USR-)');
  assert.equal(tipoDoToken(''), 'ausente');
  const real = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 401, json: async () => ({}) });
  try {
    const env = { MP_ACCESS_TOKEN_SANDBOX: 'TEST-segredo-abc', MP_ACCESS_TOKEN_PROD: 'APP_USR-segredo-xyz', MP_WEBHOOK_SECRET: 'whsec' };
    const d = await diagnosticoMP(env);
    const txt = JSON.stringify(d);
    assert.equal(txt.includes('segredo-abc') || txt.includes('segredo-xyz') || txt.includes('whsec'), false);
    assert.equal(d.modo_efetivo, 'sandbox');
    assert.equal(d.cobra_de_verdade, false);
  } finally { globalThis.fetch = real; }
});
