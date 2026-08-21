/**
 * Onda 2b (v3.10.76) — a aba Medicação segue o preview 1 aprovado pelo Bruno:
 * card de status compacto + CTA + Estoque/Local + accordions fechados.
 * "Colapsa, nunca some": calculadora, protocolo, dose esquecida e histórico
 * continuam inteiros atrás de um toque — e o gauge de saciedade + curva PK
 * mudaram de casa (Painel -> accordion "Potência e saciedade" da Medicação).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const INDEX = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');

test('as pecas do preview existem: CTA, Estoque/Local e os 4 accordions', () => {
  for (const id of ['medCtaRegistrar', 'medInfoCard', 'medRowEstoque', 'medRowLocal',
                    'calcAccWrap', 'potAccWrap', 'entAccWrap', 'histAccWrap', 'chPill']) {
    assert.match(INDEX, new RegExp('id="' + id + '"'), 'peca do preview sumiu: ' + id);
  }
});

test('a calculadora mora DENTRO do accordion (colapsa, nunca some)', () => {
  const abre = INDEX.indexOf('id="calcAccWrap"');
  const calc = INDEX.indexOf('class="calc-hero"');
  const fecha = INDEX.indexOf('/calcAccWrap');
  assert.ok(abre > 0 && calc > 0 && fecha > 0, 'accordion do calculo sumiu');
  assert.ok(abre < calc && calc < fecha,
    'a calculadora saiu do accordion — a aba volta a abrir com 3.600px de rolagem');
});

test('protocolo e dose esquecida moram no "Entenda seu medicamento"', () => {
  const abre = INDEX.indexOf('id="entAccWrap"');
  const esc = INDEX.indexOf('id="escCard"');
  const esq = INDEX.indexOf('id="esqCard"');
  const fecha = INDEX.indexOf('/entAccWrap');
  assert.ok(abre < esc && esc < esq && esq < fecha,
    'escCard/esqCard sairam do accordion Entenda');
});

test('gauge + curva PK moram na Medicação, nao mais no hero do Painel', () => {
  const sac = INDEX.indexOf('id="heroSacWrap"');
  const canetaIni = INDEX.indexOf('id="sec-caneta"');
  const canetaFim = INDEX.indexOf('id="sec-exercicio"');
  assert.ok(sac > canetaIni && sac < canetaFim,
    'heroSacWrap saiu da sec-caneta — os graficos de potencia ficaram sem casa');
  assert.equal((INDEX.match(/id="heroSacWrap"/g) || []).length, 1,
    'heroSacWrap duplicado — dois canvas com o mesmo id quebram o Chart');
});

test('o atalho de registrar abre o accordion ANTES de rolar pro checklist', () => {
  const i = INDEX.indexOf('function registrarAplicacaoHoje');
  const trecho = INDEX.slice(i, i + 2500);
  assert.match(trecho, /abrirCalcAcc/,
    'o desvio do checklist nao abre mais o accordion — paciente cai numa tela fechada');
});
