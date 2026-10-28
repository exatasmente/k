import { addMonths } from './dates.js';
import { getItem, isKnownCode } from './catalog.js';
import { classifyRegularity } from './regularity.js';

// Regras determinísticas de alerta. Rodam localmente, sem IA: a IA pode
// explicar um alerta, mas nunca é ela quem decide se ele existe.

export const EC_MAX_PER_CYCLE = 1;
export const EC_MAX_PER_12_MONTHS = 3;

/**
 * RN03 em dois tons (ver regularity.js). Depois de uma gestação os primeiros
 * ciclos costumam ser irregulares: o aviso fica pausado até haver 3 ciclos novos.
 * @param {{cycles: {start: string, length: number}[], stages: {end: string|null}[]}} ctx
 */
export function irregularity(ctx) {
  const lastStageEnd = ctx.stages.reduce((max, s) => (s.end && s.end > max ? s.end : max), '');
  const ongoingStage = ctx.stages.some((s) => s.end == null);
  const cycles = lastStageEnd ? ctx.cycles.filter((c) => c.start >= lastStageEnd) : ctx.cycles;
  if (ongoingStage || (lastStageEnd && cycles.length < 3)) return { kind: 'paused', last: [] };
  return classifyRegularity(cycles.map((c) => c.length));
}

/**
 * RN04: pílula do dia seguinte 2+ vezes no mesmo ciclo ou mais de 3 vezes em 12 meses.
 * Avaliada no ciclo de `onDate` (o dia do registro que acabou de ser feito).
 * @param {string[]} ecDates datas com `emergency_contraception`
 */
export function emergencyContraceptionAlert(ctx, ecDates, onDate = ctx.today) {
  const cycleStart = [...ctx.periods].reverse().find((p) => p.start <= onDate)?.start;
  const nextStart = ctx.periods.find((p) => p.start > onDate)?.start;
  const yearAgo = addMonths(onDate, -12);
  const unique = [...new Set(ecDates)];

  const inCycle = cycleStart
    ? unique.filter((d) => d >= cycleStart && (nextStart == null || d < nextStart) && d <= onDate).length
    : 0;
  const in12Months = unique.filter((d) => d > yearAgo && d <= onDate).length;

  const reasons = [];
  if (inCycle > EC_MAX_PER_CYCLE) reasons.push('same_cycle');
  if (in12Months > EC_MAX_PER_12_MONTHS) reasons.push('twelve_months');
  return { triggered: reasons.length > 0, priority: 'high', reasons, inCycle, in12Months };
}

/**
 * Sinais de alerta da gestação marcados num dia: viram "Procure atendimento"
 * na Home e no registro. Fora da gestação nunca dispara.
 * @param {Iterable<string>} dayCodes
 * @param {'cycle'|'pregnancy'} stage
 */
export function pregnancyAlert(dayCodes, stage) {
  if (stage !== 'pregnancy') return { triggered: false, codes: [] };
  const codes = [...dayCodes].filter((c) => isKnownCode(c) && getItem(c).alert);
  return { triggered: codes.length > 0, priority: 'urgent', codes };
}

// Textos ficam aqui para que app e IA mostrem exatamente a mesma mensagem.
// PENDENTE de revisão por profissional de saúde antes de abrir para terceiras.
export const COPY = Object.freeze({
  irregular:
    'Seus últimos ciclos variaram mais de 8 dias entre o mais curto e o mais longo. ' +
    'Vale compartilhar esse histórico com sua ginecologista.',
  outlier:
    'Um ciclo saiu do padrão, mas os outros ficaram próximos. Isso pode acontecer de vez em quando; ' +
    'se repetir, vale mostrar este histórico à sua ginecologista.',
  paused:
    'Depois de uma gestação, principalmente amamentando, a menstruação pode demorar a voltar e vir irregular. ' +
    'Voltamos a avaliar quando houver 3 ciclos novos.',
  emergencyContraception:
    'Você registrou a pílula do dia seguinte várias vezes em pouco tempo. Ela tem alta carga hormonal ' +
    'e não é feita para uso frequente. Uma consulta pode ajudar a encontrar um método que funcione melhor para você.',
  pregnancyUrgent:
    'Isso precisa de avaliação. Procure atendimento hoje e avise sua equipe do pré-natal. ' +
    'Se for intenso ou piorar, vá ao pronto-socorro ou ligue 192 (SAMU).',
  longAbsence:
    'Faz mais de 3 meses sem menstruação registrada. Se você não está grávida nem amamentando, ' +
    'vale conversar com sua ginecologista.',
  // Aparece na tela de bloqueio: não pode revelar do que se trata.
  periodConfirmationNotification: 'Tem um registro esperando sua confirmação.',
});
