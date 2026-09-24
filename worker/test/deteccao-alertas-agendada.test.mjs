/**
 * Guarda a deteccao de alertas agendada.
 *
 * De 07/08 a 14/08 o sistema ficou num estado pior que desligado: a flag
 * FASE2_ALERTAS_ATIVA estava `true` e o painel do profissional MOSTRAVA a
 * secao de alertas, mas o cron que os GERA seguia comentado. Painel vazio nao
 * le como "a deteccao nao rodou" — le como "o paciente esta bem".
 *
 * O teste existe pra que essa combinacao nunca mais passe despercebida.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

const raiz = new URL('../../', import.meta.url).pathname;
const wf = parse(readFileSync(raiz + '.github/workflows/run-alert-detection.yml', 'utf8'));
const pro = readFileSync(raiz + 'pro.html', 'utf8');
const alerts = readFileSync(raiz + 'worker/src/alerts.js', 'utf8');

// `on:` vira booleano true no YAML 1.1 — por isso o fallback.
const gatilhos = wf.on || wf[true];

test('a deteccao roda por cron, nao so por disparo manual', () => {
  assert.ok(gatilhos.schedule, 'o schedule sumiu — o painel voltaria a mentir');
  assert.ok(gatilhos.schedule.length >= 1);
});

test('roda 1x por dia — nem menos, nem varias', () => {
  const cron = gatilhos.schedule[0].cron;
  const [min, hora, ...resto] = cron.split(/\s+/);
  assert.match(min, /^\d+$/, 'minuto tem que ser fixo');
  assert.match(hora, /^\d+$/, 'hora fixa: varias vezes ao dia so multiplica custo');
  assert.deepEqual(resto, ['*', '*', '*'], 'todo dia');
});

test('INVARIANTE: painel ligado exige deteccao agendada', () => {
  // Esta e a regra que faltou entre 07/08 e 14/08. Se alguem religar a flag
  // sem o cron — ou comentar o cron com a flag ligada — quebra aqui.
  const painelLigado = /FASE2_ALERTAS_ATIVA\s*=\s*true/.test(pro);
  if (painelLigado) {
    assert.ok(
      gatilhos.schedule,
      'FASE2_ALERTAS_ATIVA=true sem cron de deteccao: o profissional veria ' +
      'painel vazio e concluiria que nao ha risco',
    );
  }
});

test('a dedup mais curta suporta o intervalo diario', () => {
  // Se alguem baixar uma dedup pra menos de 12h, o mesmo alerta poderia
  // reaparecer — e alerta repetido ensina o profissional a ignorar alerta.
  const horas = [...alerts.matchAll(/dedup_horas:\s*(\d+)/g)].map((m) => +m[1]);
  assert.ok(horas.length === 10, `esperado 10 alertas, achei ${horas.length}`);
  assert.ok(Math.min(...horas) >= 12, 'dedup menor que 12h com cron diario gera repetido');
});

test('todo alerta vermelho tem dedup de pelo menos 12h', () => {
  // Vermelho repetido e pior que amarelo repetido: e o que o profissional
  // precisa levar a serio.
  const bloco = alerts.slice(alerts.indexOf('ALERT_KEYS = {'), alerts.indexOf('const RED_KEYS'));
  const re = /severity:\s*'red'[\s\S]{0,200}?dedup_horas:\s*(\d+)/g;
  const vermelhos = [...bloco.matchAll(re)].map((m) => +m[1]);
  assert.ok(vermelhos.length >= 5, `esperado ao menos 5 vermelhos, achei ${vermelhos.length}`);
  assert.ok(Math.min(...vermelhos) >= 12);
});
