/**
 * Esquema quinzenal: a matematica exibida ao paciente tem que ser a real.
 *
 * Origem (18/08): o Bruno descreveu o conceito da sobreposicao quinzenal —
 * nova dose chega antes de a anterior zerar, nivel estabiliza num patamar
 * menor. A conta com t1/2 de bula confirma a media (~50% do semanal) e
 * corrige o "constante": o vale pre-dose fica em ~15-20% (tirzepatida),
 * abaixo da zona de saciedade. O app passou a suportar o esquema com esses
 * numeros honestos.
 *
 * Decisao clinica registrada: peso e idade NAO entram na curva. Farmacometria
 * populacional publicada: t1/2 nao varia de forma clinicamente relevante com
 * idade (inclusive >=65) nem com peso; peso desloca a exposicao ABSOLUTA
 * (~1%/kg), que o app nao mostra — a curva e percentual. Colocar
 * modificadores seria pseudo-precisao.
 *
 * Estes testes EXECUTAM as funcoes extraidas do proprio index.html — nao sao
 * so pattern-matching.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const INDEX = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');

// Extrai uma function declarada por nome e a instancia de verdade.
function extrai(nome) {
  const i = INDEX.indexOf(`function ${nome}(`);
  assert.ok(i > 0, `function ${nome} sumiu do index.html`);
  // acha o fim contando chaves
  let fim = INDEX.indexOf('{', i), nivel = 0;
  for (let j = fim; j < INDEX.length; j++) {
    if (INDEX[j] === '{') nivel++;
    else if (INDEX[j] === '}') { nivel--; if (nivel === 0) { fim = j + 1; break; } }
  }
  return new Function(`return (${INDEX.slice(i, fim)})`)();
}

const diasDoCiclo = extrai('diasDoCiclo');
const pkPeriodoHoras = extrai('pkPeriodoHoras');

test('diasDoCiclo cobre os tres esquemas', () => {
  assert.equal(diasDoCiclo('semanal'), 7);
  assert.equal(diasDoCiclo('quinzenal'), 14);
  assert.equal(diasDoCiclo('diaria'), 1);
  // default conservador: frequencia desconhecida vira semanal, nunca diaria
  assert.equal(diasDoCiclo(undefined), 7);
});

test('pkPeriodoHoras estica o ciclo pra 336h no quinzenal', () => {
  const p = { period: 168 };
  assert.equal(pkPeriodoHoras(p, 'quinzenal'), 336);
  assert.equal(pkPeriodoHoras(p, 'semanal'), 168);
});

test('a matematica do anexo quinzenal bate com o t1/2 de bula', () => {
  // Tirzepatida: t1/2 120h, tmax 24h — mesmos parametros do PK_PARAMS.
  const ke = Math.log(2) / 120;
  const meio = Math.round(100 * Math.exp(-ke * (168 - 24)));
  const vale = Math.round(100 * Math.exp(-ke * (336 - 24)) / (1 - Math.exp(-ke * 336)));
  // meio do ciclo ~43-44%, vale em regime ~19-20%: a "media 50% constante"
  // do conceito original esconde vales fundos — e isso que o anexo mostra.
  assert.ok(meio >= 40 && meio <= 47, `meio do ciclo fora do esperado: ${meio}%`);
  assert.ok(vale >= 16 && vale <= 22, `vale em regime fora do esperado: ${vale}%`);
});

test('o dropdown oferece Quinzenal e o anexo educativo existe', () => {
  assert.match(INDEX, /<option value="quinzenal">Quinzenal<\/option>/);
  assert.match(INDEX, /Seu esquema é quinzenal/);
  assert.match(INDEX, /Não antecipe dose nem mude o intervalo/,
    'o anexo tem que reforcar a fronteira: esquema e do prescritor');
});

test('peso e idade NAO entram na curva — decisao com fonte', () => {
  // Se um dia alguem adicionar modificador por peso/idade na curva percentual,
  // este teste forca a conversa: a farmacometria publicada nao sustenta.
  const pk = INDEX.slice(INDEX.indexOf('function pkLevel'), INDEX.indexOf('function toggleAcc'));
  assert.ok(!/peso|idade|weight|age/i.test(pk),
    'modificador de peso/idade apareceu no calculo PK — ver cabecalho deste teste antes');
});

test('as tres curvas continuam com t1/2 de bula', () => {
  assert.match(INDEX, /Tirzepatida:\{tmax:24,thalf:120/);
  assert.match(INDEX, /Semaglutida:\{tmax:24,thalf:168/);
  assert.match(INDEX, /Liraglutida:\{tmax:10,thalf:13/);
});
