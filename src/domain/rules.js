import { addMonths } from './dates.js';

// Regras determinísticas de alerta. Rodam localmente, sem IA: a IA pode
// explicar um alerta, mas nunca é ela quem decide se ele existe.

export const IRREGULAR_RANGE_DAYS = 8;
export const IRREGULAR_WINDOW = 6;
export const IRREGULAR_MIN_CYCLES = 3;
export const EC_MAX_PER_CYCLE = 1;
export const EC_MAX_PER_12_MONTHS = 3;

/**
 * RN03: irregular se (maior − menor) dos últimos 6 ciclos completos passar de 8 dias.
 * O onboarding não informa variação, então precisa de ao menos 3 ciclos registrados.
 */
export function irregularity(ctx) {
  const lengths = ctx.cycles.slice(-IRREGULAR_WINDOW).map((c) => c.length);
  if (lengths.length < IRREGULAR_MIN_CYCLES) {
    return { status: 'insufficient_data', cyclesNeeded: IRREGULAR_MIN_CYCLES - lengths.length };
  }
  const shortest = Math.min(...lengths);
  const longest = Math.max(...lengths);
  const range = longest - shortest;
  return { status: range > IRREGULAR_RANGE_DAYS ? 'irregular' : 'regular', shortest, longest, range };
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

// Textos ficam aqui para que app e IA mostrem exatamente a mesma mensagem.
export const COPY = Object.freeze({
  irregular:
    'Seus últimos ciclos variaram mais de 8 dias entre o mais curto e o mais longo. ' +
    'Vale compartilhar esse histórico com sua ginecologista.',
  emergencyContraception:
    'Você registrou a pílula do dia seguinte várias vezes em pouco tempo. Ela tem alta carga hormonal ' +
    'e não é feita para uso frequente. Uma consulta pode ajudar a encontrar um método que funcione melhor para você.',
  // Aparece na tela de bloqueio: não pode revelar do que se trata.
  periodConfirmationNotification: 'Tem um registro esperando sua confirmação.',
});
