/**
 * O painel profissional e o app tem que usar a MESMA chave publica do Supabase.
 *
 * Achado em 26/11/2026: pro.html carregava uma chave antiga, ja invalidada.
 * Todo profissional que clicava no link de acesso caia de volta no login,
 * sem mensagem. A simulacao mostrou; ninguem tinha visto porque o app do
 * paciente (index.html) ja usava a chave nova.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ler = (f) => readFileSync(new URL('../../' + f, import.meta.url), 'utf8');
const chaves = (s) => [...new Set(s.match(/sb_publishable_[A-Za-z0-9_-]+/g) || [])];

test('pro.html, index.html e admin usam a mesma chave publicavel', () => {
  const app = chaves(ler('index.html'));
  assert.equal(app.length, 1, 'index.html deveria ter exatamente uma chave publicavel');
  for (const f of ['pro.html', 'admin/index.html']) {
    assert.deepEqual(chaves(ler(f)), app, f + ' com chave diferente do app');
  }
});

test('nenhuma pagina carrega chave antiga em formato JWT', () => {
  for (const f of ['pro.html', 'index.html', 'admin/index.html']) {
    assert.equal(/eyJhbGciOi[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{20,}/.test(ler(f)), false, f + ' ainda tem chave JWT antiga');
  }
});
