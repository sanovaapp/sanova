/**
 * Sanova — logica clinica reutilizavel no Worker.
 *
 * Helper de Protecao Muscular ESPELHADO com o monolito (index.html).
 *
 * ⚠️ ESPELHO RESTRITO (worker/src/clinical.js <-> index.html):
 *    So o objeto CRITERIOS_PM eh duplicado. Se mudar um valor aqui, mude no
 *    outro arquivo E bumpe a versao. Grep de auditoria: CRITERIOS_PM
 *
 * Por que nao um arquivo compartilhado de verdade: o monolito eh offline-first
 * sem bundler, nao pode depender de fetch pra criterio clinico. Espelhar 5
 * numeros com versao eh o anti-drift pragmatico — o Worker pode logar warning
 * se o client mandar uma versao diferente.
 */

export const CRITERIOS_PM = {
  piso_kcal_f: 1200,        // Helms / ISSN
  piso_kcal_m: 1500,
  deficit_max_pct: 20,      // kcalSegura = meta * (1 - deficit_max_pct/100)
  prot_min_pct: 100,        // proteção plena: prot >= 100% da meta
  versao: 'pm-v1',
};

/**
 * Computa o estado de Protecao Muscular pra um paciente.
 *
 * Mantém comportamento identico ao monolito (index.html linha ~13874).
 * Espelho restrito aos CRITERIOS_PM acima.
 *
 * @param {object} M       — metricas computadas { meta, pm, ... }
 * @param {number} kcal    — kcal consumidos no periodo
 * @param {number} prot    — proteina consumida (g) no periodo
 * @param {'M'|'F'} sexo
 * @param {object} opcoes  — { periodo?: 'hoje'|'semana'|'15d'|'mes' }
 * @returns {{ estado, titulo, mensagem, icone, cor }}
 */
export function calcEstadoProtecaoMuscular(M, kcal, prot, sexo, opcoes) {
  opcoes = opcoes || {};
  const periodo = opcoes.periodo || 'hoje';

  if (!M || !M.meta || M.meta <= 0) {
    return {
      estado: 'aguardando', icone: '⏳', cor: 'rgba(255,255,255,.85)', corHex: '#fff',
      titulo: 'Aguardando dados',
      mensagem: 'Configure seu perfil pra eu poder te acompanhar.',
    };
  }

  const protMeta = Math.round(M.pm || 0);
  const kcalMeta = Math.round(M.meta || 0);
  const pisoFisiol = sexo === 'M' ? CRITERIOS_PM.piso_kcal_m : CRITERIOS_PM.piso_kcal_f;
  const kcalSegura = Math.round(kcalMeta * (1 - CRITERIOS_PM.deficit_max_pct / 100));
  const protPct = protMeta > 0 ? Math.round((prot / protMeta) * 100) : 0;

  const sufixo = periodo === 'hoje' ? '' :
    (' · média ' + (periodo === 'semana' ? '7d' : (periodo === '15d' ? '15d' : '30d')));

  if (kcal < pisoFisiol) {
    return {
      estado: 'risco', icone: '🚨', cor: '#f3a88a', corHex: '#f3a88a',
      titulo: 'Risco — catabolismo provável',
      mensagem: kcal + ' kcal' + (periodo === 'hoje' ? ' hoje' : '/dia') +
        ' abaixo do piso fisiológico (' + pisoFisiol + '). Esse nível leva à perda de massa magra ' +
        'mesmo com proteína dobrada.',
    };
  }
  if (protPct < 80 && kcal < kcalSegura) {
    return {
      estado: 'risco', icone: '🚨', cor: '#f3a88a', corHex: '#f3a88a',
      titulo: 'Risco crítico — proteína E calorias baixas',
      mensagem: 'Falta proteína (' + protPct + '%) E energia. Esse combo é o que mais custa músculo ' +
        'na janela GLP-1.',
    };
  }
  if (protPct >= CRITERIOS_PM.prot_min_pct && kcal < kcalSegura) {
    return {
      estado: 'atencao', icone: '⚠️', cor: '#fcd34d', corHex: '#fcd34d',
      titulo: 'Atenção — músculo em risco',
      mensagem: 'Proteína em dia (' + protPct + '%). Mas calorias baixas (' + kcal +
        ' vs ~' + kcalMeta + '). Proteína extra não compensa déficit calórico grande.',
    };
  }
  if (protPct >= CRITERIOS_PM.prot_min_pct && kcal >= kcalSegura) {
    return {
      estado: 'protegida', icone: '💪', cor: '#86efac', corHex: '#86efac',
      titulo: 'Protegida — músculo em dia',
      mensagem: 'Proteína e energia em dia — massa magra preservada' + sufixo + '.',
    };
  }
  // protPct < prot_min_pct && kcal >= kcalSegura
  return {
    estado: 'atencao', icone: '⚠️', cor: '#fcd34d', corHex: '#fcd34d',
    titulo: 'Falta proteína — atenção',
    mensagem: 'Calorias OK, mas proteína em ' + protPct + '% da meta. Sem proteína suficiente, ' +
      'parte do peso perdido pode ser massa magra.',
  };
}

/**
 * Gera invite_code formato SAN-XXXX. Caracteres permitidos:
 * A-Z2-9 SEM 0/O/1/I/L pra evitar confusao na leitura/digitacao.
 */
const INVITE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function gerarInviteCode() {
  let s = '';
  const arr = new Uint8Array(4);
  crypto.getRandomValues(arr);
  for (let i = 0; i < 4; i++) {
    s += INVITE_ALPHABET[arr[i] % INVITE_ALPHABET.length];
  }
  return 'SAN-' + s;
}
