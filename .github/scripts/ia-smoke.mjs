// Teste de fumaca da IA: loga com a conta de teste e chama as duas rotas de
// IA exatamente como o app chama. Existe porque "a foto nao funcionou" chegava
// sem causa: agora o status e o motivo saem no log, sem depender de print.
import { chromium } from '@playwright/test';

const MAGIC = process.env.MAGIC_LINK;
const ORIGIN = process.env.SANOVA_ORIGIN || 'https://sanova.app.br';
if (!MAGIC) { console.error('MAGIC_LINK vazio'); process.exit(1); }

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, locale: 'pt-BR' });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('[pageerror]', e.message.slice(0, 300)));

await page.goto(MAGIC, { waitUntil: 'load', timeout: 45000 });
await page.waitForTimeout(7000);
if (!page.url().startsWith(ORIGIN)) await page.goto(ORIGIN + '/', { waitUntil: 'load', timeout: 45000 });
await page.waitForTimeout(3000);

const r = await page.evaluate(async () => {
  const out = { versao: (typeof SANOVA_VERSION === 'string') ? SANOVA_VERSION : null };
  const api = window.SANOVA_API_URL || (typeof SANOVA_API_URL !== 'undefined' ? SANOVA_API_URL : null);
  out.api = api;
  out.helper_existe = typeof _proAuthToken === 'function';
  let tk = null;
  try { tk = await _proAuthToken(); } catch (e) { out.helper_erro = String(e); }
  out.tem_sessao = !!tk;

  async function chama(rota, body, comAuth) {
    const h = { 'Content-Type': 'application/json' };
    if (comAuth) h['Authorization'] = 'Bearer ' + (tk || '');
    const t0 = Date.now();
    try {
      const resp = await fetch(api + rota, { method: 'POST', headers: h, body: JSON.stringify(body) });
      const txt = await resp.text();
      return { status: resp.status, ms: Date.now() - t0, corpo: txt.slice(0, 400) };
    } catch (e) { return { erro: String(e), ms: Date.now() - t0 }; }
  }

  // Foto sintetica: prato branco com "arroz", "feijao" e "frango" em cores.
  const c = document.createElement('canvas'); c.width = 640; c.height = 480;
  const g = c.getContext('2d');
  g.fillStyle = '#8a6b4a'; g.fillRect(0, 0, 640, 480);
  g.fillStyle = '#f4f4f0'; g.beginPath(); g.arc(320, 240, 200, 0, 7); g.fill();
  g.fillStyle = '#fffdf2'; g.beginPath(); g.arc(250, 200, 80, 0, 7); g.fill();
  g.fillStyle = '#4a2c1a'; g.beginPath(); g.arc(390, 210, 70, 0, 7); g.fill();
  g.fillStyle = '#c98a4b'; g.fillRect(260, 290, 140, 70);
  const foto = c.toDataURL('image/jpeg', 0.8);
  out.foto_kb = Math.round(foto.length / 1024);

  out.texto_sem_login = await chama('/api/analyze-text', { description: '2 ovos mexidos e 1 banana' }, false);
  out.texto = await chama('/api/analyze-text', { description: '2 ovos mexidos e 1 banana' }, true);
  out.foto = await chama('/api/analyze-photo', { imageBase64: foto }, true);
  return out;
});

console.log('IA_SMOKE ' + JSON.stringify(r, null, 2));
await browser.close();

const ok = r.tem_sessao && r.texto_sem_login.status === 401 && r.texto.status === 200 && r.foto.status === 200;
console.log(ok ? 'IA_SMOKE_OK' : 'IA_SMOKE_FALHOU');
process.exit(ok ? 0 : 1);
