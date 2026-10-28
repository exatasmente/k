import { addDays, diffDays } from './dates.js';

// Estágios de vida: ciclo, gestação e pós-parto.
// Da gestação guardamos só datas (DUM, DPP, fim) e o método de datação.
// O desfecho (parto, perda, interrupção) NUNCA é perguntado nem armazenado:
// é o dado mais sensível do app e não muda nenhum cálculo.

export const PREGNANCY_DAYS = 280;
export const EARLY_TEST_WARNING_DAYS = 28;
export const MAX_GESTATION_DAYS = 300;

/**
 * @typedef {{id?: string, stage: 'pregnancy', start: string, end: string|null,
 *   dating: 'lmp'|'ultrasound', dueDate: string}} PregnancyStage
 * @typedef {{id?: string, stage: 'postpartum', start: string, end: string|null}} PostpartumStage
 */

/** Idade gestacional numa data, contada a partir da DUM (start). */
export function gestationalAge(lmp, date) {
  const days = diffDays(lmp, date);
  const weeks = Math.floor(days / 7);
  return {
    days, weeks, extraDays: days % 7,
    trimester: weeks < 14 ? 1 : weeks < 28 ? 2 : 3,
    label: `${weeks}s ${days % 7}d`,
  };
}

/**
 * Datação ao ativar o modo gestação (ou ao ajustar depois).
 * Pela DUM ou pela DPP do laudo da ultrassonografia, que costuma ser mais precisa.
 * @param {{method: 'lmp', lmp: string} | {method: 'ultrasound', dueDate: string}} input
 * @param {string} today
 */
export function datePregnancy(input, today) {
  const lmp = input.method === 'ultrasound' ? addDays(input.dueDate, -PREGNANCY_DAYS) : input.lmp;
  const ga = gestationalAge(lmp, today);
  if (ga.days < 0 || ga.days > MAX_GESTATION_DAYS) {
    return { valid: false, reason: ga.days < 0 ? 'future_date' : 'too_long' };
  }
  return {
    valid: true,
    stage: { stage: 'pregnancy', start: lmp, end: null, dating: input.method, dueDate: addDays(lmp, PREGNANCY_DAYS) },
    ga,
    // Teste costuma dar positivo a partir de ~4 semanas pela DUM. Menos que isso
    // sugere que o "último sangramento" foi um escape.
    earlyWarning: input.method === 'lmp' && ga.days < EARLY_TEST_WARNING_DAYS,
  };
}

/**
 * Encerra a gestação. Recebe só o próximo estágio escolhido, nunca o motivo.
 * @param {PregnancyStage[]|object[]} stages
 * @param {string} today
 * @param {'postpartum'|'cycle'} next
 */
export function endPregnancy(stages, today, next) {
  const out = stages.map((s) => (s.stage === 'pregnancy' && s.end == null ? { ...s, end: today } : s));
  if (next === 'postpartum') out.push({ stage: 'postpartum', start: today, end: null });
  return out;
}

/** Fecha o pós-parto quando a menstruação volta. */
export function endPostpartum(stages, periodStart) {
  return stages.map((s) => {
    if (s.stage !== 'postpartum' || s.end != null) return s;
    const end = addDays(periodStart, -1);
    return { ...s, end: end < s.start ? s.start : end };
  });
}

/** Gestação em andamento, se houver. */
export function activePregnancy(stages) {
  return stages.find((s) => s.stage === 'pregnancy' && s.end == null) ?? null;
}
