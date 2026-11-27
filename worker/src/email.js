/**
 * Sanova — e-mails automaticos do teste gratis da licenca profissional.
 *
 * Leigo: o profissional que comeca o teste recebe tres e-mails, sem ninguem
 * precisar apertar botao:
 *   1. boas_vindas — logo que o teste comeca: como usar e quando sera cobrado.
 *   2. meio        — por volta do 7o dia: lembrete de vincular pacientes.
 *   3. vespera     — 2 dias antes da cobranca: valor, data e como cancelar.
 *
 * Quem dispara e a rotina emails-teste.yml (de hora em hora), chamando
 * /api/admin-emails-teste. Cada envio fica anotado em
 * subscriptions.emails_enviados, entao ninguem recebe o mesmo e-mail duas vezes.
 *
 * Envio pelo Resend (RESEND_API_KEY). Sem a chave, a rotina nao envia nada e
 * so informa quantos estao pendentes.
 *
 * Regras de texto (CLAUDE.md secao 5): sem promessa de resultado, sem nome
 * comercial de medicamento, com a fronteira clinica.
 */
import { SUPABASE_URL, svcHeadersFor } from './pro.js';
import { FOLGA_DIAS, PLANOS } from './mp.js';

const DIA = 86400000;
export const REMETENTE = 'Sanova <contato@sanova.app.br>';
export const RESPONDER_PARA = 'contatosanovaapp@gmail.com';
const PAINEL = 'https://sanova.app.br/pro.html';
const RODAPE_EMPRESA = 'Sanova é um produto da MEDFAST Serviços Médicos Ltda · CNPJ 45.051.037/0001-87';

/** Data da primeira cobranca: o teste guarda trial_ends_at com a folga somada. */
export function dataDaCobranca(sub) {
  const fim = sub && sub.trial_ends_at ? new Date(sub.trial_ends_at).getTime() : NaN;
  return isNaN(fim) ? null : new Date(fim - FOLGA_DIAS * DIA);
}

/**
 * Qual e-mail (no maximo um por rodada) este assinante deve receber agora.
 * Funcao pura. Devolve 'boas_vindas' | 'meio' | 'vespera' | null.
 */
