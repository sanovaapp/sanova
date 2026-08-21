/**
 * Onda 4b (v3.10.75) — o topo do Painel segue o preview 4 aprovado pelo Bruno:
 * peso-heroi + KPIs (proxima dose · proteina) + CTA de check-in, com o hero
 * da medicacao colapsado num accordion ("colapsa, nunca some").
 *
 * Estes asserts sao estruturais: se alguem remover o hook do renderPainelTop
 * ou tirar o heroAtivo de dentro do accordion, o teste acusa antes do deploy.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const INDEX = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');

test('o bloco painelTop existe com as 4 pecas do preview aprovado', () => {
  assert.match(INDEX, /id="painelTop"/, 'container painelTop sumiu');
  for (const id of ['pHeroPeso', 'pHeroPesoDelta', 'pTileDose', 'pTileProt', 'pCtaCheckin']) {
    assert.match(INDEX, new RegExp('id="' + id + '"'), 'peca do topo sumiu: ' + id);
  }
});

test('renderHero chama renderPainelTop (blindado) — sem o hook o topo congela', () => {
  const i = INDEX.indexOf('function renderHero(){');
  assert.ok(i > 0, 'renderHero sumiu');
  const trecho = INDEX.slice(i, i + 600);
  assert.match(trecho, /try\{ renderPainelTop\(\); \}catch\(e\)/,
    'o hook do renderPainelTop sumiu do renderHero — os numeros do topo nunca mais atualizam');
});

test('Onda 6 (formula ideal aprovada): Painel sem accordion, Saude e a casa do conteudo', () => {
  // v3.10.79 — regra dos vencedores (Whoop/Oura/Noom): NENHUM accordion na
  // home. Painel = aneis do dia + card de potencia (o diferencial) + licao +
  // portas de 1 linha. Analises/biblioteca moram na aba Saude.
  for (const id of ['aneisDia', 'potCard', 'licaoCard', 'progPorta']) {
    assert.match(INDEX, new RegExp('id="' + id + '"'), 'componente do Painel novo sumiu: ' + id);
  }
  assert.ok(!INDEX.includes('pAguaWrap') && !INDEX.includes('medDetalheToggle'),
    'accordion voltou a home do Painel — a formula aprovada e zero accordion');
  const hero = INDEX.indexOf('id="heroAtivo"');
  assert.match(INDEX.slice(hero, hero + 120), /display:none/, 'heroAtivo visivel de novo no Painel');
  // o conteudo mudou de casa, nao sumiu: pilares/analise/leia/metab na Saude
  const saude = INDEX.indexOf('id="sec-saude"');
  const fimSaude = INDEX.indexOf('id="sec-jornadaAcomp"');
  for (const id of ['id="quatroGauges"', 'id="pilaresAnaliseCard"', 'id="leiaTodoDiaBody"',
                    'id="metabBody"', 'id="progAccBody"']) {
    const pos = INDEX.indexOf(id);
    assert.ok(pos > saude && pos < fimSaude, id + ' fora da aba Saude — conteudo perdeu a casa');
  }
  // registro de refeicao continua na home, direto (unico gravador acessivel)
  assert.ok(INDEX.indexOf('id="cardRegistroRefeicao"') < INDEX.indexOf('id="sec-checkin"'),
    'cardRegistroRefeicao saiu da home');
});

test('o peso do topo reusa a regra do inicio declarado (bug dos 20vs21kg)', () => {
  const i = INDEX.indexOf('function renderPainelTop(){');
  assert.ok(i > 0, 'renderPainelTop sumiu');
  const trecho = INDEX.slice(i, i + 2500);
  assert.match(trecho, /weightStartKg/,
    'o delta do peso-heroi deixou de usar o peso declarado no perfil — volta o bug do total errado');
});
