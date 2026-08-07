/**
 * Auto-merge do que nao e decisao.
 *
 * O Bruno nao programa, entao nao deveria apertar botao em codigo que nao le.
 * Este script separa mudanca de ENGENHARIA (entra sozinha) de mudanca de
 * DECISAO (espera ele).
 *
 * Roda a partir de .github/workflows/auto-merge.yml. Lógica aqui e nao no YAML
 * pela mesma razao de sempre: bash dentro de `run:` ja quebrou o heartbeat 12
 * vezes seguidas sem ninguem perceber.
 *
 * Testar local:
 *   GITHUB_TOKEN=... PR_NUMBER=246 DRY_RUN=1 node .github/scripts/auto-merge.mjs
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

const REPO = 'sanovaapp/sanova';
const API = 'https://api.github.com';
const TOKEN = process.env.GITHUB_TOKEN;
const DRY_RUN = process.env.DRY_RUN === '1';
const LABEL_DECISAO = 'decisao-humana';

// ─── Caminhos protegidos ────────────────────────────────────────────
//
// Tocou aqui, o Bruno decide. Nao e sobre risco tecnico — e sobre QUEM tem
// autoridade. Cada linha existe por um motivo:
//
//   texto que fala com paciente   -> conduta clinica e dele, medico e fundador
//   dinheiro                      -> preco e decisao de negocio
//   LGPD / termos / privacidade   -> promessa juridica em nome da empresa
//   schema do banco               -> migration e irreversivel na pratica
//   auth e pagamento no worker    -> quebrar aqui derruba receita ou acesso
//   DECISOES.md                   -> e a lei; mudar a lei nao e engenharia
//
//   .github/ INTEIRO              -> quem tira o freio nao pode ser quem
//                                    dirige. Um agente que altera sozinho a
//                                    regra que o supervisiona pode, em passos
//                                    individualmente inocentes, se libertar da
//                                    supervisao inteira. O custo e o Bruno dar
//                                    o visto quando a automacao mudar; e um
//                                    custo baixo e a protecao e categorica.
//
// index.html NAO esta aqui de proposito: e o app inteiro num arquivo so, entao
// protege-lo travaria tudo. O discriminador dele e o label — ver abaixo.
const PROTEGIDOS = [
  '.github/',
  'DECISOES.md',
  'privacidade.html',
  'termos.html',
  'exclusao.html',
  'supabase/migrations/',
  'worker/src/pagamento',
  'worker/src/mp',
  'worker/src/auth',
];

// Padroes com cara de credencial. O repo e publico e ja houve vazamento por
// print — o portao aqui e barato e pega a classe inteira de acidente.
const CARA_DE_SEGREDO = [
  [/\bsbp_[a-f0-9]{40}\b/, 'PAT do Supabase'],
  [/\bsk-ant-[A-Za-z0-9_-]{20,}/, 'chave da Anthropic'],
  [/\bgh[pousr]_[A-Za-z0-9]{36}\b/, 'token do GitHub'],
  [/\bAPP_USR-[0-9]{6,}-[0-9]{6}-[a-f0-9]{32}/, 'token do Mercado Pago'],
  [/"private_key"\s*:\s*"-----BEGIN/, 'chave privada de service account'],
  [/\beyJhbGciOi[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\./, 'JWT'],
];

if (!TOKEN) {
  console.error('[auto-merge] GITHUB_TOKEN ausente');
  process.exit(1);
}

async function gh(path, options = {}) {
  const r = await fetch(API + path, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'sanova-auto-merge',
      Authorization: `Bearer ${TOKEN}`,
      ...(options.headers || {}),
    },
  });
  if (!r.ok) {
    throw new Error(`${options.method || 'GET'} ${path} -> ${r.status} ${(await r.text()).slice(0, 200)}`);
  }
  return r.status === 204 ? null : r.json();
}

// maxBuffer explicito: o padrao do Node e 1 MB, e o `index.html` sozinho passa
// disso (~26 mil linhas). Sem esta linha, `git show ref:index.html` e o `git
// diff` estouram com ENOBUFS e o portao falha em TODA PR que toque o app — que
// e justamente a PR onde ele mais importa.
const git = (...args) =>
  execFileSync('git', args, { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 });

// ─── Descobre de qual PR estamos falando ────────────────────────────
// O evento `check_suite` nao traz numero de PR; traz a lista de PRs que
// contem aquele commit.

async function acharPR() {
  if (process.env.PR_NUMBER) return Number(process.env.PR_NUMBER);
  const id = process.env.CHECK_SUITE_ID;
  if (!id) return null;
  const suite = await gh(`/repos/${REPO}/check-suites/${id}`).catch(() => null);
  return suite?.pull_requests?.[0]?.number ?? null;
}

// ─── Portoes ────────────────────────────────────────────────────────
// Cada um devolve null quando passa, ou uma frase explicando o bloqueio.
// A frase vai crua pro comentario da PR — tem que ser legivel pro Bruno.

function portaoBranch(pr) {
  if (!pr.head.ref.startsWith('claude/')) {
    return `a branch \`${pr.head.ref}\` nao e de agente (so \`claude/*\` entra sozinha)`;
  }
  return null;
}

function portaoLabel(pr) {
  if ((pr.labels || []).some((l) => l.name === LABEL_DECISAO)) {
    return `a PR esta marcada como \`${LABEL_DECISAO}\` — alguem julgou que isso e decisao sua`;
  }
  return null;
}

function portaoCaminhos(arquivos) {
  const tocados = arquivos.filter((f) => PROTEGIDOS.some((p) => f.startsWith(p)));
  if (tocados.length) {
    return `toca caminho protegido: ${tocados.map((f) => `\`${f}\``).join(', ')}`;
  }
  return null;
}

function portaoSanidade(arquivos, base, head) {
  // 1. Todo YAML que a PR mexeu precisa parsear. Um workflow quebrado passa
  //    despercebido por dias (foi o caso do heartbeat).
  for (const f of arquivos) {
    if (!/\.ya?ml$/.test(f)) continue;
    let conteudo;
    try {
      conteudo = readFileSync(f, 'utf8');
    } catch {
      continue; // arquivo removido nesta PR
    }
    try {
      parse(conteudo);
    } catch (e) {
      return `\`${f}\` nao parseia como YAML: ${String(e.message).slice(0, 120)}`;
    }
  }

  // 2. Mexeu no app? A versao tem que subir. O worker monitora a versao no ar
  //    contra o repo — sem o bump, o monitor acusa divergencia pra sempre.
  if (arquivos.includes('index.html')) {
    const versaoDe = (ref) => {
      const html = git('show', `${ref}:index.html`);
      return (html.match(/var SANOVA_VERSION\s*=\s*'([^']+)'/) || [])[1] || null;
    };
    const antes = versaoDe(base);
    const depois = versaoDe(head);
    if (!depois) return 'nao achei `SANOVA_VERSION` no index.html';
    if (antes === depois) {
      return `\`index.html\` mudou mas \`SANOVA_VERSION\` continua \`${depois}\``;
    }
  }

  // 3. Nada com cara de credencial nas linhas adicionadas. O repo e publico.
  const diff = git('diff', `${base}...${head}`);
  const adicionadas = diff
    .split('\n')
    .filter((l) => l.startsWith('+') && !l.startsWith('+++'))
    .join('\n');
  for (const [padrao, nome] of CARA_DE_SEGREDO) {
    if (padrao.test(adicionadas)) {
      return `a PR adiciona algo com cara de **${nome}** — o repo e publico`;
    }
  }

  return null;
}

async function portaoChecks(sha) {
  const status = await gh(`/repos/${REPO}/commits/${sha}/status`);
  if (status.state === 'failure' || status.state === 'error') {
    return `status combinado do commit e \`${status.state}\``;
  }
  const { check_runs = [] } = await gh(`/repos/${REPO}/commits/${sha}/check-runs`);
  const proprio = (c) => c.name.startsWith('avaliar') || c.name.includes('Auto-merge');
  const pendentes = check_runs.filter((c) => c.status !== 'completed' && !proprio(c));
  if (pendentes.length) {
    return `ainda rodando: ${pendentes.map((c) => c.name).join(', ')}`;
  }
  const ruins = check_runs.filter(
    (c) => ['failure', 'timed_out', 'cancelled', 'action_required'].includes(c.conclusion) && !proprio(c),
  );
  if (ruins.length) {
    return `check falhou: ${ruins.map((c) => `${c.name} (${c.conclusion})`).join(', ')}`;
  }
  return null;
}

// ─── Deploy depois do merge ─────────────────────────────────────────
//
// Push feito com o GITHUB_TOKEN NAO dispara outros workflows. E uma protecao
// do GitHub contra laco infinito, e nao da pra desligar.
//
// Consequencia que so apareceu no primeiro merge automatico de verdade: a PR
// #250 entrou na main e o `deploy-worker.yml` nunca rodou. O codigo estava
// mergeado e o worker seguia na versao velha. Silenciosamente — nada falhou,
// simplesmente nao aconteceu.
//
// `workflow_dispatch` via API funciona mesmo com o GITHUB_TOKEN (o executor
// `dispatch` do worker autonomo ja depende disso e roda). Entao a saida e
// pedir o deploy explicitamente, em vez de contar com o gatilho de push.
const DEPLOYS = [
  {
    quando: (f) => f.startsWith('worker/'),
    workflow: 'deploy-worker.yml',
    o_que: 'Worker Cloudflare',
  },
];

async function dispararDeploys(arquivos) {
  for (const d of DEPLOYS) {
    if (!arquivos.some(d.quando)) continue;
    try {
      await gh(`/repos/${REPO}/actions/workflows/${d.workflow}/dispatches`, {
        method: 'POST',
        body: JSON.stringify({ ref: 'main' }),
      });
      console.log(`[auto-merge] deploy pedido: ${d.o_que} (${d.workflow})`);
    } catch (e) {
      // Nao derruba o job: o merge ja aconteceu e desfazer seria pior. O
      // monitor `worker-no-ar` compara a versao no ar com a esperada e acusa
      // a divergencia no proximo ciclo.
      console.error(`[auto-merge] FALHOU pedir deploy de ${d.o_que}: ${e.message}`);
    }
  }
}

// ─── Principal ──────────────────────────────────────────────────────

const numero = await acharPR();
if (!numero) {
  console.log('[auto-merge] evento sem PR associada — nada a fazer');
  process.exit(0);
}

const pr = await gh(`/repos/${REPO}/pulls/${numero}`);

if (pr.state !== 'open' || pr.draft) {
  console.log(`[auto-merge] #${numero} ${pr.draft ? 'e rascunho' : 'nao esta aberta'} — nada a fazer`);
  process.exit(0);
}

const arquivos = [];
for (let pagina = 1; ; pagina++) {
  const lote = await gh(`/repos/${REPO}/pulls/${numero}/files?per_page=100&page=${pagina}`);
  arquivos.push(...lote.map((f) => f.filename));
  if (lote.length < 100) break;
}

// O checkout do runner vem com fetch-depth 0, entao base e head existem local.
const base = pr.base.sha;
const head = pr.head.sha;
try {
  git('cat-file', '-e', `${base}^{commit}`);
} catch {
  git('fetch', 'origin', base, head);
}

const bloqueios = [
  portaoBranch(pr),
  portaoLabel(pr),
  portaoCaminhos(arquivos),
  portaoSanidade(arquivos, base, head),
  await portaoChecks(head),
].filter(Boolean);

console.log(`[auto-merge] #${numero} · ${arquivos.length} arquivo(s) · ${bloqueios.length} bloqueio(s)`);
bloqueios.forEach((b) => console.log(`[auto-merge]   - ${b}`));

if (DRY_RUN) {
  console.log('[auto-merge] DRY_RUN — parando aqui');
  process.exit(0);
}

// Um bloqueio "ainda rodando" nao e recusa: e cedo demais. O evento
// `check_suite` traz a gente de volta quando terminar.
const soEsperando = bloqueios.length === 1 && bloqueios[0].startsWith('ainda rodando');
if (soEsperando) {
  console.log('[auto-merge] checks em andamento — o proximo evento reavalia');
  process.exit(0);
}

if (bloqueios.length === 0) {
  await gh(`/repos/${REPO}/pulls/${numero}/merge`, {
    method: 'PUT',
    body: JSON.stringify({
      merge_method: 'squash',
      commit_title: `${pr.title} (#${numero})`,
    }),
  });
  console.log(`[auto-merge] #${numero} mergeada`);
  await dispararDeploys(arquivos);
  process.exit(0);
}

// Bloqueada: explica na propria PR, uma vez so. Comentar de novo a cada push
// vira ruido — e ruido e exatamente o que estamos tentando matar.
const marcador = '<!-- auto-merge-bloqueio -->';
const anteriores = await gh(`/repos/${REPO}/issues/${numero}/comments?per_page=100`);
const jaAvisou = anteriores.some(
  (c) => c.body.includes(marcador) && c.body.includes(bloqueios.join('\n')),
);

if (jaAvisou) {
  console.log('[auto-merge] bloqueio identico ja comentado — nao repete');
  process.exit(0);
}

const corpo = [
  marcador,
  '### 🚦 Esta PR nao entra sozinha',
  '',
  ...bloqueios.map((b) => `- ${b}`),
  '',
  bloqueios.some((b) => b.includes('protegido') || b.includes(LABEL_DECISAO))
    ? 'Isso aqui e **decisao**, nao engenharia — entra sozinha so quando voce mandar. Pra aprovar, comente `@claude merge`.'
    : 'Isso e um portao tecnico. Eu conserto e ela reavalia sozinha no proximo push.',
].join('\n');

await gh(`/repos/${REPO}/issues/${numero}/comments`, {
  method: 'POST',
  body: JSON.stringify({ body: corpo }),
});
console.log('[auto-merge] bloqueio comentado na PR');
