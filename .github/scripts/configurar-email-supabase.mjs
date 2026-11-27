// Liga o envio de e-mail do Supabase (link de acesso) ao Resend.
//
// Leigo: sem isto, o link de acesso do profissional sai pelo remetente de
// testes do Supabase, que so manda 2 e-mails por hora e nao serve pra venda.
// Com isto, sai por contato@sanova.app.br, pelo Resend.
//
// Nunca imprime segredo: no fim, mostra so os campos publicos da configuracao.
const REF = 'yjycpcydqfuvojfzwfvy';
const TOKEN = process.env.SUPABASE_MGMT_TOKEN;
const CHAVE = process.env.RESEND_API_KEY;
if (!TOKEN) { console.error('SUPABASE_MGMT_TOKEN ausente'); process.exit(1); }
if (!CHAVE) { console.error('RESEND_API_KEY ausente'); process.exit(1); }

const url = `https://api.supabase.com/v1/projects/${REF}/config/auth`;
const h = { 'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json' };

const corpo = {
  smtp_host: 'smtp.resend.com',
  smtp_port: '465',
  smtp_user: 'resend',
  smtp_pass: CHAVE,
  smtp_admin_email: 'contato@sanova.app.br',
  smtp_sender_name: 'Sanova',
  rate_limit_email_sent: 100,
};
const r = await fetch(url, { method: 'PATCH', headers: h, body: JSON.stringify(corpo) });
if (!r.ok) {
  const t = await r.text().catch(() => '');
  console.error('PATCH falhou: HTTP ' + r.status + ' ' + t.slice(0, 300).replaceAll(CHAVE, '<chave>'));
  process.exit(1);
}
const g = await fetch(url, { headers: h });
const c = await g.json().catch(() => ({}));
console.log('CONFIG_EMAIL ' + JSON.stringify({
  smtp_host: c.smtp_host, smtp_port: c.smtp_port, smtp_user: c.smtp_user,
  smtp_admin_email: c.smtp_admin_email, smtp_sender_name: c.smtp_sender_name,
  rate_limit_email_sent: c.rate_limit_email_sent, senha_definida: !!c.smtp_pass,
}));
const ok = c.smtp_host === 'smtp.resend.com' && c.smtp_admin_email === 'contato@sanova.app.br';
console.log(ok ? 'CONFIG_EMAIL_OK' : 'CONFIG_EMAIL_FALHOU');
process.exit(ok ? 0 : 1);
