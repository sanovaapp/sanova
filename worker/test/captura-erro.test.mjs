/**
 * Guarda a captura de erro em producao.
 *
 * Ate 14/08/2026 o app nao capturava excecao nenhuma: zero window.onerror,
 * zero unhandledrejection, e o `captureException` do PostHog disponivel e
 * nunca chamado. Quando quebrava na mao de um paciente, ele fechava o app e
 * ninguem ficava sabendo.
 *
 * Estes testes rodam contra o texto do index.html — nao ha navegador aqui.
 * O que eles travam e o que pode se perder num refactor distraido.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const APP = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');

test('os dois ouvintes de erro existem', () => {
  assert.match(APP, /addEventListener\(\s*'error'/, 'falta o ouvinte de erro solto');
  assert.match(APP, /addEventListener\(\s*'unhandledrejection'/, 'falta o ouvinte de promise rejeitada');
});

test('o reporte passa pelo captureException do PostHog', () => {
  assert.match(APP, /posthog\.captureException\(/);
});

test('o reporte respeita o opt-out de analytics', () => {
  // Recorta so a funcao de reporte e confere que ela olha a flag. Sem isso,
  // quem desligou analytics continuaria mandando excecao — e excecao pode
  // carregar valor que o paciente digitou.
  const i = APP.indexOf('window.Sanova.reportarErro');
  assert.ok(i > 0, 'reportarErro sumiu');
  const fn = APP.slice(i, i + 1200);
  assert.match(fn, /analyticsOptOut\s*===\s*true/, 'reportarErro nao checa o opt-out');
});

test('o reporte nao manda estado do paciente junto', () => {
  const i = APP.indexOf('window.Sanova.reportarErro');
  const fn = APP.slice(i, APP.indexOf('addEventListener', i));

  // O contexto enviado tem que ser so metadado. Se alguem incluir o estado,
  // sobe dado de saude pra um servico de analytics.
  for (const proibido of ['S.weights', 'S.daily', 'S.profile.weightKg', 'JSON.stringify(S)']) {
    assert.ok(!fn.includes(proibido), `reportarErro nao pode enviar ${proibido}`);
  }
});

test('falha do proprio reporte nao derruba o app', () => {
  const i = APP.indexOf('window.Sanova.reportarErro');
  const fn = APP.slice(i, APP.indexOf('addEventListener', i));
  assert.match(fn, /catch\s*\(/, 'reportarErro precisa engolir o proprio erro');
});
