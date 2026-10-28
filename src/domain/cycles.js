import { addDays, diffDays, isWithin } from './dates.js';
import { methodOn, tracksOvulation } from './contraception.js';

// Motor de ciclo: períodos menstruais, médias (RN02), previsão, fase do dia e
// fechamento automático de menstruação sem fim registrado (RF01.4).

export const DEFAULTS = Object.freeze({ cycleLength: 28, periodLength: 5 });
export const AUTO_CLOSE_AFTER_DAYS = 10;
export const LUTEAL_DAYS = 14;
export const FERTILE_DAYS_BEFORE_OVULATION = 5;
export const AVERAGE_WINDOW = 6;
export const MIN_CYCLES_WITHOUT_PRIOR = 3;
// Ciclos fora disso são tratados como registro faltando, não como ciclo real.
export const PLAUSIBLE_CYCLE = Object.freeze({ min: 15, max: 90 });
export const PLAUSIBLE_PERIOD = Object.freeze({ min: 1, max: 15 });
// Dias sem fluxo que ainda contam como a mesma menstruação.
const MERGE_GAP_DAYS = 2;

/**
 * @typedef {{start: string, end: string|null, source?: 'onboarding'|'user'|'auto'}} Period
 * @typedef {{stage: 'pregnancy'|'postpartum', start: string, end: string|null}} LifeStage
 * @typedef {{lastPeriodStart: string, periodLength: number, cycleLength: number, birthDate: string}} Onboarding
 */

/** Valida o onboarding (Tela 1) e devolve o primeiro período registrado. */
export function periodFromOnboarding(onboarding) {
  const { lastPeriodStart, periodLength, cycleLength } = onboarding;
  assertRange('cycleLength', cycleLength, PLAUSIBLE_CYCLE);
  assertRange('periodLength', periodLength, PLAUSIBLE_PERIOD);
  return { start: lastPeriodStart, end: addDays(lastPeriodStart, periodLength - 1), source: 'onboarding' };
}

function assertRange(name, value, { min, max }) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new RangeError(`${name} deve ser um inteiro entre ${min} e ${max}`);
  }
}

const byStart = (a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0);

function openPeriodCovers(period, date) {
  return period.end == null && date >= period.start && diffDays(period.start, date) < AUTO_CLOSE_AFTER_DAYS;
}

/**
 * Marca um dia com fluxo (ou "Menstruei"). Estende a menstruação vizinha
 * ou abre uma nova. Hoje abre em aberto; dia passado vira período de 1 dia.
 * @param {Period[]} periods
 * @param {string} date
 * @param {string} today
 * @returns {Period[]}
 */
export function registerFlowDay(periods, date, today) {
  const sorted = [...periods].sort(byStart);
  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    if (p.end != null ? isWithin(date, p.start, p.end) : openPeriodCovers(p, date)) return sorted;
    if (p.end != null && date > p.end && diffDays(p.end, date) <= MERGE_GAP_DAYS + 1) {
      sorted[i] = { ...p, end: date };
      return sorted;
    }
    if (date < p.start && diffDays(date, p.start) <= MERGE_GAP_DAYS + 1) {
      sorted[i] = { ...p, start: date };
      return sorted;
    }
  }
  const created = { start: date, end: date < today ? date : null, source: 'user' };
  return [...sorted, created].sort(byStart);
}

/**
 * Desmarca o fluxo de um dia. Só encolhe pelas pontas: tirar um dia do meio
 * mantém a menstruação contínua (a intensidade do dia é que some).
 * @param {Period[]} periods
 * @param {string} date
 * @returns {Period[]}
 */
export function unregisterFlowDay(periods, date) {
  const out = [];
  for (const p of [...periods].sort(byStart)) {
    if (p.start === date && (p.end === date || p.end == null)) continue;
    if (p.start === date) out.push({ ...p, start: addDays(date, 1) });
    else if (p.end === date) out.push({ ...p, end: addDays(date, -1) });
    else out.push(p);
  }
  return out;
}

/** "Minha menstruação terminou" — fecha o período em aberto que contém `date`. */
export function endPeriod(periods, date) {
  return periods.map((p) => (p.end == null && date >= p.start ? { ...p, end: date } : p));
}

/** Estágio de vida numa data (modo gestação/pós-parto suspende o ciclo). */
export function stageOn(stages, date) {
  const match = stages.find((s) => isWithin(date, s.start, s.end));
  return match ? match.stage : 'cycle';
}

function overlapsStage(stages, start, endExclusive) {
  return stages.some((s) => s.start < endExclusive && (s.end == null || s.end >= start));
}

function average(values) {
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
}

/**
 * Média dos últimos ciclos (RN02). Com menos de 3 ciclos o valor do onboarding
 * entra como mais um ponto, para a previsão já funcionar desde o primeiro dia.
 */
function blendedAverage(values, prior) {
  const recent = values.slice(-AVERAGE_WINDOW);
  if (recent.length === 0) return prior;
  if (recent.length < MIN_CYCLES_WITHOUT_PRIOR) return average([prior, ...recent]);
  return average(recent);
}

/**
 * Monta tudo que as telas e as regras precisam saber sobre o ciclo.
 * @param {{periods: Period[], stages?: LifeStage[], methods?: import('./contraception.js').MethodPeriod[], onboarding: Onboarding, today: string}} input
 */
