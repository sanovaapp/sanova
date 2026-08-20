/**
 * A configuracao do frasco tem UMA fonte de verdade — e ela persiste.
 *
 * Achado nas 5 simulacoes pedidas pelo Bruno (20/08), testando o app de
 * verdade no navegador:
 *
 *   SIM5 (GRAVE, risco de dose): reajustar o frasco no formulario (farmacia
 *   nova, 30 mg/mL) salvava no estado — mas a calculadora so puxava o estado
 *   quando o input estava VAZIO. O input velho (15) ficava na tela, e ao
 *   digitar a dose o auto-save gravava 15 DE VOLTA por cima do reajuste.
 *   A conta de UI sairia com o dobro do volume.
 *
 *   SIM3: digitar a concentracao sem a dose mutava S.caneta em memoria e o
 *   calcDil retornava ANTES do salvar() — recarregou, perdeu tudo.
 *
 * Estes testes travam a forma dos dois consertos no index.html.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const INDEX = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');

test('SIM5: os inputs da calculadora SEMPRE refletem S.caneta (sem guarda de vazio)', () => {
  // O anti-padrao era `if(iMg && !iMg.value && S.caneta...)` — input velho
  // nunca era sobrescrito e revertia reajuste via auto-save.
  const trecho = INDEX.slice(INDEX.indexOf("var iMg = el('calcMg'), iMl = el('calcMl'), iDose = el('calcDose'), iVol"), 2000 + INDEX.indexOf("var iMg = el('calcMg'), iMl = el('calcMl'), iDose = el('calcDose'), iVol"));
  assert.ok(!/!iMg\.value\s*&&/.test(trecho),
    'a guarda `!iMg.value &&` voltou — reajuste de frasco sera revertido pelo input velho (risco de dose)');
  assert.match(trecho, /if\(iMg && S\.caneta\.concRotuloMg\)/,
    'o prefill-sincronizacao do calcMg sumiu');
});

test('SIM3: o auto-save parcial do calcDil persiste com salvar()', () => {
  const i = INDEX.indexOf('Auto-save em S.caneta a cada digit');
  assert.ok(i > 0, 'bloco de auto-save sumiu do calcDil');
  const trecho = INDEX.slice(i, i + 900);
  assert.match(trecho, /_mudouCaneta/,
    'a flag de mudanca sumiu — mutacao parcial volta a viver so em memoria');
  assert.match(trecho, /if\(_mudouCaneta && typeof salvar === 'function'\) salvar\(\)/,
    'o salvar() do caminho parcial sumiu — digitar concentracao sem dose volta a se perder no reload');
});

test('salvarCaneta sincroniza a calculadora inline e nao depende do render()', () => {
  // Terceiro elo do mesmo bug: o render() no meio do salvarCaneta abortava a
  // sincronizacao quando qualquer grafico soluçava. O sync agora e inline
  // (antes do render) e o render e blindado com try/catch.
  const i = INDEX.indexOf('function salvarCaneta');
  const trecho = INDEX.slice(i, i + 3500);
  assert.match(trecho, /sincroniza os inputs da calculadora AQUI, inline/,
    'o sync inline do salvarCaneta sumiu');
  assert.match(trecho, /try\{ render\(\); \}catch\(e\)/,
    'o render() do salvarCaneta perdeu a blindagem — excecao ali volta a abortar o pos-save');
});

test('nenhum atalho registra frasco manipulado sem o checklist (achado do Bruno, 20/08)', () => {
  // O botao "Registrar dose" do hero do Painel, os cards de lembrete e a
  // agenda chamam registrarAplicacaoHoje() — que registrava SEM os 3 checks
  // de confirmacao (o respaldo clinico do ato). Agora: frasco manipulado e
  // desviado pro fluxo com checklist; e o proprio registrarAplicacaoFrasco
  // recusa registrar sem os 3 marcados (defesa em profundidade).
  const hoje_ = INDEX.slice(INDEX.indexOf('function registrarAplicacaoHoje'), INDEX.indexOf('function registrarAplicacaoHoje') + 2500);
  assert.match(hoje_, /isFrascoManipulado\(S\.caneta\.tipo\)/,
    'o desvio de frasco manipulado sumiu do registrarAplicacaoHoje');
  assert.match(hoje_, /Confirme os 3 itens de segurança/,
    'o aviso de checklist sumiu do atalho');
  const frasco_ = INDEX.slice(INDEX.indexOf('function registrarAplicacaoFrasco'), INDEX.indexOf('function registrarAplicacaoFrasco') + 1500);
  assert.match(frasco_, /\['chk1','chk2','chk3'\]\.every/,
    'a defesa em profundidade do registrarAplicacaoFrasco sumiu — botao habilitado por engano volta a registrar sem confirmacao');
});
