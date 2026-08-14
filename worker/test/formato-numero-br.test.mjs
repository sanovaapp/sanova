/**
 * Numero decimal em portugues leva virgula: "20,5 kg", nao "20.5 kg".
 *
 * Achado em 07/08/2026 enquanto se cacava o bug do peso. O app e brasileiro e
 * mostrava ponto na maioria das telas — 34 dos 52 usos de toFixed() escapavam
 * sem conversao. Nao era excecao, era a regra.
 *
 * A causa e estrutural: cada tela decidia sozinha se convertia ou nao. Enquanto
 * a decisao for local, ela volta a divergir na proxima tela que alguem escrever.
 * A correcao e ter UM caminho — nBR() — e migrar as telas em levas verificaveis.
 *
 * Esta e a leva das telas de PESO (kg). As telas de agua, kcal e IMC ainda usam
 * o caminho antigo e entram nas proximas levas — o segundo teste aqui e o que
 * garante que a leva ja feita nao regride.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const INDEX = new URL('../../index.html', import.meta.url).pathname;
const html = readFileSync(INDEX, 'utf8');

function carregarNBR() {
  const linha = html.split('\n').find(l => l.startsWith('function nBR(x,n){'));
  assert.ok(linha, 'nBR() sumiu do index.html');
  return new Function(linha + '; return nBR;')();
}

const nBR = carregarNBR();

test('decimal sai com virgula, nao com ponto', () => {
  assert.equal(nBR(20.5, 1), '20,5');
  assert.equal(nBR(89.34, 1), '89,3');
  assert.equal(nBR(0.75, 2), '0,75');
  // O caso que o paciente ve no card de compartilhar.
  assert.equal(nBR(21, 1), '21,0');
});

test('uma casa decimal e o padrao — peso e o uso dominante', () => {
  assert.equal(nBR(72.46), '72,5');
});

test('toFixed(0) nao inventa virgula onde nao ha decimal', () => {
  assert.equal(nBR(1750, 0), '1750');
});

test('valor invalido vira 0 em vez de "NaN" na tela do paciente', () => {
  // Antes, um peso ausente imprimia literalmente "NaN kg". Numero quebrado
  // numa tela de saude e pior que numero ausente.
  for (const lixo of [undefined, null, NaN, Infinity, '', 'abc']) {
    assert.equal(nBR(lixo, 1), '0,0', `falhou para ${String(lixo)}`);
  }
});

test('aceita numero em string, que e como o input do peso chega', () => {
  assert.equal(nBR('83.7', 1), '83,7');
});

test('nenhuma tela de peso voltou a imprimir ponto', () => {
  // Guarda de regressao da leva: se alguem escrever uma tela nova de kg com
  // toFixed cru, este teste quebra antes de chegar no paciente.
  const suspeitas = html.split('\n')
    .map((linha, i) => ({ n: i + 1, linha }))
    .filter(({ linha }) =>
      /\.toFixed\([12]\)/.test(linha) &&
      /kg/i.test(linha) &&
      !/replace\(\s*['"]\.['"]\s*,/.test(linha) &&
      !linha.trimStart().startsWith('//'));

  assert.deepEqual(
    suspeitas.map(s => s.n), [],
    'linhas de kg com toFixed cru (use nBR):\n' +
      suspeitas.map(s => `  ${s.n}: ${s.linha.trim().slice(0, 110)}`).join('\n')
  );
});
