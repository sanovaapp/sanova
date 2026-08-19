/**
 * A escolha do token do Mercado Pago erra pro lado seguro: NAO cobrar de
 * verdade sem alguem mandar explicitamente.
 *
 * Achado na verificacao de comercializacao (19/08): todo o codigo lia
 * `MP_ACCESS_TOKEN_SANDBOX || MP_ACCESS_TOKEN`, entao os pagamentos rodavam em
 * SANDBOX na producao — dinheiro real nunca passava — e o secret
 * MP_ACCESS_TOKEN_PROD ficava orfao, lido por ninguem. Pior: virar producao
 * exigiria APAGAR o secret sandbox, porque a precedencia `SANDBOX || ...`
 * ganhava sempre. Num sistema que cobra, o default seguro e sandbox, e virar
 * producao tem que ser um ato deliberado (MP_MODE=prod), nunca acidente.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mpToken } from '../src/mp.js';

test('padrao (sem MP_MODE) usa o token sandbox', () => {
  const env = { MP_ACCESS_TOKEN_SANDBOX: 'TEST-abc', MP_ACCESS_TOKEN_PROD: 'APP_USR-xyz' };
  assert.equal(mpToken(env), 'TEST-abc');
});

test('MP_MODE diferente de "prod" continua sandbox (nada de meio-termo)', () => {
  for (const modo of ['', 'sandbox', 'teste', 'PROD ', 'production']) {
    const env = { MP_MODE: modo, MP_ACCESS_TOKEN_SANDBOX: 'TEST-abc', MP_ACCESS_TOKEN_PROD: 'APP_USR-xyz' };
    assert.equal(mpToken(env), 'TEST-abc', `modo "${modo}" deveria cair no sandbox`);
  }
});

test('MP_MODE=prod usa o token de producao', () => {
  const env = { MP_MODE: 'prod', MP_ACCESS_TOKEN_SANDBOX: 'TEST-abc', MP_ACCESS_TOKEN_PROD: 'APP_USR-xyz' };
  assert.equal(mpToken(env), 'APP_USR-xyz');
});

test('MP_MODE=prod SEM token de producao LANCA — nunca cai pro sandbox escondido', () => {
  // O pior cenario: alguem liga producao mas esquece o token. O sistema tem
  // que RECUSAR, nao cobrar em sandbox achando que esta cobrando de verdade
  // (ou pior, o contrario). Falha alta e melhor que cobranca fantasma.
  const env = { MP_MODE: 'prod', MP_ACCESS_TOKEN_SANDBOX: 'TEST-abc' };
  assert.throws(() => mpToken(env), /MP_ACCESS_TOKEN_PROD ausente/);
});

test('sem nenhum token, sandbox tambem lanca', () => {
  assert.throws(() => mpToken({}), /MP_ACCESS_TOKEN_SANDBOX ausente/);
});
