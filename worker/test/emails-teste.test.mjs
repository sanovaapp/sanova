/**
 * E-mails automaticos do teste gratis.
 * Trava: quem recebe o que e quando, sem repeticao, e o que o texto promete.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { proximoEmail, montarEmail, dataDaCobranca, handleAdminEmailsTeste } from '../src/email.js';
import { FOLGA_DIAS, TESTE_PRO_DIAS } from '../src/mp.js';

const DIA = 86400000;
const INICIO = Date.parse('2026-12-01T12:00:00.000Z');
// teste de 14 dias: cobranca em 15/12; trial_ends_at guarda cobranca + folga
const sub = (extra) => ({
  plano: 'pro', status: 'trial',
  trial_started_at: new Date(INICIO).toISOString(),
  trial_ends_at: new Date(INICIO + (TESTE_PRO_DIAS + FOLGA_DIAS) * DIA).toISOString(),
  emails_enviados: {}, ...extra,
});
const dia = (n) => INICIO + n * DIA;

test('data da cobranca desconta a folga', () => {
  assert.equal(dataDaCobranca(sub()).toISOString(), new Date(INICIO + 14 * DIA).toISOString());
});

test('boas-vindas sai primeiro, uma vez so', () => {
  assert.equal(proximoEmail(sub(), dia(0) + 1000), 'boas_vindas');
  assert.equal(proximoEmail(sub({ emails_enviados: { boas_vindas: 'x' } }), dia(0) + 2000), null);
});

test('meio do teste: a partir do 6o dia, longe da vespera', () => {
  const s = sub({ emails_enviados: { boas_vindas: 'x' } });
  assert.equal(proximoEmail(s, dia(5)), null);
  assert.equal(proximoEmail(s, dia(6) + 1000), 'meio');
  assert.equal(proximoEmail(sub({ emails_enviados: { boas_vindas: 'x', meio: 'x' } }), dia(7)), null);
});

test('vespera: nos 2 dias antes da cobranca, uma vez so', () => {
  const s = sub({ emails_enviados: { boas_vindas: 'x', meio: 'x' } });
  assert.equal(proximoEmail(s, dia(11)), null);
  assert.equal(proximoEmail(s, dia(12) + 1000), 'vespera');
  assert.equal(proximoEmail(sub({ emails_enviados: { boas_vindas: 'x', meio: 'x', vespera: 'x' } }), dia(13)), null);
});

test('quem pulou o do meio recebe a vespera, e nao os dois seguidos', () => {
  const s = sub({ emails_enviados: { boas_vindas: 'x' } });
  assert.equal(proximoEmail(s, dia(12) + 1000), 'vespera');
  assert.equal(proximoEmail(sub({ emails_enviados: { boas_vindas: 'x', vespera: 'x' } }), dia(13)), null);
});

test('nao escreve pra quem nao esta em teste pro', () => {
  assert.equal(proximoEmail(sub({ status: 'active' }), dia(1)), null);
  assert.equal(proximoEmail(sub({ status: 'canceled' }), dia(1)), null);
  assert.equal(proximoEmail(sub({ plano: 'paciente' }), dia(1)), null);
  assert.equal(proximoEmail(sub(), dia(15)), null, 'teste ja terminou');
  assert.equal(proximoEmail(null, dia(1)), null);
});

test('textos: valor, data, como cancelar, fronteira clinica, sem promessa', () => {
  const d = { nome: 'Dra. Ana <b>', invite_code: 'SAN-ABCD', cobranca: new Date(INICIO + 14 * DIA) };
  for (const k of ['boas_vindas', 'meio', 'vespera']) {
    const m = montarEmail(k, d);
    assert.ok(m.subject && m.html, k);
    assert.ok(m.html.includes('15/12/2026'), k + ' sem a data da cobranca');
    assert.ok(m.html.includes('ausência de alerta não significa ausência de risco'), k + ' sem a fronteira clinica');
    assert.ok(m.html.includes('MEDFAST'), k + ' sem a empresa responsavel');
    assert.equal(m.html.includes('<b>'), false, k + ' deixou passar HTML do nome');
    for (const proibido of [/ozempic/i, /mounjaro/i, /wegovy/i, /saxenda/i, /garant/i, /comprovad/i, /emagre/i]) {
      assert.equal(proibido.test(m.html + m.subject), false, k + ' com termo proibido ' + proibido);
    }
  }
  for (const k of ['boas_vindas', 'vespera']) {
    const m = montarEmail(k, d);
    assert.ok(m.html.includes('R$ 247'), k + ' sem o valor');
    assert.ok(m.html.includes('Cancelar assinatura'), k + ' sem dizer como cancelar');
  }
  assert.equal(montarEmail('outra', d), null);
});

test('sem a chave do Resend: nao envia nada, so conta os devidos, e nao vaza e-mail', async () => {
  const real = globalThis.fetch;
  const chamadas = [];
  globalThis.fetch = async (url) => {
    chamadas.push(String(url));
    return { ok: true, status: 200, json: async () => [sub({ user_id: 'u1' })], text: async () => '' };
  };
  try {
    const r = await handleAdminEmailsTeste(new Request('https://x/api/admin-emails-teste'), { SUPABASE_SERVICE_ROLE_KEY: 'k' });
    const j = await r.json();
    assert.equal(j.motivo, 'sem_chave');
    assert.deepEqual(j.devidos, { boas_vindas: 1 });
    assert.deepEqual(j.enviados, {});
    assert.equal(chamadas.some((u) => u.includes('api.resend.com')), false);
    assert.equal(JSON.stringify(j).includes('@'), false);
  } finally { globalThis.fetch = real; }
});
