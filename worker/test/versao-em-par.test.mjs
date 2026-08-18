/**
 * SANOVA_VERSION (index.html) e VERSION (sw.js) sobem JUNTOS — sempre.
 *
 * Por que isso e trava e nao lembrete: o service worker so troca o cache
 * quando o `VERSION` dele muda. Subir o app e esquecer o sw.js prende o
 * paciente na versao velha (ja aconteceu, custou uma noite — cicatriz no
 * DECISOES.md). Subir o sw.js e esquecer o app forca re-download a toa.
 *
 * Ate 18/08 a regra era so texto no DECISOES. Regra escrita nao segura
 * esquecimento humano — a licao da sessao de cache/sync (pergunta do Bruno:
 * "qual o risco de um cache atrasado dar informacao errada?"). Este arquivo
 * transforma a regra em portao: divergiu, a suite quebra antes do deploy.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const INDEX = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const SW = readFileSync(new URL('../../sw.js', import.meta.url), 'utf8');

function versaoDoApp() {
  const m = INDEX.match(/var SANOVA_VERSION\s*=\s*'([^']+)'/);
  return m && m[1];
}

function versaoDoSw() {
  // O sw.js escreve 'sanova-vX.Y.Z' — o prefixo faz parte do nome do cache.
  const m = SW.match(/const VERSION\s*=\s*'sanova-v([^']+)'/);
  return m && m[1];
}

test('as duas versoes existem nos lugares esperados', () => {
  assert.ok(versaoDoApp(), 'SANOVA_VERSION sumiu do index.html');
  assert.ok(versaoDoSw(), "VERSION do sw.js sumiu ou perdeu o prefixo 'sanova-v'");
});

test('index.html e sw.js declaram a MESMA versao', () => {
  const app = versaoDoApp();
  const sw = versaoDoSw();
  assert.equal(
    sw,
    app,
    `index.html diz ${app} e sw.js diz ${sw} — paciente vai ficar preso em cache. ` +
    'Suba os dois juntos, sempre.',
  );
});

test('a versao tem formato X.Y.Z', () => {
  // Guarda contra typo no numero (ex.: '3.10.6 4') que quebraria a
  // comparacao do handshake WHO do service worker em silencio.
  assert.match(versaoDoApp(), /^\d+\.\d+\.\d+$/);
});
