/**
 * Licenca profissional: R$ 247/mes, 14 dias gratis com cartao, cobranca
 * automatica ao fim do teste, cancelamento pelo proprio assinante.
 *
 * O dinheiro passa por aqui. Estes testes travam as regras sem rede.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PLANOS, TESTE_PRO_DIAS, FOLGA_DIAS, tipoPlano, decidirAssinatura } from '../src/mp.js';
import { licencaDe } from '../src/pro.js';

const DIA = 86400000;
const AGORA = '2026-12-01T12:00:00.000Z';
const ms = (iso) => Date.parse(iso);

test('plano pro: R$ 247 por mes com 14 dias gratis', () => {
  const ar = PLANOS.pro.auto_recurring;
  assert.equal(ar.transaction_amount, 247);
  assert.equal(ar.frequency, 1);
  assert.equal(ar.frequency_type, 'months');
  assert.deepEqual(ar.free_trial, { frequency: 14, frequency_type: 'days' });
  assert.equal(TESTE_PRO_DIAS, 14);
});

test('planos de paciente nao mudaram e nao tem teste com cartao', () => {
  assert.equal(PLANOS.mensal.auto_recurring.transaction_amount, 19.90);
  assert.equal(PLANOS.anual.auto_recurring.transaction_amount, 199);
  assert.equal(PLANOS.mensal.auto_recurring.free_trial, undefined);
  assert.equal(PLANOS.anual.auto_recurring.free_trial, undefined);
});

test('tipo de plano desconhecido cai no mensal (o mais barato), nunca no pro', () => {
  for (const t of [undefined, null, '', 'PRO', 'medico', 'x']) assert.equal(tipoPlano(t), 'mensal');
  assert.equal(tipoPlano('pro'), 'pro');
  assert.equal(tipoPlano('anual'), 'anual');
});

test('pro com cartao cadastrado e sem cobranca = teste gratis ate a 1a cobranca', () => {
  const pa = { id: 'pa1', status: 'authorized', next_payment_date: '2026-12-15T12:00:00.000Z', summarized: { charged_quantity: 0 } };
  const m = decidirAssinatura(pa, 'pro', AGORA);
  assert.equal(m.status, 'trial');
  assert.equal(m.plano, 'pro');
  assert.equal(m.mp_preapproval_id, 'pa1');
  assert.equal(ms(m.trial_ends_at), ms('2026-12-15T12:00:00.000Z') + FOLGA_DIAS * DIA);
});

test('pro em teste sem data do MP: conta 14 dias', () => {
  const m = decidirAssinatura({ id: 'pa1', status: 'authorized' }, 'pro', AGORA);
  assert.equal(ms(m.trial_ends_at), ms(AGORA) + (14 + FOLGA_DIAS) * DIA);
});

test('paciente com cartao cadastrado e sem cobranca: nada muda', () => {
  const pa = { id: 'pa2', status: 'authorized', summarized: { charged_quantity: 0 } };
  assert.equal(decidirAssinatura(pa, 'mensal', AGORA), null);
  assert.equal(decidirAssinatura(pa, null, AGORA), null);
});

test('cobranca feita = ativa, com validade no futuro; pro marca o plano', () => {
  const pa = { id: 'pa3', status: 'authorized', next_payment_date: '2027-01-15T12:00:00.000Z', summarized: { charged_quantity: 1, last_charged_date: '2026-12-15T12:00:00.000Z' } };
  const pro = decidirAssinatura(pa, 'pro', '2026-12-15T12:05:00.000Z');
  assert.equal(pro.status, 'active');
  assert.equal(pro.plano, 'pro');
  assert.ok(ms(pro.subscription_ends_at) > ms('2027-01-15T00:00:00.000Z'));
  const pac = decidirAssinatura(pa, 'mensal', '2026-12-15T12:05:00.000Z');
  assert.equal(pac.status, 'active');
  assert.equal('plano' in pac, false, 'pagamento de paciente nao mexe no plano');
});

test('cancelada pelo assinante: nao toca nas datas (vale ate o fim)', () => {
  const m = decidirAssinatura({ id: 'pa4', status: 'cancelled' }, 'pro', AGORA);
  assert.equal(m.status, 'canceled');
  assert.equal('subscription_ends_at' in m, false);
  assert.equal('trial_ends_at' in m, false);
});

test('pausada por falta de pagamento: acesso termina agora', () => {
  const m = decidirAssinatura({ id: 'pa5', status: 'paused' }, 'pro', AGORA);
  assert.equal(m.status, 'canceled');
  assert.equal(m.subscription_ends_at, AGORA);
  assert.equal(m.trial_ends_at, AGORA);
});

test('pendente (checkout aberto, nada confirmado): nada muda', () => {
  assert.equal(decidirAssinatura({ id: 'pa6', status: 'pending' }, 'pro', AGORA), null);
});

// ── licenca ──────────────────────────────────────────────────────────
const T = ms(AGORA);
const futuro = new Date(T + 5 * DIA).toISOString();
const passado = new Date(T - 5 * DIA).toISOString();

test('sem assinatura ou com plano de paciente: sem licenca', () => {
  assert.equal(licencaDe(null, T).ativa, false);
  assert.equal(licencaDe({ plano: 'paciente', status: 'active', subscription_ends_at: futuro }, T).ativa, false);
});

test('pro em teste dentro do prazo: licenca ativa', () => {
  const l = licencaDe({ plano: 'pro', status: 'trial', trial_ends_at: futuro, mp_preapproval_id: 'abc' }, T);
  assert.equal(l.ativa, true); assert.equal(l.situacao, 'teste'); assert.equal(l.tem_assinatura_mp, true);
});

test('pro com teste vencido e sem pagamento: expirada', () => {
  const l = licencaDe({ plano: 'pro', status: 'trial', trial_ends_at: passado }, T);
  assert.equal(l.ativa, false); assert.equal(l.situacao, 'expirada');
});

test('pro pago em dia: ativa; vencido: expirada', () => {
  assert.equal(licencaDe({ plano: 'pro', status: 'active', subscription_ends_at: futuro }, T).ativa, true);
  assert.equal(licencaDe({ plano: 'pro', status: 'active', subscription_ends_at: passado }, T).ativa, false);
});

test('pro cancelado mantem acesso ate o fim do que ja valia', () => {
  const noTeste = licencaDe({ plano: 'pro', status: 'canceled', trial_ends_at: futuro }, T);
  assert.equal(noTeste.ativa, true); assert.equal(noTeste.situacao, 'cancelada');
  const pago = licencaDe({ plano: 'pro', status: 'canceled', subscription_ends_at: futuro, trial_ends_at: passado }, T);
  assert.equal(pago.ativa, true);
  assert.equal(licencaDe({ plano: 'pro', status: 'canceled', subscription_ends_at: passado, trial_ends_at: passado }, T).ativa, false);
});

test('assinatura simulada ou de demonstracao nao conta como assinatura no MP', () => {
  assert.equal(licencaDe({ plano: 'pro', status: 'active', subscription_ends_at: futuro, mp_preapproval_id: 'admin-simulated-1' }, T).tem_assinatura_mp, false);
  assert.equal(licencaDe({ plano: 'pro', status: 'active', subscription_ends_at: futuro, mp_preapproval_id: 'demo-abc' }, T).tem_assinatura_mp, false);
});

// ── trava: dado de paciente so sai com licenca ───────────────────────
test('rotas que entregam dado de paciente exigem licenca', () => {
  const pro = readFileSync(new URL('../src/pro.js', import.meta.url), 'utf8');
  for (const fn of ['handleProPatients', 'handleProPatient', 'handleSpectatorState']) {
    const i = pro.indexOf('export async function ' + fn + '(');
    assert.ok(pro.slice(i, i + 600).includes('requireProLicenciado('), fn + ' sem trava de licenca');
  }
  const al = readFileSync(new URL('../src/alerts.js', import.meta.url), 'utf8');
  for (const fn of ['handleProAlertsList', 'handleProAlertsDismiss']) {
    const i = al.indexOf('export async function ' + fn + '(');
    assert.ok(al.slice(i, i + 600).includes('requireProLicenciado('), fn + ' sem trava de licenca');
  }
});

test('cancelamento exige sessao e so mexe na assinatura de quem pediu', () => {
  const src = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
  const i = src.indexOf('async function handleMpCancel');
  const f = src.slice(i, i + 1600);
  assert.ok(f.includes('verifyJwt(request, env)'));
  assert.ok(f.includes('getSubscriptionByUser(sessao.id'));
  assert.ok(f.includes('updateSubscriptionByUser(sessao.id'));
  assert.equal(/body\.userId|body\.user_id/.test(f), false, 'nao pode aceitar usuario vindo do corpo');
});

// ── telas ────────────────────────────────────────────────────────────
test('painel pro: preco e dias de teste iguais aos do servidor', () => {
  const html = readFileSync(new URL('../../pro.html', import.meta.url), 'utf8');
  assert.ok(html.includes("const LICENCA_PRECO = 'R$ 247';"));
  assert.ok(html.includes('const LICENCA_TESTE_DIAS = ' + TESTE_PRO_DIAS + ';'));
  assert.ok(html.includes("plano: 'pro'"), 'checkout do painel tem que pedir o plano pro');
  assert.ok(html.includes("'/api/mp-cancel'"), 'painel sem botao de cancelar');
});

test('app do paciente consulta o acesso por vinculo', () => {
  const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  assert.ok(html.includes("sb.rpc('acesso_via_profissional')"));
});

// ── pagina de vendas ─────────────────────────────────────────────────
test('pagina de vendas: preco e teste iguais aos do servidor, sem promessa clinica', () => {
  const html = readFileSync(new URL('../../medicos.html', import.meta.url), 'utf8');
  assert.ok(html.includes('R$ 247'), 'preco fora de sincronia');
  assert.ok(html.includes(TESTE_PRO_DIAS + ' dias grátis'), 'dias de teste fora de sincronia');
  assert.ok(html.includes('href="/pro.html"'), 'botao tem que levar ao cadastro');
  assert.ok(html.includes('Ausência de alerta não significa ausência de risco'), 'aviso de fronteira clinica ausente');
  // CLAUDE.md secao 5: sem nome comercial de medicamento nem promessa de resultado.
  for (const proibido of [/ozempic/i, /mounjaro/i, /wegovy/i, /saxenda/i, /zepbound/i, /garant/i, /comprovad/i, /cura\b/i]) {
    assert.equal(proibido.test(html), false, 'termo proibido na pagina: ' + proibido);
  }
});
