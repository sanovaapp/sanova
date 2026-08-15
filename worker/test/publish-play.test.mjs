/**
 * Guarda o pipeline de publicacao na Play Store.
 *
 * O primeiro disparo real (14/08) falhou com tres bugs empilhados, e o pior
 * deles nao era o erro em si — era que a etapa de build ficava VERDE em 12
 * segundos sem produzir nada. O sintoma so aparecia na etapa seguinte, como
 * "arquivo nao encontrado", longe da causa.
 *
 * Nao da pra rodar Bubblewrap aqui. O que estes testes travam sao as tres
 * condicoes que causaram a falha silenciosa.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const WF = readFileSync(
  new URL('../../.github/workflows/publish-play.yml', import.meta.url),
  'utf8',
);

/**
 * Recorta do inicio de uma etapa ate o inicio da proxima.
 *
 * Existe porque `WF.slice(indexOf(a), indexOf(b))` ja me enganou duas vezes:
 * se `b` aparece ANTES de `a` no arquivo — e "Nome do release" aparece, como
 * descricao de um campo do dispatch — a fatia sai vazia e o teste passa sem
 * olhar nada. Aqui a busca do fim comeca depois do inicio, e fatia vazia e
 * erro alto.
 */
function etapaEntre(inicio, fim) {
  const a = WF.indexOf(inicio);
  assert.ok(a >= 0, `etapa "${inicio}" sumiu do workflow`);
  const b = WF.indexOf(fim, a + inicio.length);
  assert.ok(b > a, `marcador de fim "${fim}" nao aparece depois de "${inicio}"`);
  return WF.slice(a, b);
}

// Recorta a etapa de build, que e onde os tres bugs moravam.
const etapa = etapaEntre('Bubblewrap update + build', 'Localiza AAB');

test('a etapa de build existe com o nome do que ela faz', () => {
  // Chamava-se "init + build" e nao rodava nenhum dos dois. Nome que mente
  // sobre o conteudo esconde bug.
  assert.ok(etapa.length > 0, 'etapa de build sumiu ou foi renomeada');
});

test('BUG 1: `update` roda antes do `build`', () => {
  // Sem `update` nao existe projeto Android pra construir — o workflow
  // escrevia o manifesto e chamava build direto, no vazio.
  const iUpdate = etapa.indexOf('bubblewrap update');
  const iBuild = etapa.indexOf('bubblewrap build');
  assert.ok(iUpdate > 0, 'falta `bubblewrap update` — sem ele nao ha projeto');
  assert.ok(iBuild > iUpdate, '`build` tem que vir depois de `update`');
});

test('BUG 2: pipefail ligado, senao o `tee` engole a falha', () => {
  // Com `cmd | tee log`, o `set -e` olha o codigo do tee. O bubblewrap
  // falhava, o tee dava certo, e a etapa passava verde.
  assert.match(etapa, /set -eo pipefail|set -o pipefail/,
    'sem pipefail, falha do bubblewrap vira etapa verde');
  assert.ok(etapa.includes('| tee'), 'o tee segue em uso — pipefail e obrigatorio');
});

