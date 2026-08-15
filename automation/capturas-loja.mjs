/**
 * Gera as capturas de tela do Sanova pra ficha da Play Store.
 *
 * Por que existe: o Play Console pede capturas de tablet de 7" e 10", e isso
 * virava tarefa manual do Bruno a cada mudanca de tela. O app e arquivo unico,
 * entao da pra abrir o index.html direto no navegador, sem servidor, sem conta
 * e sem tocar em dado de paciente nenhum.
 *
  * As fontes sao baixadas na primeira execucao e ficam em cache local.
 *
 * Como usar:
 *   npm i playwright            (PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1)
 *   node automation/capturas-loja.mjs
 *
 * As imagens saem em ./capturas-loja/, prontas pra arrastar pro Play Console.
 *
 * ── Tres armadilhas que custaram uma rodada cada, na noite de 15/08 ──
 *
 * 1. AS ABAS NAO SE CLICAM POR TEXTO. A primeira versao usava
 *    `locator('text=Painel').click()` com `.catch(()=>{})`, o clique falhava e
 *    o catch engolia — sairam 10 arquivos identicos com nome diferente. A
 *    navegacao de verdade e `go('dashboard')`, `go('caneta')`, `go('checkin')`,
 *    `go('saude')` e `abrirMais()`. E `caneta` e nome legado: e a tela de
 *    Medicacao.
 *
 * 2. SEM AS FONTES, A CAPTURA MENTE. As fontes vem do Google Fonts, e sem rede
 *    o Chromium cai em Times. O layout fica certo e a tipografia fica errada —
 *    pior que erro visivel, porque passa despercebido. Por isso este script
 *    busca `automation/fontes-loja.css` e o cria na primeira execucao.
 *    A CSP do app permite `font-src data:`, entao data URI funciona; caminho
 *    relativo NAO funciona, porque resolve contra a URL da pagina.
 *
 * 3. TABLET REPORTA ~800px, NAO 1200px. Medir o layout em 1200 CSS px da a
 *    impressao falsa de que o app fica perdido no vazio. Um tablet de 10"
 *    reporta ~800 CSS px; a 800 o conteudo ocupa 75% da largura e fica bem.
 *
 * ── Fronteira clinica ──
 *
 * As capturas saem com o app SEM RESULTADOS: sem perda de peso, sem grafico de
 * evolucao, sem numero de conquista. Nao e limitacao tecnica, e a regra do
 * DECISOES: peca gerada nao amarra molecula a resultado. Inventar um perfil
 * com "-12 kg" e coloca-lo na ficha da loja e alegacao de eficacia de um app
 * que sinaliza limiar, nao trata. Se um dia isso mudar, muda por decisao
 * clinica do Bruno — nao por conveniencia de marketing.
 */

import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, '..');
const SAIDA = join(RAIZ, 'capturas-loja');
const CSS_FONTES = join(AQUI, 'fontes-loja.css');

// O binario que o ambiente ja tem. Nao baixar outro.
const CHROMIUM = process.env.CHROMIUM_PATH
  || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const TELAS = [
  { arq: '1-painel',    js: "go('dashboard')" },
  { arq: '2-medicacao', js: "go('caneta')"    },  // caneta = nome legado
  { arq: '3-checkin',   js: "go('checkin')"   },
  { arq: '4-saude',     js: "go('saude')"     },
  { arq: '5-mais',      js: "abrirMais()"     },
];

// Viewport em CSS px; deviceScaleFactor 2 gera o pixel real que o Play pede.
const TAMANHOS = [
  { nome: '7pol',  w: 600, h: 960,  dsf: 2 },   // 1200 x 1920
  { nome: '10pol', w: 800, h: 1280, dsf: 2 },   // 1600 x 2560
];

// As fontes nao vao versionadas: sao ~1 MB de base64 e mudam sozinhas quando o
// Google atualiza os arquivos. O script busca uma vez e guarda em disco.
if (!existsSync(CSS_FONTES)) {
  console.log('[fontes] baixando do Google Fonts (uma vez so)...');
  const CSS_URL = 'https://fonts.googleapis.com/css2'
    + '?family=DM+Serif+Display'
    + '&family=Fraunces:opsz,wght@9..144,300;9..144,500;9..144,600'
    + '&family=Plus+Jakarta+Sans:wght@400;500;600;700;800'
    + '&display=swap';
  // UA de navegador moderno; sem isso o Google devolve TTF em vez de woff2.
  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    + ' (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
  let css = await (await fetch(CSS_URL, { headers: { 'user-agent': UA } })).text();

  const urls = [...new Set([...css.matchAll(/https:\/\/fonts\.gstatic\.com\/[^)]+/g)].map((m) => m[0]))];
  for (const u of urls) {
    const buf = Buffer.from(await (await fetch(u)).arrayBuffer());
    // data URI, e nao caminho relativo: caminho relativo resolve contra a URL
    // da pagina (o index.html) e nao acha nada. A CSP do app permite `data:`
    // em font-src, entao isto passa.
    css = css.split(u).join(`data:font/woff2;base64,${buf.toString('base64')}`);
  }
  writeFileSync(CSS_FONTES, css);
  console.log(`[fontes] ${urls.length} arquivos embutidos em ${CSS_FONTES}`);
}
mkdirSync(SAIDA, { recursive: true });

const navegador = await chromium.launch({ executablePath: CHROMIUM });
const vistos = new Map();
let duplicadas = 0;

for (const t of TAMANHOS) {
  const pagina = await navegador.newPage({
    viewport: { width: t.w, height: t.h },
    deviceScaleFactor: t.dsf,
  });
  await pagina.goto(`file://${join(RAIZ, 'index.html')}`,
    { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await pagina.waitForTimeout(3000);

  await pagina.addStyleTag({ path: CSS_FONTES });
  await pagina.evaluate(() => document.fonts.ready);

  // Esconde o portao de login localmente. Nao cria conta, nao fala com o
  // Supabase, nao le nem escreve dado de ninguem.
  await pagina.evaluate(() => {
    const g = document.getElementById('authGate');
    if (g) g.style.display = 'none';
  });
  await pagina.waitForTimeout(800);

  const pular = pagina.locator('text=Pular').first();
  if (await pular.count()) { await pular.click(); await pagina.waitForTimeout(1000); }

  for (const tela of TELAS) {
    // Sem catch mudo: se a navegacao falhar, o script para aqui.
    await pagina.evaluate((js) => { eval(js); }, tela.js);
    await pagina.waitForTimeout(1600);

    const arq = join(SAIDA, `${t.nome}-${tela.arq}.png`);
    await pagina.screenshot({ path: arq });

    // A trava que faltava na primeira versao: duas capturas iguais significam
    // que a navegacao nao saiu do lugar. Isso e falha, nao resultado.
    const h = createHash('md5').update(readFileSync(arq)).digest('hex');
    if (vistos.has(h)) {
      console.error(`[FALHA] ${arq}\n        e identico a ${vistos.get(h)} — a tela nao mudou`);
      duplicadas++;
    } else {
      vistos.set(h, arq);
      console.log(`[ok] ${arq}`);
    }
  }
  await pagina.close();
}

await navegador.close();

if (duplicadas) {
  console.error(`\n${duplicadas} capturas duplicadas — conferir os comandos de navegacao`);
  process.exit(1);
}
console.log(`\n${vistos.size} capturas distintas em ${SAIDA}`);
