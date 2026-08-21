/**
 * Onda 4b (v3.10.75) — o topo do Painel segue o preview 4 aprovado pelo Bruno:
 * peso-heroi + KPIs (proxima dose · proteina) + CTA de check-in, com o hero
 * da medicacao colapsado num accordion ("colapsa, nunca some").
 *
 * Estes asserts sao estruturais: se alguem remover o hook do renderPainelTop
 * ou tirar o heroAtivo de dentro do accordion, o teste acusa antes do deploy.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const INDEX = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');

test('o bloco painelTop existe com as 4 pecas do preview aprovado', () => {
  assert.match(INDEX, /id="painelTop"/, 'container painelTop sumiu');
  for (const id of ['pHeroPeso', 'pHeroPesoDelta', 'pTileDose', 'pTileProt', 'pCtaCheckin']) {
    assert.match(INDEX, new RegExp('id="' + id + '"'), 'peca do topo sumiu: ' + id);
  }
});

test('renderHero chama renderPainelTop (blindado) — sem o hook o topo congela', () => {
  const i = INDEX.indexOf('function renderHero(){');
  assert.ok(i > 0, 'renderHero sumiu');
  const trecho = INDEX.slice(i, i + 600);
  assert.match(trecho, /try\{ renderPainelTop\(\); \}catch\(e\)/,
    'o hook do renderPainelTop sumiu do renderHero — os numeros do topo nunca mais atualizam');
});

test('o heroAtivo mora DENTRO do accordion medDetalheWrap (colapsa, nunca some)', () => {
  const abre = INDEX.indexOf('id="medDetalheWrap"');
  const hero = INDEX.indexOf('id="heroAtivo"');
  const fecha = INDEX.indexOf('/medDetalheWrap');
  assert.ok(abre > 0 && hero > 0 && fecha > 0, 'accordion da medicacao sumiu');
  assert.ok(abre < hero && hero < fecha,
    'heroAtivo saiu de dentro do medDetalheWrap — a medicacao volta a ocupar o Painel inteiro');
});

test('o peso do topo reusa a regra do inicio declarado (bug dos 20vs21kg)', () => {
  const i = INDEX.indexOf('function renderPainelTop(){');
  assert.ok(i > 0, 'renderPainelTop sumiu');
  const trecho = INDEX.slice(i, i + 2500);
  assert.match(trecho, /weightStartKg/,
    'o delta do peso-heroi deixou de usar o peso declarado no perfil — volta o bug do total errado');
});