test('BUG 3: o alias da chave nao pode ser cravado a mao', () => {
  // A keystore de junho veio do PWABuilder com alias `my-key-alias`. O
  // workflow chutava `android` em quatro lugares.
  assert.ok(!/--signingKeyAlias=android\b/.test(WF), 'alias `android` cravado no build');
  assert.ok(!/"alias":\s*"android"/.test(WF), 'alias `android` cravado no manifesto');
  assert.match(etapa, /signingKeyAlias="?\$\{?KEY_ALIAS/, 'o build tem que usar $KEY_ALIAS');
});

test('a leitura da SHA-256 falha alto quando o alias esta errado', () => {
  // Antes devolvia vazio em silencio e o erro aparecia paginas depois.
  const keystore = etapaEntre('Restaura keystore', 'Bubblewrap update');
  assert.match(keystore, /if \[ -z "\$FP" \]/, 'falta o guarda de SHA-256 vazia');
  assert.match(keystore, /::error::/, 'o guarda tem que falhar o job, nao so avisar');
});

test('as senhas vao por variavel de ambiente, senao o build trava perguntando', () => {
  assert.match(WF, /BUBBLEWRAP_KEYSTORE_PASSWORD/);
  assert.match(WF, /BUBBLEWRAP_KEY_PASSWORD/);
});

test('BUG 5: o AAB escolhido tem que ser o assinado, nao o cru do Gradle', () => {
  // A rodada 6 chegou no Google e levou:
  //   "All uploaded bundles must be signed. Please sign the bundle using jarsigner."
  // O Bubblewrap gera DOIS .aab — o cru do Gradle em
  // app/build/outputs/bundle/release/ e o assinado em app-release-bundle.aab.
  // `find | head -1` pegava o primeiro que a travessia devolvesse, e nao ha
  // ordem garantida: o mesmo workflow podia passar num dia e falhar no outro.
  const localiza = etapaEntre('Localiza AAB', 'Upload AAB como artifact');
  assert.ok(
    !/find\s+twa-build\s+-name\s+"\*\.aab".*\|\s*head\s+-1/.test(localiza),
    'o AAB nao pode ser escolhido por `find | head -1` — nao ha ordem garantida',
  );
  assert.match(localiza, /app-release-bundle\.aab/,
    'o AAB tem que ser escolhido pelo nome do artefato assinado');
});

test('a assinatura e conferida antes do upload, nao depois', () => {
  // Sem isso o bundle cru viaja o upload inteiro pra ser recusado do outro
  // lado — e o erro chega como mensagem do Google, longe da causa.
  const localiza = etapaEntre('Localiza AAB', 'Upload AAB como artifact');
  assert.match(localiza, /jarsigner -verify/, 'falta `jarsigner -verify` antes do upload');
  assert.match(localiza, /::error::/, 'a conferencia tem que derrubar o job, nao so avisar');
});

test('o secret do Play nao e interpolado dentro de teste do bash', () => {
  // `[ -z "${{ secrets.X }}" ]` quebrava com "too many arguments" — o JSON tem
  // aspas dentro e o bash reabria a string. Vai por variavel de ambiente.
  // Vale pro arquivo inteiro de proposito: recortar por nome de etapa ja me
  // enganou uma vez — mudei a ordem das etapas, a fatia virou string vazia e
  // o teste passou sem olhar nada.
  assert.ok(
    !/\[ -z "\$\{\{ secrets\./.test(WF),
    'secret interpolado direto no `[ -z ]` — o JSON quebra o quoting do bash',
  );
});

test('o appVersionCode e perguntado ao Google, nao chutado', () => {
  // Era `100 + run_number`: colide se o workflow for recriado (run_number
  // volta a 1) e obriga alguem a digitar o numero a cada release. Agora sai
  // do maior versionCode ja aceito pelo Play, + 1.
  assert.match(WF, /edits\/\$EDIT\/bundles/, 'falta consultar os bundles ja enviados');
  assert.match(WF, /next_vc=/, 'o proximo versionCode tem que virar output da etapa');
  assert.match(WF, /steps\.playapi\.outputs\.next_vc/, 'o build tem que consumir o versionCode da API');
});

test('o acesso a Play e conferido ANTES do build, nao depois', () => {
  // 90 segundos de Gradle antes de descobrir que a chave nao entra e desperdicio
  // — e foi assim que as rodadas 4, 5 e 6 gastaram duas horas.
  const iDiag = WF.indexOf('Diagnostico de acesso a Play API');
  const iBuild = WF.indexOf('Bubblewrap update + build');
  assert.ok(iDiag > 0 && iBuild > iDiag,
    'o diagnostico de acesso tem que vir antes do build');
});

test('o 403 do Google e traduzido antes de virar tarefa pro Bruno', () => {
  // A rodada 4 devolveu uma pagina HTML sem causa identificavel. Cada chute
  // custava uma rodada e uma ida ao Play Console.
  assert.match(WF, /Diagnostico de acesso a Play API/, 'etapa de diagnostico sumiu');
  assert.match(WF, /androidpublisher\.googleapis\.com/, 'o diagnostico tem que chamar a API de verdade');
  assert.match(WF, /SERVICE_DISABLED/, 'falta traduzir "API desligada"');
  assert.match(WF, /applicationNotFound/, 'falta traduzir "app nao esta nesta conta"');
});

test('BUG 6: o nome da faixa e traduzido pra lingua da Play API', () => {
  // A lista suspensa oferece "closed" e "open" porque e assim que o painel
  // chama. A API so conhece production, beta, alpha, internal. Mandar
  // "closed" derrubava o job:
  //   Track(s) "closed" could not be found
  // Ficou escondido ate 15/08 porque toda rodada tinha usado "internal".
  const etapa = etapaEntre('Determina track', 'Nome do release');
  assert.match(etapa, /closed\)\s*API_TRACK="alpha"/, 'falta traduzir closed → alpha');
  assert.match(etapa, /open\)\s*API_TRACK="beta"/, 'falta traduzir open → beta');
  assert.match(etapa, /production\|beta\|alpha\|internal/,
    'falta a lista branca das faixas que a API aceita');
  assert.match(etapa, /::error::/, 'faixa invalida tem que derrubar o job antes do upload');
});

test('toda opcao da lista suspensa tem traducao conhecida', () => {
  // Se alguem acrescentar uma opcao no dropdown e esquecer do `case`, ela
  // viaja crua pra API e o job morre no ultimo passo. Este teste casa as duas
  // listas.
  const bloco = etapaEntre("description: 'Play Console track", 'release_status');
  const opcoes = [...bloco.matchAll(/^\s+- (\w+)$/gm)].map((m) => m[1]);
  assert.ok(opcoes.length >= 4, `esperava 4+ opcoes, achei ${opcoes.length}`);
  const etapa = etapaEntre('Determina track', 'Nome do release');
  const API = ['production', 'beta', 'alpha', 'internal'];
  for (const o of opcoes) {
    const traduzida = new RegExp(`${o}\\)\\s*API_TRACK=`).test(etapa);
    assert.ok(
      API.includes(o) || traduzida,
      `a opcao '${o}' nao e nome de faixa da API nem tem traducao no case`,
    );
  }
});

test('BUG 4: minSdkVersion nao pode ser menor que 21', () => {
  // O segundo disparo morreu no merge de manifesto:
  //   "minSdkVersion 19 cannot be smaller than version 21 declared in library
  //    [com.google.androidbrowserhelper:2.6.2]"
  // Essa biblioteca e o que faz o TWA funcionar — nao da pra trocar nem baixar
  // a versao dela. 19 simplesmente nao compila.
  //
  // Vale pros DOIS workflows que montam AAB: se so um subir, o outro volta a
  // quebrar quando alguem usar.
  const arquivos = ['publish-play.yml', 'build-twa-aab.yml'];
  for (const nome of arquivos) {
    const txt = readFileSync(
      new URL(`../../.github/workflows/${nome}`, import.meta.url),
      'utf8',
    );
    const m = txt.match(/"minSdkVersion":\s*(\d+)/);
    assert.ok(m, `${nome}: minSdkVersion sumiu do manifesto`);
    assert.ok(
      Number(m[1]) >= 21,
      `${nome}: minSdkVersion ${m[1]} — a androidbrowserhelper exige 21`,
    );
  }
});
