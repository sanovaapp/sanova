/**
 * O monitor de versao (backlog.yml) tem que ser AUTO-REFERENTE.
 *
 * Historia (S5 da critica Grok, 18/08): a tabela do ESTADO.md dizia app 3.10.62
 * e worker 1.31.0 enquanto o ar estava em 3.10.63 / 1.31.1. Fato de estado
 * digitado a mao apodrece — e um documento de estado que mente e pior que nao
 * ter documento.
 *
 * O conserto nao foi corrigir o numero (isso apodrece de novo no proximo
 * release). Foi tirar o numero cravado dos dois monitores: `app_version` ja
 * derivava do index.html do repo; `worker_version` passou a derivar do
 * worker/src/index.js. A pergunta vira sempre a util — "o ar bate com o que a
 * gente mandou?" — em vez de um numero fixo que ninguem lembra de atualizar.
 *
 * Este teste trava esse padrao: se alguem cravar `expected` de novo no YAML, ou
 * quebrar a derivacao no executor, o teste cai antes de virar alarme falso.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const WORKER = readFileSync(new URL('../../.github/scripts/worker.mjs', import.meta.url), 'utf8');
const BACKLOG = readFileSync(new URL('../../automation/backlog.yml', import.meta.url), 'utf8');

test('worker_version deriva do repo quando nao ha expected', () => {
  // O executor tem que ler worker/src/index.js, igual app_version le index.html.
  const bloco = WORKER.slice(WORKER.indexOf('async worker_version'), WORKER.indexOf('async dispatch'));
  assert.match(bloco, /worker\/src\/index\.js/, 'worker_version tem que derivar do index.js do repo');
  assert.match(bloco, /RE_WORKER_VER/, 'falta o regex que extrai a versao do worker');
  assert.match(bloco, /no repo:/, 'a mensagem de erro tem que comparar ar vs repo, nao ar vs numero cravado');
});

test('o regex do worker casa o formato real da versao', () => {
  // Guarda contra o regex divergir do jeito que a versao e escrita no worker.
  const m = WORKER.match(/const RE_WORKER_VER = (\/.*\/);/);
  assert.ok(m, 'RE_WORKER_VER sumiu');
  const re = new RegExp(m[1].slice(1, -1));
  const idx = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
  const achou = idx.match(re);
  assert.ok(achou && achou[1], 'o regex nao acha a versao no worker/src/index.js');
  assert.match(achou[1], /^\d+\.\d+\.\d+$/, `versao em formato inesperado: ${achou && achou[1]}`);
});

test('os monitores de versao no backlog nao cravam numero a mao', () => {
  // O anti-padrao que causou o alarme falso: expected: "1.31.0" no YAML.
  // Recorta os dois monitores e garante que nenhum fixa a versao.
  for (const id of ['worker-no-ar', 'app-no-ar']) {
    const i = BACKLOG.indexOf(`id: ${id}`);
    assert.ok(i > 0, `monitor ${id} sumiu do backlog`);
    const bloco = BACKLOG.slice(i, i + 500);
    assert.ok(
      !/expected:\s*["']\d+\.\d+\.\d+["']/.test(bloco),
      `${id} cravou uma versao a mao — deixa o executor derivar do repo`,
    );
  }
});

test('o ESTADO.md nao guarda numero de versao digitado na tabela "No ar"', () => {
  // A tabela do topo mentiu porque guardava o numero. Agora ela aponta pra
  // fonte de verdade. Se um numero de versao voltar pra tabela, o teste cai.
  const ESTADO = readFileSync(new URL('../../ESTADO.md', import.meta.url), 'utf8');
  const i = ESTADO.indexOf('## No ar');
  assert.ok(i >= 0, 'secao "No ar" sumiu do ESTADO.md');
  const bloco = ESTADO.slice(i, ESTADO.indexOf('\n## ', i + 5));
  // Um SemVer dentro de crase (`3.10.62`) na tabela e o padrao que apodrece.
  assert.ok(
    !/`\d+\.\d+\.\d+`/.test(bloco),
    'a tabela "No ar" voltou a cravar um numero de versao — aponte pra fonte, nao copie',
  );
});