export function proximoEmail(sub, agoraMs) {
  const agora = typeof agoraMs === 'number' ? agoraMs : Date.now();
  if (!sub || sub.plano !== 'pro' || sub.status !== 'trial') return null;
  const cobranca = dataDaCobranca(sub);
  if (!cobranca || cobranca.getTime() <= agora) return null;   // teste ja acabou
  const ja = sub.emails_enviados || {};
  if (!ja.boas_vindas) return 'boas_vindas';
  const faltam = cobranca.getTime() - agora;
  if (!ja.vespera && faltam <= 2 * DIA) return 'vespera';
  const inicio = sub.trial_started_at ? new Date(sub.trial_started_at).getTime() : NaN;
  // O de meio so faz sentido longe da vespera, pra nao chegar dois seguidos.
  if (!ja.meio && !ja.vespera && !isNaN(inicio) && agora - inicio >= 6 * DIA && faltam > 3 * DIA) return 'meio';
  return null;
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function dataBR(d) {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo' });
}
function precoBR() {
  return 'R$ ' + PLANOS.pro.auto_recurring.transaction_amount.toFixed(2).replace('.', ',').replace(',00', '');
}

function moldura(titulo, blocos) {
  const corpo = blocos.map((b) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#16241b">${b}</p>`).join('');
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f7f2e8;font-family:Arial,Helvetica,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:28px 20px">
<div style="font-family:Georgia,serif;font-size:22px;color:#0f5a29;margin-bottom:20px">🌿 Sanova Pro</div>
<div style="background:#ffffff;border:1px solid #e2d9c6;border-radius:14px;padding:26px 24px">
<h1 style="font-family:Georgia,serif;font-weight:normal;font-size:23px;line-height:1.25;color:#07190d;margin:0 0 18px">${esc(titulo)}</h1>
${corpo}
<p style="margin:22px 0 0"><a href="${PAINEL}" style="display:inline-block;background:#1a9e4f;color:#ffffff;text-decoration:none;font-weight:bold;padding:13px 22px;border-radius:10px">Abrir meu painel</a></p>
</div>
<p style="font-size:12px;line-height:1.6;color:#6b7a70;margin:18px 4px 0">O Sanova organiza e sinaliza registros feitos pelo paciente. Não substitui a avaliação clínica, e ausência de alerta não significa ausência de risco.</p>
<p style="font-size:12px;line-height:1.6;color:#6b7a70;margin:8px 4px 0">Você recebe este e-mail porque iniciou um teste do Sanova Pro. ${esc(RODAPE_EMPRESA)}</p>
</div></body></html>`;
}

/**
 * Monta um e-mail. Funcao pura.
 * @param chave 'boas_vindas' | 'meio' | 'vespera'
 * @param d { nome, invite_code, cobranca: Date }
 */
export function montarEmail(chave, d) {
  const nome = (d.nome || '').trim();
  const ola = nome ? `Olá, ${esc(nome)}.` : 'Olá.';
  const quando = dataBR(d.cobranca);
  const preco = precoBR();
  const codigo = d.invite_code ? `<strong>${esc(d.invite_code)}</strong>` : 'que aparece no topo do painel';
  const cancelar = `Para cancelar, abra o painel e toque em <strong>Cancelar assinatura</strong>, no rodapé. As cobranças param e o acesso continua até o fim do período que já estava valendo.`;

  if (chave === 'boas_vindas') {
    return {
      subject: 'Seu teste do Sanova Pro começou',
      html: moldura('Seu teste de 14 dias está ativo', [
        ola + ' Seu painel já está liberado.',
        `<strong>Primeiro passo:</strong> passe o seu código de convite ${codigo} aos pacientes. No aplicativo, eles vão em <em>Mais → Vincular profissional</em>, digitam o código e autorizam o compartilhamento.`,
        'Enquanto ninguém se vincula, o painel mostra três pacientes fictícios, para você conhecer o semáforo e a ficha em modo leitura.',
        `<strong>Sobre a cobrança:</strong> o teste é gratuito até ${quando}. Nessa data, o cartão cadastrado no Mercado Pago passa a ser cobrado em ${preco} por mês. ${cancelar}`,
      ]),
    };
  }
  if (chave === 'meio') {
    return {
      subject: 'Uma semana de Sanova Pro: já tem paciente vinculado?',
      html: moldura('O painel só mostra valor com os seus pacientes', [
        ola + ' Você está na metade do teste.',
        `Se ainda não vinculou ninguém, vale fazer com dois ou três pacientes nesta semana. O código de convite é ${codigo}. O paciente instala o Sanova no celular, vai em <em>Mais → Vincular profissional</em> e digita o código.`,
        'Com pacientes reais, o painel passa a mostrar quem registrou, quem parou e quem ficou abaixo das metas de proteína e de calorias dele.',
        `O teste gratuito vai até ${quando}.`,
      ]),
    };
  }
  if (chave === 'vespera') {
    return {
      subject: 'Seu teste do Sanova Pro termina em 2 dias',
      html: moldura(`Primeira cobrança em ${quando}`, [
        ola + ' Seu teste gratuito está chegando ao fim.',
        `Em ${quando}, o cartão cadastrado no Mercado Pago será cobrado em ${preco}, e a licença segue mês a mês. Se você quer continuar, não precisa fazer nada.`,
        cancelar,
        'Se tiver alguma dúvida, é só responder a este e-mail.',
      ]),
    };
  }
  return null;
}

async function enviarResend({ to, subject, html }, env) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: REMETENTE, to: [to], reply_to: RESPONDER_PARA, subject, html }),
  });
  if (!r.ok) {
    const corpo = await r.text().catch(() => '');
    throw new Error('Resend HTTP ' + r.status + ' ' + corpo.slice(0, 200));
  }
  return true;
}

/**
 * GET /api/admin-emails-teste        envia o que estiver devido
 * GET /api/admin-emails-teste?dry=1  so conta, nao envia
 * Nunca devolve endereco de e-mail: so contagens e chaves.
 */
export async function handleAdminEmailsTeste(request, env) {
  const dry = new URL(request.url).searchParams.get('dry') === '1';
  const h = svcHeadersFor(env);
  const out = { ok: true, dry, candidatos: 0, devidos: {}, enviados: {}, falhas: 0 };
  const resp = await fetch(SUPABASE_URL + '/rest/v1/subscriptions?plano=eq.pro&status=eq.trial&select=*', { headers: h });
  const subs = await resp.json().catch(() => []);
  if (!Array.isArray(subs)) return json({ ok: false, error: 'subs_query_failed' }, 500);
  out.candidatos = subs.length;
  const semChave = !env.RESEND_API_KEY;
  if (semChave) out.motivo = 'sem_chave';

  for (const sub of subs) {
    const chave = proximoEmail(sub);
    if (!chave) continue;
    out.devidos[chave] = (out.devidos[chave] || 0) + 1;
    if (dry || semChave) continue;
    try {
      const u = await fetch(SUPABASE_URL + '/auth/v1/admin/users/' + sub.user_id, { headers: h });
      const ud = u.ok ? await u.json().catch(() => null) : null;
      const to = ud && ud.email;
      if (!to) { out.falhas++; continue; }
      const p = await fetch(SUPABASE_URL + '/rest/v1/professionals?user_id=eq.' + encodeURIComponent(sub.user_id) + '&select=nome,invite_code', { headers: h });
      const pa = await p.json().catch(() => []);
      const pro = (Array.isArray(pa) && pa[0]) || {};
      const msg = montarEmail(chave, { nome: pro.nome, invite_code: pro.invite_code, cobranca: dataDaCobranca(sub) });
      await enviarResend({ to, subject: msg.subject, html: msg.html }, env);
      const marca = { ...(sub.emails_enviados || {}), [chave]: new Date().toISOString() };
      await fetch(SUPABASE_URL + '/rest/v1/subscriptions?user_id=eq.' + encodeURIComponent(sub.user_id), {
        method: 'PATCH', headers: { ...h, 'Prefer': 'return=minimal' }, body: JSON.stringify({ emails_enviados: marca }),
      });
      out.enviados[chave] = (out.enviados[chave] || 0) + 1;
    } catch (e) {
      out.falhas++;
      console.error('[emails-teste] falha', chave, String(e && e.message || e).slice(0, 200));
    }
  }
  return json(out, 200);
}

/**
 * GET /api/admin-email-prova
 * Manda UM e-mail de boas-vindas de exemplo para a caixa do proprio Sanova.
 * O destino e fixo de proposito: esta rota nao serve pra escrever a terceiros.
 */
export async function handleAdminEmailProva(request, env) {
  if (!env.RESEND_API_KEY) return json({ ok: false, error: 'sem_chave' }, 200);
  const msg = montarEmail('boas_vindas', {
    nome: 'Profissional de exemplo', invite_code: 'SAN-EXEM',
    cobranca: new Date(Date.now() + 14 * DIA),
  });
  try {
    await enviarResend({ to: RESPONDER_PARA, subject: '[prova] ' + msg.subject, html: msg.html }, env);
    return json({ ok: true, enviado: true }, 200);
  } catch (e) {
    return json({ ok: false, error: String(e && e.message || e).slice(0, 300) }, 200);
  }
}

function json(o, status) {
  return new Response(JSON.stringify(o, null, 2), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}
