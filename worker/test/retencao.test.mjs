/**
 * Testes da retencao. Nao tocam rede — exercitam as decisoes de politica, que
 * sao a parte que pode ficar errada em silencio por meses.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { _politica, isoDiasAtras } from '../src/retencao.js';

test('a politica esta nos numeros que foram documentados', () => {
  // Se alguem mudar um destes sem pensar, o teste avisa. Sao promessas
  // publicas, nao constantes quaisquer.
  assert.equal(_politica.DIAS_ALERTAS, 180);
  assert.equal(_politica.MESES_INATIVIDADE, 24);
});

test('a data de corte fica no passado e na distancia certa', () => {
  const corte = new Date(isoDiasAtras(180));
  const agora = Date.now();
  const dias = (agora - corte.getTime()) / 86400000;

  assert.ok(corte.getTime() < agora, 'corte tem que ser passado');
  // Tolerancia de 1 dia cobre a virada de horario durante o teste.
  assert.ok(dias > 179 && dias < 181, `esperado ~180 dias, veio ${dias}`);
});

test('corte de inatividade e mais antigo que o de alertas', () => {
  // Invariante de politica: uma conta viva nao pode ser considerada inativa
  // antes de os alertas dela terem expirado. Se alguem inverter os numeros,
  // a varredura passaria a apagar conta de gente ativa.
  const alertas = new Date(isoDiasAtras(_politica.DIAS_ALERTAS)).getTime();
  const inativas = new Date(isoDiasAtras(_politica.MESES_INATIVIDADE * 30)).getTime();
  assert.ok(inativas < alertas, 'inatividade tem que ser corte mais antigo');
});

test('zero dias devolve praticamente agora', () => {
  const d = new Date(isoDiasAtras(0)).getTime();
  assert.ok(Math.abs(Date.now() - d) < 5000);
});
