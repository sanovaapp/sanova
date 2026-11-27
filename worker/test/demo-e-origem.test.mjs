/**
 * Pacientes de demonstracao e registro de origem do profissional.
 *
 * O ponto sensivel: o painel de um profissional sem pacientes mostra contas
 * FICTICIAS. Se a trava falhar, dado de paciente real apareceria pra qualquer
 * profissional. Estes testes existem pra isso nao acontecer em silencio.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ehPacienteDemo, limpaOrigem } from '../src/pro.js';

test('so as tres contas ficticias contam como paciente de demonstracao', () => {
  for (const e of ['demo@sanova.app', 'joao.demo@sanova.app', 'carla.demo@sanova.app', ' Carla.Demo@Sanova.app ']) {
    assert.equal(ehPacienteDemo(e), true, e);
  }
  for (const e of ['paciente@gmail.com', 'demo@sanova.app.br', 'x.demo@sanova.app', 'dra.ana.demo@sanova.app', '', null, undefined, 42]) {
    assert.equal(ehPacienteDemo(e), false, String(e));
  }
});

test('lista de demonstracao: so sem vinculo proprio, e filtrando por conta ficticia', () => {
  const src = readFileSync(new URL('../src/pro.js', import.meta.url), 'utf8');
  const i = src.indexOf('export async function handleProPatients(');
  const f = src.slice(i, i + 2200);
  assert.ok(f.includes('if (links.length === 0) {'), 'demo so pode entrar com zero vinculo proprio');
  assert.ok(f.includes('if (demo && !ehPacienteDemo(email)) continue;'), 'falta o filtro de conta ficticia');
});

test('espelho: vinculo de outro profissional so abre se for a demonstracao E conta ficticia', () => {
  const src = readFileSync(new URL('../src/pro.js', import.meta.url), 'utf8');
  const i = src.indexOf('export async function handleSpectatorState(');
  const f = src.slice(i, i + 2400);
  const j = f.indexOf('if (link.professional_id !== ctx.pro.id) {');
  assert.ok(j > 0);
  const bloco = f.slice(j, j + 700);
  assert.ok(bloco.includes('link.professional_id !== demoId'), 'falta checar que o vinculo e do profissional de demonstracao');
  assert.ok(bloco.includes('!ehPacienteDemo(emailDemo)'), 'falta checar que o paciente e conta ficticia');
  assert.equal((bloco.match(/error: 'forbidden'/g) || []).length, 2);
});

test('origem: so chaves conhecidas, texto curto, sem caractere estranho', () => {
  const o = limpaOrigem({
    utm_source: 'instagram', utm_campaign: 'medicos-teste-1', cta: 'hero',
    utm_content: '<script>alert(1)</script>', outra: 'x', utm_term: 'a'.repeat(200), utm_medium: 123,
  });
  assert.deepEqual(Object.keys(o).sort(), ['cta', 'utm_campaign', 'utm_content', 'utm_source', 'utm_term']);
  assert.equal(o.utm_source, 'instagram');
  assert.equal(/[<>()/]/.test(o.utm_content), false);
  assert.equal(o.utm_term.length, 80);
});

test('origem vazia ou invalida vira null (nao grava lixo)', () => {
  for (const v of [null, undefined, 'texto', 42, {}, { utm_source: '' }, { nada: 'x' }]) assert.equal(limpaOrigem(v), null);
});

test('painel envia a origem no cadastro e avisa quando os pacientes sao ficticios', () => {
  const html = readFileSync(new URL('../../pro.html', import.meta.url), 'utf8');
  assert.ok(html.includes('origem: lerOrigem()'));
  assert.ok(html.includes('Pacientes de demonstração.'));
});
