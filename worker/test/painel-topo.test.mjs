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

test('Onda 4c: o Painel tem as 3 abas do preview e o hero da medicacao nao volta', () => {
  // v3.10.77 — Bruno: "quero igual [ao preview 4]". O hero da medicacao saiu
  // do Painel (o conteudo mora na aba Medicacao); heroAtivo fica no DOM so
  // como moradia oculta de elementos legados.
  for (const id of ['pAguaWrap', 'pProtWrap', 'pRefWrap']) {
    assert.match(INDEX, new RegExp('id="' + id + '"'), 'aba oculta do Painel sumiu: ' + id);
  }
  assert.ok(!INDEX.includes('medDetalheToggle'),
    'o accordion de medicacao voltou ao Painel — preview 4 nao tem esse bloco');
  const hero = INDEX.indexOf('id="heroAtivo"');
  const trecho = INDEX.slice(hero, hero + 120);
  assert.match(trecho, /display:none/, 'heroAtivo visivel de novo no Painel');
  // dentro das abas: pilares na Protecao, registro na Refeicao
  assert.ok(INDEX.indexOf('id="quatroGauges"') > INDEX.indexOf('id="pProtWrap"'),
    'quatroGauges fora da aba Protecao muscular');
  assert.ok(INDEX.indexOf('id="cardRegistroRefeicao"') > INDEX.indexOf('id="pRefWrap"'),
    'cardRegistroRefeicao fora da aba Registrar refeicao');
});

test('o peso do topo reusa a regra do inicio declarado (bug dos 20vs21kg)', () => {
  const i = INDEX.indexOf('function renderPainelTop(){');
  assert.ok(i > 0, 'renderPainelTop sumiu');
  const trecho = INDEX.slice(i, i + 2500);
  assert.match(trecho, /weightStartKg/,
    'o delta do peso-heroi deixou de usar o peso declarado no perfil — volta o bug do total errado');
});
