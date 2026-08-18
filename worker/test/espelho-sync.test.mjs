/**
 * O espelho carrega o carimbo de sincronizacao — e avisa quando o dado e velho.
 *
 * Motivo clinico (sessao de 18/08, pergunta do Bruno sobre cache/localStorage):
 * o espelho mostra o dado do SERVIDOR. Registro feito offline e ainda nao
 * sincronizado nao aparece. Sem carimbo, o profissional nao distingue "sem
 * sintomas esta semana" de "sem sincronizacao esta semana" — e tomar o
 * silencio da sync por silencio clinico e o erro que a fronteira ("ausencia
 * de alerta != ausencia de risco") existe pra evitar.
 *
 * O que se trava aqui:
 *   1. o worker devolve `sincronizado_em` no /api/spectator-state
 *   2. o banner do espelho renderiza a idade do dado
 *   3. dado com mais de 24h vira aviso explicito, nao nota de rodape
 *   4. carimbo ausente e tratado como "desconhecido" (velho), nunca como fresco
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const PRO = readFileSync(new URL('../src/pro.js', import.meta.url), 'utf8');
const INDEX = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');

test('o worker devolve sincronizado_em no spectator-state', () => {
  const bloco = PRO.slice(PRO.indexOf('handleSpectatorState'));
  assert.match(bloco, /sincronizado_em:\s*row\.updated_at/,
    'o carimbo tem que vir do updated_at do app_state — e a hora real da ultima sync');
});

test('o banner do espelho guarda e renderiza o carimbo', () => {
  assert.match(INDEX, /sincronizado_em:\s*data\.sincronizado_em/,
    'o contexto do spectator tem que capturar o carimbo da resposta');
  assert.match(INDEX, /_idadeSincronizacao/,
    'o banner tem que calcular a idade do dado');
});

test('dado velho (>24h) vira aviso explicito', () => {
  const fn = INDEX.slice(INDEX.indexOf('function _idadeSincronizacao'), INDEX.indexOf('function _renderSpectatorBanner'));
  // acima de 24h -> velho:true, e o banner escreve o aviso de registros pendentes
  assert.match(fn, /velho:\s*true/, 'falta o estado "velho" na idade da sincronizacao');
  assert.match(INDEX, /pode haver registros ainda não sincronizados/,
    'o aviso de registros pendentes sumiu do banner');
});

test('carimbo ausente e tratado como desconhecido, nunca como fresco', () => {
  const fn = INDEX.slice(INDEX.indexOf('function _idadeSincronizacao'), INDEX.indexOf('function _renderSpectatorBanner'));
  // if(!iso) -> desconhecida + velho:true. Assumir "fresco" sem carimbo seria
  // mentir pro medico no caso em que menos se sabe.
  const semIso = fn.slice(fn.indexOf('if(!iso)'), fn.indexOf('if(!iso)') + 120);
  assert.match(semIso, /desconhecida/, 'sem carimbo tem que dizer "desconhecida"');
  assert.match(semIso, /velho:\s*true/, 'sem carimbo tem que ser tratado como velho (conservador)');
});