export function buildCycleContext({ periods, stages = [], methods = [], onboarding, today }) {
  const priorCycle = onboarding?.cycleLength ?? DEFAULTS.cycleLength;
  const priorPeriod = onboarding?.periodLength ?? DEFAULTS.periodLength;

  const closedLengths = periods
    .filter((p) => p.end != null && p.end <= today)
    .sort(byStart)
    .map((p) => diffDays(p.start, p.end) + 1)
    .filter((n) => n >= PLAUSIBLE_PERIOD.min && n <= PLAUSIBLE_PERIOD.max);
  const avgPeriodLength = blendedAverage(closedLengths, priorPeriod);

  // RF01.4: menstruação aberta há 10+ dias é fechada pela média e pede confirmação.
  const pendingConfirmation = [];
  const effective = [...periods].sort(byStart).map((p) => {
    if (p.end == null && diffDays(p.start, today) >= AUTO_CLOSE_AFTER_DAYS) {
      const closed = { ...p, end: addDays(p.start, avgPeriodLength - 1), source: 'auto' };
      pendingConfirmation.push(closed);
      return closed;
    }
    return p;
  });

  const cycles = [];
  for (let i = 0; i + 1 < effective.length; i++) {
    const start = effective[i].start;
    const next = effective[i + 1].start;
    const length = diffDays(start, next);
    if (length < PLAUSIBLE_CYCLE.min || length > PLAUSIBLE_CYCLE.max) continue;
    if (overlapsStage(stages, start, next)) continue;
    cycles.push({ start, length });
  }
  const avgCycleLength = blendedAverage(cycles.map((c) => c.length), priorCycle);

  return { today, periods: effective, stages, methods, cycles, avgCycleLength, avgPeriodLength, pendingConfirmation };
}

function ovulationFor(nextStart) {
  const ovulation = addDays(nextStart, -LUTEAL_DAYS);
  return {
    ovulation,
    fertileWindow: { start: addDays(ovulation, -FERTILE_DAYS_BEFORE_OVULATION), end: addDays(ovulation, 1) },
  };
}

/**
 * Fase de qualquer dia (presente ou passado). Usado no anel da tela Hoje,
 * no calendário e na correlação sintoma × fase (RF06).
 * Fases: menstrual | follicular | ovulatory | luteal | late | not_tracked | pregnancy | postpartum | unknown.
 * `not_tracked` = método que suprime ovulação: só existe menstrual ou fora dela.
 */
export function phaseOn(ctx, date) {
  const stage = stageOn(ctx.stages, date);
  if (stage !== 'cycle') return { phase: stage };

  const idx = findLastIndex(ctx.periods, (p) => p.start <= date);
  if (idx < 0) return { phase: 'unknown' };
  const period = ctx.periods[idx];
  const nextActual = ctx.periods[idx + 1]?.start;
  const nextStart = nextActual ?? addDays(period.start, ctx.avgCycleLength);
  const cycleDay = diffDays(period.start, date) + 1;
  const base = { cycleStart: period.start, cycleDay, expectedNextStart: nextStart, ovulation: null, fertileWindow: null };

  // Menstruação em aberto vale até hoje (ainda sangrando) e, no futuro, pela média.
  const projectedEnd = addDays(period.start, ctx.avgPeriodLength - 1);
  const periodEnd = period.end ?? (projectedEnd > ctx.today ? projectedEnd : ctx.today);
  if (date <= periodEnd) return { ...base, phase: 'menstrual' };
  if (!nextActual && date >= nextStart) {
    return { ...base, phase: 'late', daysLate: diffDays(nextStart, date) };
  }
  if (!tracksOvulation(methodOn(ctx.methods, date))) return { ...base, phase: 'not_tracked' };

  const { ovulation, fertileWindow } = ovulationFor(nextStart);
  const withOvulation = { ...base, ovulation, fertileWindow };
  if (date < fertileWindow.start) return { ...withOvulation, phase: 'follicular' };
  if (date <= fertileWindow.end) return { ...withOvulation, phase: 'ovulatory' };
  return { ...withOvulation, phase: 'luteal' };
}

/**
 * Previsão para a tela Hoje e o calendário: próximas menstruações e, quando o
 * método permite, ovulação e janela fértil de cada uma.
 */
export function predict(ctx, count = 3) {
  const stage = stageOn(ctx.stages, ctx.today);
  if (stage !== 'cycle') return { mode: stage, upcoming: [] };
  const last = findLast(ctx.periods, (p) => p.start <= ctx.today);
  if (!last) return { mode: 'cycle', upcoming: [] };

  const showFertility = tracksOvulation(methodOn(ctx.methods, ctx.today));
  const firstNext = addDays(last.start, ctx.avgCycleLength);
  const upcoming = [];
  for (let i = 0; i < count; i++) {
    const start = addDays(firstNext, i * ctx.avgCycleLength);
    const entry = { start, end: addDays(start, ctx.avgPeriodLength - 1), ovulation: null, fertileWindow: null };
    upcoming.push(showFertility ? { ...entry, ...ovulationFor(start) } : entry);
  }
  const daysUntilNext = diffDays(ctx.today, firstNext);
  return { mode: 'cycle', upcoming, daysUntilNext, daysLate: daysUntilNext < 0 ? -daysUntilNext : 0 };
}

function findLastIndex(list, fn) {
  for (let i = list.length - 1; i >= 0; i--) if (fn(list[i])) return i;
  return -1;
}

function findLast(list, fn) {
  const i = findLastIndex(list, fn);
  return i < 0 ? undefined : list[i];
}
