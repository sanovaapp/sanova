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

// Recorta a etapa de build, que e onde os tres bugs moravam.
const etapa = WF.slice(WF.indexOf('Bubblewrap update + build'), WF.indexOf('Localiza AAB'));

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
  const keystore = WF.slice(WF.indexOf('Restaura keystore'), WF.indexOf('Bubblewrap update'));
  assert.match(keystore, /if \[ -z "\$FP" \]/, 'falta o guarda de SHA-256 vazia');
  assert.match(keystore, /::error::/, 'o guarda tem que falhar o job, nao so avisar');
});

test('as senhas vao por variavel de ambiente, senao o build trava perguntando', () => {
  assert.match(WF, /BUBBLEWRAP_KEYSTORE_PASSWORD/);
  assert.match(WF, /BUBBLEWRAP_KEY_PASSWORD/);
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
