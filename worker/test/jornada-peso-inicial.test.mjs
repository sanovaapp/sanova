/**
 * Regressao do bug "20 vs 21 kg" (relatado pelo Bruno, corrigido 07/08/2026).
 *
 * O app tinha DUAS fontes de verdade pro peso inicial:
 *
 *   - peso DECLARADO na anamnese (S.profile.weightStartKg) — usado pelo
 *     painel, historico, marcos e grafico
 *   - primeira PESAGEM registrada (S.weights[0]) — usado pelos cards de
 *     compartilhar
 *
 * Divergem sempre que a pessoa comeca o tratamento e so registra a primeira
 * pesagem dias depois, ja tendo perdido algo. O painel dizia "perdeu 21 kg" e
 * o card dizia 20.
 *
 * Pior que divergencia interna: o card e a peca que vai pro Instagram. Numero
 * de peso publicado que contradiz o proprio app e erro que o paciente enxerga.
 *
 * O teste recorta calcJornadaStats do index.html e roda contra um cenario
 * realista. Nao precisa de navegador.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const INDEX = new URL('../../index.html', import.meta.url).pathname;

function carregarCalcJornada() {
  const html = readFileSync(INDEX, 'utf8');
  const inicio = html.indexOf('function calcJornadaStats()');
  assert.ok(inicio > 0, 'calcJornadaStats sumiu do index.html');
  const marcador = html.indexOf("catch(e){ console.warn('[ShareJornada]", inicio);
  const fim = html.indexOf('\n  }', marcador);
  return html.slice(inicio, fim + 4);
}

// Paciente declara 110 kg no inicio do tratamento (01/01) e so pisa na
// balanca 5 dias depois, ja com 109. Hoje esta com 89.
//   verdade: 110 - 89 = 21 kg em 151 dias
//   bug:     109 - 89 = 20 kg em 146 dias
const CENARIO = {
  profile: { weightStartKg: 110, startDate: '2026-01-01' },
  caneta: { inicio: '2026-01-01' },
  weights: [
    { date: '2026-01-06', weight: 109 },
    { date: '2026-03-01', weight: 98 },
    { date: '2026-06-01', weight: 89 },
  ],
};

function rodar(estado) {
  globalThis.window = { S: estado };
  const calc = new Function(carregarCalcJornada() + '; return calcJornadaStats;')();
  return calc();
}

test('o card usa o peso DECLARADO, nao a primeira pesagem', () => {
  const r = rodar(CENARIO);
  assert.equal(r.pesoInicio, 110, 'era pra usar o declarado (110), nao a pesagem (109)');
});

test('a perda do card bate com a que o painel mostra', () => {
  const r = rodar(CENARIO);
  const painel = CENARIO.profile.weightStartKg - 89;
  assert.equal(Math.abs(r.deltaTotal), painel, `card ${Math.abs(r.deltaTotal)} vs painel ${painel}`);
});

test('os dias contam da mesma data que deu o peso inicial', () => {
  // Senao "perdeu X em N dias" mistura um X do peso declarado com um N da
  // primeira pesagem — dois numeros de origens diferentes na mesma frase.
  const r = rodar(CENARIO);
  assert.equal(r.dias, 151, '01/01 ate 01/06');
});

test('a linha do grafico comeca no mesmo valor do numero impresso', () => {
  const r = rodar(CENARIO);
  assert.equal(r.pesoSerie.length, 4, 'ganhou o ponto inicial declarado');
  assert.equal(r.pesoSerie[0].weight, 110);
});

test('sem peso declarado, cai na primeira pesagem sem quebrar', () => {
  const semDeclarado = {
    profile: {},
    caneta: {},
    weights: [
      { date: '2026-01-06', weight: 109 },
      { date: '2026-06-01', weight: 89 },
    ],
  };
  const r = rodar(semDeclarado);
  assert.equal(r.pesoInicio, 109);
  assert.equal(Math.abs(r.deltaTotal), 20);
});

test('pesagem anterior ao inicio declarado nao e sobrescrita', () => {
  // Pessoa que ja pesava no app antes de comecar o tratamento: a pesagem
  // anterior manda, senao a jornada comecaria depois do que ela viveu.
  const pesouAntes = {
    profile: { weightStartKg: 110, startDate: '2026-02-01' },
    caneta: {},
    weights: [
      { date: '2026-01-06', weight: 112 },
      { date: '2026-06-01', weight: 89 },
    ],
  };
  const r = rodar(pesouAntes);
  assert.equal(r.pesoInicio, 112, 'a pesagem anterior ao inicio declarado prevalece');
});
