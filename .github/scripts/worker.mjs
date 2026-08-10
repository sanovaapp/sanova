/**
 * Worker autonomo do Sanova.
 *
 * Le automation/backlog.yml, executa as tarefas deterministicas que estao
 * prontas pra rodar, escreve o resultado de volta no YAML (preservando os
 * comentarios), commita, e posta um turno na Sala #148 se algo mudou de estado.
 *
 * Nao decide nada. Julgamento continua sendo do Code (sessao interativa) ou da
 * Claude Code Action quando o Bruno cravar a API key. Este arquivo so executa
 * o que ja esta escrito na fila.
 *
 * Uso:
 *   GITHUB_TOKEN=... node .github/scripts/worker.mjs
 *   DRY_RUN=1 node .github/scripts/worker.mjs   (executa e imprime, nao grava)
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { parseDocument } from 'yaml';

const REPO = 'sanovaapp/sanova';
const ISSUE = 148;
const API = 'https://api.github.com';
const BACKLOG = 'automation/backlog.yml';
const MAX_POR_CICLO = 6;
const RE_VERSAO = /var SANOVA_VERSION\s*=\s*'([^']+)'/;
const TOKEN = process.env.GITHUB_TOKEN;
const DRY_RUN = process.env.DRY_RUN === '1';

const WORKER_HEALTH = 'https://sanova-api.contatosanovaapp.workers.dev/api/health';
const APP_INDEX = 'https://sanova.app.br/index.html';
const SUPABASE_URL = 'https://yjycpcydqfuvojfzwfvy.supabase.co';

if (!TOKEN && !DRY_RUN) {
  console.error('[worker] GITHUB_TOKEN ausente');
  process.exit(1);
}

async function gh(path, options = {}) {
  const r = await fetch(API + path, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'sanova-worker',
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (!r.ok) {
    throw new Error(`${options.method || 'GET'} ${path} -> ${r.status} ${(await r.text()).slice(0, 160)}`);
  }
  return r.status === 204 ? null : r.json();
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── Executores ─────────────────────────────────────────────────────
// Cada um devolve { ok: boolean, detalhe: string }. Nunca lanca — uma
// tarefa quebrada vira `failed` e a fila segue.

const executores = {
  async http_check({ url, expect_status = 200, expect_contains }) {
    const r = await fetch(url, { redirect: 'follow' });
    if (r.status !== expect_status) {
      return { ok: false, detalhe: `HTTP ${r.status} (esperado ${expect_status})` };
    }
    if (expect_contains) {
      const corpo = await r.text();
      if (!corpo.includes(expect_contains)) {
        return { ok: false, detalhe: `HTTP ${r.status} mas sem "${expect_contains}"` };
      }
    }
    return { ok: true, detalhe: `HTTP ${r.status}` };
  },

  async worker_version({ expected }) {
    const r = await fetch(WORKER_HEALTH);
    if (!r.ok) return { ok: false, detalhe: `health HTTP ${r.status}` };
    const d = await r.json().catch(() => ({}));
    if (d.version !== expected) {
      return { ok: false, detalhe: `no ar: ${d.version || '?'} · esperado: ${expected}` };
    }
    return { ok: true, detalhe: `v${d.version}` };
  },

  // Sem `expected`, a referencia e o proprio index.html do repositorio. Assim a
  // pergunta vira a util — "o que esta no ar e o que a gente mandou?" — e o
  // monitor para de virar alarme falso a cada release. Cravar versao a mao aqui
  // deixou este monitor vermelho por 3 dias so porque ninguem atualizou o YAML.
  async app_version({ expected }) {
    const esperado = expected || (() => {
      const m = readFileSync('index.html', 'utf8').match(RE_VERSAO);
      return m ? m[1] : null;
    })();
    if (!esperado) return { ok: false, detalhe: 'SANOVA_VERSION sumiu do index.html do repo' };

    const r = await fetch(APP_INDEX, { cache: 'no-store' });
    if (!r.ok) return { ok: false, detalhe: `index HTTP ${r.status}` };
    const m = (await r.text()).match(RE_VERSAO);
    const noAr = m ? m[1] : null;
    if (noAr !== esperado) {
      return { ok: false, detalhe: `no ar: ${noAr || '?'} · no repo: ${esperado}` };
    }
    return { ok: true, detalhe: `v${noAr}` };
  },

  async dispatch({ workflow, inputs = {}, requires_secret }) {
    const antes = await gh(`/repos/${REPO}/actions/workflows/${workflow}/runs?per_page=1`)
      .then((d) => (d.workflow_runs || [])[0]?.id ?? null)
      .catch(() => null);

    await gh(`/repos/${REPO}/actions/workflows/${workflow}/dispatches`, {
      method: 'POST',
      body: JSON.stringify({ ref: 'main', inputs }),
    });

    // Aguarda o run aparecer e concluir. Teto de ~4 min — passou disso,
    // reporta como indefinido e o proximo ciclo confere de novo.
    for (let i = 0; i < 24; i++) {
      await dormir(10_000);
      const d = await gh(`/repos/${REPO}/actions/workflows/${workflow}/runs?per_page=1`).catch(() => null);
      const run = (d?.workflow_runs || [])[0];
      if (!run || run.id === antes) continue;
      if (run.status !== 'completed') continue;
      if (run.conclusion === 'success') {
        return { ok: true, detalhe: `${workflow} concluiu com sucesso` };
      }
      const dica = requires_secret ? ` — confira o secret ${requires_secret}` : '';
      return { ok: false, detalhe: `${workflow} falhou (${run.conclusion})${dica}` };
    }
    return { ok: false, detalhe: `${workflow} disparado mas nao concluiu em 4 min` };
  },

  // Confere se um secret ja existe no repo, sem NUNCA ler o valor. A GitHub
  // API nao devolve valor de secret, e o runner so enxerga o que o workflow
  // injeta no env — entao a checagem e "tem conteudo?" e nada mais. O detalhe
  // reportado leva so o nome e o comprimento; valor nao aparece em log nem em
  // turno na Sala (o repo e publico).
  //
  // Existe pra tirar da fila pessoal do Bruno o "conferir se ja botei tal
  // chave": quando ele cria o secret, o proximo ciclo anuncia sozinho e para
  // de cobrar.
  async secret_present({ name }) {
    const valor = process.env[name];
    if (!valor) {
      return { ok: false, detalhe: `secret ${name} ainda nao existe no repo` };
    }
    return { ok: true, detalhe: `secret ${name} presente (${valor.length} caracteres)` };
  },

  async pr_merged({ number }) {
    const pr = await gh(`/repos/${REPO}/pulls/${number}`);
    return pr.merged
      ? { ok: true, detalhe: `#${number} mergeado` }
      : { ok: false, detalhe: `#${number} ainda aberto` };
  },

  // Confere se uma tabela existe no Supabase, via PostgREST + service_role.
  // Serve pra saber se uma migration ja foi aplicada SEM precisar do PAT de
  // management (que e credencial separada). PostgREST responde PGRST205 pra
  // tabela inexistente e 200 com array pra tabela vazia — sao distinguiveis.
  async supabase_table({ table, should_exist = true }) {
    const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!chave) {
      return { ok: false, detalhe: 'SUPABASE_SERVICE_ROLE_KEY ausente no runner' };
    }
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/${encodeURIComponent(table)}?select=*&limit=1`,
      { headers: { apikey: chave, Authorization: `Bearer ${chave}` } },
    );
    const existe = r.ok;
    if (!existe && r.status !== 404) {
      const corpo = await r.text().catch(() => '');
      // 404 sem corpo PostgREST pode ser outra coisa — reporta cru pra nao
      // afirmar "nao existe" quando na verdade foi erro de rede ou permissao.
      if (!corpo.includes('PGRST205') && !corpo.includes('does not exist')) {
        return { ok: false, detalhe: `resposta inesperada HTTP ${r.status}: ${corpo.slice(0, 120)}` };
      }
    }
    if (existe === should_exist) {
      return { ok: true, detalhe: existe ? `"${table}" existe` : `"${table}" ausente, como esperado` };
    }
    return {
      ok: false,
      detalhe: existe
        ? `"${table}" existe, mas era esperado ausente`
        : `"${table}" NAO existe — migration correspondente ainda nao foi aplicada`,
    };
  },
};

// ─── Carrega a fila ─────────────────────────────────────────────────

const doc = parseDocument(readFileSync(BACKLOG, 'utf8'));
const tasks = doc.get('tasks')?.toJSON() ?? [];

function prontaPraRodar(t, porId) {
  if (t.status === 'done' && !t.repeat) return false;
  if (t.status === 'blocked') return false;
  for (const dep of t.blocked_by || []) {
    if (porId[dep]?.status !== 'done') return false;
  }
  return true;
}

const porId = Object.fromEntries(tasks.map((t) => [t.id, t]));

// Duas regras de ordenacao, nessa ordem:
//
//  1. Trabalho real (tarefas de uma vez so) antes de monitores. Sem isso os
//     `repeat: true` ocupam todas as vagas do ciclo e uma migration no fim da
//     fila nunca chega a rodar — bug pego no primeiro dry-run.
//
//  2. Entre iguais, quem rodou ha mais tempo vai primeiro (nunca rodou = topo).
//     Sem isso os 6 primeiros monitores enchiam o ciclo TODA vez e um monitor
//     na posicao 7 nunca era executado — foi o que aconteceu com os dois
//     `schema-*`, que ficaram `pending` mesmo depois de dois ciclos verdes.
//     Rodizio faz a fila inteira girar mesmo com MAX_POR_CICLO menor que ela.
const desde = (t) => (t.last_run ? Date.parse(t.last_run) || 0 : 0);
const porPrioridade = (a, b) =>
  Number(Boolean(a.repeat)) - Number(Boolean(b.repeat)) || desde(a) - desde(b);

console.log(`[worker] ${tasks.length} tarefas na fila`);

// ─── Executa ────────────────────────────────────────────────────────
// A fila e RECALCULADA a cada tarefa concluida, nao fixada de antemao. Assim
// uma cadeia (A desbloqueia B via blocked_by) fecha dentro do mesmo ciclo em
// vez de precisar de um segundo disparo — o `done` de A ja conta quando B e
// avaliada. `executadas` guarda quem ja rodou pra um `repeat` nao entrar duas
// vezes no mesmo ciclo.

const mudancas = [];
const executadas = new Set();
const agora = new Date().toISOString();

while (executadas.size < MAX_POR_CICLO) {
  const task = tasks
    .filter((t) => !executadas.has(t.id) && prontaPraRodar(t, porId))
    .sort(porPrioridade)[0];
  if (!task) break;

  executadas.add(task.id);
  const executor = executores[task.type];
  const idx = tasks.findIndex((t) => t.id === task.id);
  let resultado;

  if (!executor) {
    resultado = { ok: false, detalhe: `tipo desconhecido: ${task.type}` };
  } else {
    try {
      resultado = await executor(task.params || {});
    } catch (e) {
      resultado = { ok: false, detalhe: String(e.message || e).slice(0, 200) };
    }
  }

  const statusAnterior = task.status;
  const statusNovo = resultado.ok ? 'done' : 'failed';
  console.log(`[worker] ${task.id}: ${statusNovo} — ${resultado.detalhe}`);

  // Atualiza o objeto em memoria tambem — e o que a proxima volta do laco le
  // pra decidir se uma tarefa dependente ja pode rodar.
  task.status = statusNovo;

  doc.setIn(['tasks', idx, 'status'], statusNovo);
  doc.setIn(['tasks', idx, 'last_run'], agora);
  doc.setIn(['tasks', idx, 'last_result'], resultado.detalhe);

  // So reporta o que MUDOU de estado — um monitor que segue verde nao vira ruido.
  if (statusAnterior !== statusNovo) {
    mudancas.push({ ...task, statusAnterior, statusNovo, detalhe: resultado.detalhe });
  }
}

console.log(`[worker] ${executadas.size} tarefa(s) executada(s) neste ciclo`);

// ─── Persiste ───────────────────────────────────────────────────────

if (DRY_RUN) {
  console.log('=== DRY RUN — backlog nao gravado ===\n');
  console.log(String(doc));
  console.log(`\nMudancas de estado: ${mudancas.length}`);
  process.exit(0);
}

writeFileSync(BACKLOG, String(doc));

// ─── Reporta na Sala, so se algo mudou ──────────────────────────────

if (!mudancas.length) {
  console.log('[worker] nenhuma mudanca de estado — nada a reportar');
  process.exit(0);
}

let maiorTurno = 0;
try {
  for (let page = 1; page <= 20; page++) {
    const lote = await gh(`/repos/${REPO}/issues/${ISSUE}/comments?per_page=100&page=${page}`);
    for (const c of lote) {
      for (const m of String(c.body || '').matchAll(/turno\s+(\d+)/gi)) {
        const n = parseInt(m[1], 10);
        if (n > maiorTurno) maiorTurno = n;
      }
    }
    if (lote.length < 100) break;
  }
} catch (e) {
  console.error('[worker] falha lendo turnos:', e.message);
}

const concluidas = mudancas.filter((m) => m.statusNovo === 'done');
const falhas = mudancas.filter((m) => m.statusNovo === 'failed');
const dataBRT = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit',
}).format(new Date());

const linhas = (lista) => lista.map((m) => `- **${m.title}** — ${m.detalhe}`).join('\n');

const corpo = `## 🌿 TURNO ${maiorTurno + 1} — Worker (automático) · Fila executada ${dataBRT}

*Postado pelo \`worker.yml\`. Só reporta o que **mudou de estado** — monitores que seguem verdes não geram turno.*

${concluidas.length ? `### ✅ Concluído (${concluidas.length})\n${linhas(concluidas)}\n` : ''}${falhas.length ? `### ❌ Falhou (${falhas.length})\n${linhas(falhas)}\n\nUma falha não trava a fila — as demais tarefas seguiram, e esta será tentada de novo no próximo ciclo.\n` : ''}
Fila completa e estado de cada tarefa: [\`automation/backlog.yml\`](https://github.com/${REPO}/blob/main/${BACKLOG})

🌿
— Worker (automático)`;

await gh(`/repos/${REPO}/issues/${ISSUE}/comments`, {
  method: 'POST',
  body: JSON.stringify({ body: corpo }),
});
console.log(`[worker] TURNO ${maiorTurno + 1} publicado (${mudancas.length} mudancas)`);
