/**
 * Heartbeat diario da Sala Sanova (issue #148).
 *
 * Por que Node e nao bash no YAML: a 1a versao montava o markdown com
 * heredoc dentro de `run: |`, e linhas de markdown na coluna 1 fecham o
 * bloco literal do YAML — o workflow nunca chegou a rodar (12 runs
 * falhados em parse). Script separado elimina a classe inteira de bug de
 * escaping e da pra testar local com DRY_RUN=1.
 *
 * Uso:
 *   GITHUB_TOKEN=... node .github/scripts/heartbeat.mjs
 *   DRY_RUN=1 node .github/scripts/heartbeat.mjs   (imprime, nao posta)
 */

import { readFileSync, readdirSync } from 'node:fs';

const REPO = 'sanovaapp/sanova';
const ISSUE = 148;
const API = 'https://api.github.com';
const TOKEN = process.env.GITHUB_TOKEN;
const DRY_RUN = process.env.DRY_RUN === '1';

if (!TOKEN && !DRY_RUN) {
  console.error('[heartbeat] GITHUB_TOKEN ausente');
  process.exit(1);
}

async function gh(path, options = {}) {
  const r = await fetch(API + path, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'sanova-heartbeat',
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (!r.ok) {
    throw new Error(`${options.method || 'GET'} ${path} -> ${r.status} ${(await r.text()).slice(0, 200)}`);
  }
  return r.json();
}

function ler(arquivo, regex, fallback = '?') {
  try {
    const m = readFileSync(arquivo, 'utf8').match(regex);
    return m ? m[1] : fallback;
  } catch {
    return fallback;
  }
}

// ─── Coleta ─────────────────────────────────────────────────────────
const desde = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
const dataBRT = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit', month: '2-digit', year: 'numeric',
}).format(new Date());

const versoes = {
  app: ler('index.html', /var SANOVA_VERSION\s*=\s*'([^']+)'/),
  sw: ler('sw.js', /const VERSION\s*=\s*'([^']+)'/),
  worker: ler('worker/src/index.js', /version:\s*'([^']+)'/),
};

let migracaoRecente = '-';
try {
  migracaoRecente = readdirSync('supabase/migrations').sort().pop() || '-';
} catch {}

// PRs mergeados nas ultimas 24h
let prs = [];
try {
  const lista = await gh(`/repos/${REPO}/pulls?state=closed&sort=updated&direction=desc&per_page=30`);
  prs = lista.filter((p) => p.merged_at && p.merged_at >= desde);
} catch (e) {
  console.error('[heartbeat] falha buscando PRs:', e.message);
}

// Workflow runs falhados nas ultimas 24h (ignora o proprio heartbeat)
let falhas = [];
try {
  const lista = await gh(`/repos/${REPO}/actions/runs?status=failure&per_page=40`);
  falhas = (lista.workflow_runs || []).filter(
    (r) => r.updated_at >= desde && !String(r.name || '').includes('heartbeat')
  );
} catch (e) {
  console.error('[heartbeat] falha buscando runs:', e.message);
}

// Proximo numero de turno: le a issue inteira com paginacao
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
  console.error('[heartbeat] falha lendo turnos:', e.message);
}
const proximoTurno = maiorTurno + 1;

// ─── Monta o corpo ──────────────────────────────────────────────────
const linhasPRs = prs.length
  ? prs.map((p) => `- #${p.number} — ${p.title}`).join('\n')
  : '- (nenhum PR mergeado nas últimas 24h)';

const linhasFalhas = falhas.length
  ? falhas.map((r) => `- ❌ ${r.name} — [run](${r.html_url})`).join('\n')
  : '- ✅ Nenhuma falha de workflow';

const sistemas = falhas.length ? `⚠️ ${falhas.length} workflow(s) falharam` : '✅ OK';

const corpo = `## 🌿 TURNO ${proximoTurno} — Code (heartbeat automático) · Pulso da Sala ${dataBRT}

*Postado pelo workflow \`heartbeat.yml\` (cron 08h BRT). Se algo aqui estiver quebrado, o próprio heartbeat expõe.*

### 📦 Versões no ar
- App: \`${versoes.app}\` · SW: \`${versoes.sw}\` · Worker: \`${versoes.worker}\`
- Última migration commitada: \`${migracaoRecente}\`

### 🚀 PRs mergeados nas últimas 24h (${prs.length})
${linhasPRs}

### 🩺 Sistemas
${sistemas}

${linhasFalhas}

### 📌 Pendências operacionais (persistentes)
- **Bruno:** aplicar as 2 migrations pendentes (Actions → Apply Supabase Migration); rotacionar \`MP_ACCESS_TOKEN_PROD\`; caminho crítico da Play conforme último turno humano
- **Fable:** perguntas abertas do Code — canal de emergência dos alertas 🔴 e migração dos cards pro Canva
- **Grok:** próxima auditoria paciente-espião + ciclo de conteúdo

🌿
— Code (automático)`;

// ─── Publica ────────────────────────────────────────────────────────
if (DRY_RUN) {
  console.log('=== DRY RUN — não publicado ===\n');
  console.log(corpo);
  process.exit(0);
}

await gh(`/repos/${REPO}/issues/${ISSUE}/comments`, {
  method: 'POST',
  body: JSON.stringify({ body: corpo }),
});
console.log(`[heartbeat] TURNO ${proximoTurno} publicado`);
