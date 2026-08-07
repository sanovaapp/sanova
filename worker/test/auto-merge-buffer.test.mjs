/**
 * Regressao do portao de auto-merge.
 *
 * O bug: `execFileSync` do Node tem maxBuffer padrao de 1 MB. O `index.html`
 * do Sanova tem mais que isso sozinho, entao `git show ref:index.html`
 * estourava com ENOBUFS e o portao falhava em TODA PR que tocasse o app — a
 * PR onde ele mais importa.
 *
 * Falhou silenciosamente no sentido que importa: o job ficava vermelho, mas a
 * mensagem era um dump de 1 MB do proprio HTML, entao a causa nao saltava aos
 * olhos.
 *
 * Este teste nao exercita o script inteiro (precisaria de token e de uma PR
 * real). Exercita a UNICA coisa que quebrou: ler um arquivo grande do git.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';

const RAIZ = new URL('../../', import.meta.url).pathname;

test('index.html passa de 1 MB — o padrao do Node nao serve', () => {
  const bytes = statSync(RAIZ + 'index.html').size;
  assert.ok(
    bytes > 1024 * 1024,
    `index.html tem ${bytes} bytes; se encolher abaixo de 1 MB este teste perde o sentido`,
  );
});

test('ler index.html do git com o maxBuffer do auto-merge funciona', () => {
  const conteudo = execFileSync('git', ['show', 'HEAD:index.html'], {
    cwd: RAIZ,
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
  });
  assert.ok(conteudo.includes('SANOVA_VERSION'), 'leu o arquivo inteiro');
});

test('com o padrao de 1 MB, a mesma leitura estoura', () => {
  // Guarda a premissa: se um dia o Node mudar o padrao, este teste vira
  // vermelho e alguem revisita o comentario no auto-merge.mjs.
  assert.throws(
    () =>
      execFileSync('git', ['show', 'HEAD:index.html'], {
        cwd: RAIZ,
        encoding: 'utf8',
        maxBuffer: 1024 * 1024,
      }),
    /ENOBUFS|maxBuffer/,
  );
});
