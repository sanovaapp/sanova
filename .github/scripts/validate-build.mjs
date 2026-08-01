#!/usr/bin/env node
/**
 * Guardrail de build do Sanova (single-file PWA).
 *
 * Automatiza a regra inviolável do HANDOFF:
 *   "SEMPRE validar HTML balanceado + sintaxe JS antes de finalizar"
 *   "SEMPRE bumpar SANOVA_VERSION no index.html E VERSION no sw.js"
 *
 * Roda em cada PR/push. Sem dependências externas (só Node builtin).
 *
 * Falhas duras (exit 1):
 *   - SANOVA_VERSION (index.html) != VERSION (sw.js)
 *   - sintaxe JS inválida em qualquer <script> inline do index.html
 *   - manifest.json não é JSON válido
 * Avisos (não travam):
 *   - desbalanceamento de tags HTML (best-effort)
 */

import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ROOT = new URL('../../', import.meta.url).pathname;
const read = (p) => readFileSync(ROOT + p, 'utf8');

const errors = [];
const warnings = [];

// ── 1. Versões sincronizadas (index.html ↔ sw.js) ──────────────────
function extractIndexVersion(html) {
  const m = html.match(/var\s+SANOVA_VERSION\s*=\s*['"]([^'"]+)['"]/);
  return m ? m[1].trim() : null;
}
function extractSwVersion(sw) {
  const m = sw.match(/const\s+VERSION\s*=\s*['"]([^'"]+)['"]/);
  if (!m) return null;
  // sw usa prefixo "sanova-v" no nome do cache; normaliza pra comparar
  return m[1].trim().replace(/^sanova-v?/, '');
}

let indexHtml, swJs;
try {
  indexHtml = read('index.html');
  swJs = read('sw.js');
} catch (e) {
  errors.push(`Não consegui ler index.html ou sw.js: ${e.message}`);
}

if (indexHtml && swJs) {
  const idxV = extractIndexVersion(indexHtml);
  const swV = extractSwVersion(swJs);
  if (!idxV) errors.push('Não achei SANOVA_VERSION em index.html');
  if (!swV) errors.push('Não achei const VERSION em sw.js');
  if (idxV && swV) {
    if (idxV !== swV) {
      errors.push(
        `Versões DESSINCRONIZADAS → causa clássica de bug de cache do SW.\n` +
        `      index.html SANOVA_VERSION = '${idxV}'\n` +
        `      sw.js      VERSION        = 'sanova-v${swV}'\n` +
        `      Ajuste os dois pro mesmo número antes de mergear.`
      );
    } else {
      console.log(`✓ Versões sincronizadas: ${idxV}`);
    }
  }
}

// ── 2. Sintaxe JS de cada <script> inline do index.html ────────────
if (indexHtml) {
  const scriptRe = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m, n = 0, checked = 0;
  while ((m = scriptRe.exec(indexHtml)) !== null) {
    n++;
    const attrs = m[1] || '';
    const body = m[2] || '';
    // pula scripts externos e blocos não-JS (json, importmap, etc)
    if (/\bsrc\s*=/.test(attrs)) continue;
    const typeMatch = attrs.match(/\btype\s*=\s*['"]([^'"]+)['"]/i);
    if (typeMatch) {
      const t = typeMatch[1].toLowerCase();
      const jsTypes = ['text/javascript', 'application/javascript', 'module', ''];
      if (!jsTypes.includes(t)) continue; // ex: application/json, importmap
    }
    if (!body.trim()) continue;
    checked++;
    // conta linha aproximada onde o script começa (pra mensagem)
    const line = indexHtml.slice(0, m.index).split('\n').length;
    try {
      // vm.Script apenas COMPILA (parseia) — não executa nada.
      new vm.Script(body, { filename: `index.html:<script #${n} @linha ${line}>` });
    } catch (e) {
      errors.push(
        `Sintaxe JS inválida no <script> #${n} (perto da linha ${line} do index.html):\n` +
        `      ${e.message}`
      );
    }
  }
  console.log(`✓ ${checked} bloco(s) <script> inline verificado(s) de ${n} total`);
}

// ── 3. manifest.json é JSON válido ─────────────────────────────────
try {
  JSON.parse(read('manifest.json'));
  console.log('✓ manifest.json é JSON válido');
} catch (e) {
  errors.push(`manifest.json inválido: ${e.message}`);
}

// ── 4. Balanceamento de tags HTML (best-effort, só aviso) ──────────
if (indexHtml) {
  const VOID = new Set([
    'area','base','br','col','embed','hr','img','input','link','meta',
    'param','source','track','wbr',
  ]);
  // remove conteúdo de <script> e <style> (podem conter '<' que não é tag)
  const stripped = indexHtml
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');
  const tagRe = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)\b([^>]*)>/g;
  const stack = [];
  let t;
  let imbalance = null;
  while ((t = tagRe.exec(stripped)) !== null) {
    const closing = t[1] === '/';
    const name = t[2].toLowerCase();
    const attrs = t[3] || '';
    if (VOID.has(name)) continue;
    if (attrs.trimEnd().endsWith('/')) continue; // self-closing explícito
    if (!closing) {
      stack.push(name);
    } else {
      if (stack.length === 0) {
        imbalance = `</${name}> sem abertura correspondente`;
        break;
      }
      // procura o par mais próximo no topo da pilha
      if (stack[stack.length - 1] === name) {
        stack.pop();
      } else {
        const idx = stack.lastIndexOf(name);
        if (idx === -1) {
          imbalance = `</${name}> fecha sem abertura`;
          break;
        }
        // fecha implícito de tags intermediárias — tolera, mas anota
        stack.length = idx;
      }
    }
  }
  if (imbalance) {
    warnings.push(`Possível HTML desbalanceado: ${imbalance}`);
  } else if (stack.length > 0) {
    warnings.push(`Possível HTML desbalanceado: ${stack.length} tag(s) sem fechamento (topo: <${stack[stack.length - 1]}>)`);
  } else {
    console.log('✓ HTML aparentemente balanceado');
  }
}

// ── Resultado ──────────────────────────────────────────────────────
if (warnings.length) {
  console.log('\n⚠️  Avisos (não travam o build):');
  for (const w of warnings) console.log('   - ' + w);
}
if (errors.length) {
  console.error('\n❌ Guardrail reprovou:');
  for (const e of errors) console.error('   - ' + e);
  console.error(`\n${errors.length} erro(s). Corrija antes de mergear.`);
  process.exit(1);
}
console.log('\n✅ Guardrail passou. Build íntegro.');
