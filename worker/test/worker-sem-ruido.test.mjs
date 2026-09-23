/**
 * O worker de vigilancia so grava no backlog quando a RESPOSTA muda.
 *
 * Antes ele gravava `last_run` a cada ciclo. Como o timestamp sempre muda, o
 * `git diff --quiet` do workflow nunca segurava o commit: sairam ~150 commits
 * por mes dizendo "olhei e esta tudo igual". O Bruno perguntou o que era
 * aquela atividade diaria em 22/09 — e a pergunta estava certa: um monitor
 * que fala mesmo sem novidade ensina a ignorar monitor, que e a mesma licao
 * ja escrita no cabecalho do backlog.yml sobre alarme falso.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const WORKER = readFileSync(new URL('../../.github/scripts/worker.mjs', import.meta.url), 'utf8');

test('o backlog so e reescrito quando status ou last_result mudam', () => {
  assert.match(
    WORKER,
    /const mudouResposta\s*=\s*\n?\s*statusAnterior !== statusNovo \|\| resultadoAnterior !== resultado\.detalhe/,
    'a guarda mudouResposta sumiu — o worker volta a commitar so timestamp',
  );
  const i = WORKER.indexOf('const mudouResposta');
  const trecho = WORKER.slice(i, i + 600);
  for (const campo of ['status', 'last_run', 'last_result']) {
    assert.ok(
      trecho.includes(`'${campo}'`),
      `o setIn de ${campo} saiu de dentro da guarda mudouResposta`,
    );
  }
  // nenhum setIn de last_run fora da guarda
  const todos = [...WORKER.matchAll(/setIn\(\['tasks', idx, '(\w+)'\]/g)].map((m) => m[1]);
  assert.equal(
    todos.filter((c) => c === 'last_run').length,
    1,
    'ha mais de um ponto gravando last_run — um deles escapa da guarda',
  );
});

test('resultadoAnterior e lido ANTES de task.status ser sobrescrito', () => {
  const iLeitura = WORKER.indexOf('const resultadoAnterior = task.last_result');
  const iEscrita = WORKER.indexOf('task.status = statusNovo');
  assert.ok(iLeitura > 0 && iLeitura < iEscrita,
    'resultadoAnterior precisa ser capturado antes da mutacao em memoria');
});
