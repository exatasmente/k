import { addDays, diffDays, isWithin } from './dates.js';
import { methodOn, tracksOvulation } from './contraception.js';
import { lengthsForAverage } from './regularity.js';

// Motor de ciclo: períodos menstruais, médias (RN02), previsão em janela, fase do
// dia e fechamento automático de menstruação sem fim registrado (RF01.4).

export const DEFAULTS = Object.freeze({ cycleLength: 28, periodLength: 5 });
export const AUTO_CLOSE_AFTER_DAYS = 10;
// Fontes de cada número: docs/fontes-clinicas.md.
// Ovulação estimada 14 dias antes da próxima menstruação (o MS fala em 11 a 16 dias;
// a média real da fase lútea é ~12,4 ± 2,4 dias, Bull 2019): é só o ponto mais provável.
export const LUTEAL_DAYS = 14;
// Janela fértil pela regra do método do calendário (OMS, Handbook 2022 cap. 18; MS, CAB 26):
// do dia (ciclo mais curto − 18) ao dia (ciclo mais longo − 11), contando o 1º dia da menstruação como dia 1.
export const FERTILE_FROM_SHORTEST = 18;
export const FERTILE_TO_LONGEST = 11;
// Diferença a partir da qual o MS desaconselha o calendário: a estimativa fica pouco confiável.
export const UNRELIABLE_RANGE_DAYS = 10;
export const AVERAGE_WINDOW = 6;
// Sem histórico, a próxima menstruação fica em média ± 3 dias: a variação típica de uma
// mesma pessoa é de ~2,6 dias (desvio-padrão, Bull 2019).
export const NO_HISTORY_MARGIN = 3;
// Mais que isso sem menstruar não é "atraso": é ausência prolongada (pede avaliação).
export const LONG_ABSENCE_DAYS = 90;
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

/**
 * "Menstruei" (início explícito): abre uma menstruação nova em `date`, sem emendar
 * na anterior mesmo que ela tenha acabado há poucos dias. Se `date` já está dentro
 * de uma menstruação (ex.: tocou "Terminou" por engano), reabre essa.
 */
export function startPeriodOn(periods, date) {
  const sorted = [...periods].sort(byStart);
  const i = sorted.findIndex((p) => p.start <= date && (p.end == null || p.end >= date));
  if (i >= 0) {
    sorted[i] = { ...sorted[i], end: null };
    return sorted;
  }
  return [...sorted, { start: date, end: null, source: 'user' }].sort(byStart);
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

/** Intervalo [start, endExclusive) cruza alguma gestação ou pós-parto? */
export function overlapsStage(stages, start, endExclusive) {
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
  // A duração da menstruação é a que ela informa (cadastro ou Ajustes), não a calculada:
  // vale para fechar uma menstruação esquecida (RF01.4) e para as menstruações previstas.
  // A média registrada fica só como informação.
  const avgPeriodLength = priorPeriod;
  const recordedPeriodLength = closedLengths.length ? average(closedLengths.slice(-AVERAGE_WINDOW)) : null;

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
  const lengths = cycles.map((c) => c.length);
  // Um ciclo fora do padrão não puxa a média (ver regularity.js).
  const avgCycleLength = blendedAverage(lengthsForAverage(lengths), priorCycle);
  const recent = lengthsForAverage(lengths).slice(-AVERAGE_WINDOW);
  const window = predictionWindow(recent, avgCycleLength);
  // O calendário usa os 6 ciclos mais recentes, inclusive um fora do padrão (OMS): para
  // fertilidade, descartar o ciclo atípico seria errar para o lado arriscado.
  const lastSix = lengths.slice(-AVERAGE_WINDOW);
  const shortest = lastSix.length >= 2 ? Math.min(...lastSix) : avgCycleLength;
  const longest = lastSix.length >= 2 ? Math.max(...lastSix) : avgCycleLength;
  const fertileDays = { from: Math.max(1, shortest - FERTILE_FROM_SHORTEST), to: longest - FERTILE_TO_LONGEST };
  const fertileUnreliable = longest - shortest >= UNRELIABLE_RANGE_DAYS;

  return {
    today, periods: effective, stages, methods, cycles, avgCycleLength, avgPeriodLength, recordedPeriodLength, window, pendingConfirmation,
    fertileDays, fertileUnreliable,
  };
}

/**
 * Janela da próxima menstruação, em dias desde o início do ciclo: do ciclo recente
 * mais curto ao mais longo, nunca mais estreita que média ± 1. Sem histórico, média ± 3.
 */
export function predictionWindow(recentLengths, avg) {
  if (recentLengths.length < 2) return { from: avg - NO_HISTORY_MARGIN, to: avg + NO_HISTORY_MARGIN };
  return { from: Math.min(Math.min(...recentLengths), avg - 1), to: Math.max(Math.max(...recentLengths), avg + 1) };
}

/** Ovulação provável e janela fértil (regra do calendário) do ciclo que começa em `cycleStart`. */
function ovulationFor(ctx, cycleStart, nextStart) {
  return {
    ovulation: addDays(nextStart, -LUTEAL_DAYS),
    fertileWindow: { start: addDays(cycleStart, ctx.fertileDays.from - 1), end: addDays(cycleStart, ctx.fertileDays.to - 1) },
  };
}

/**
 * Fase de qualquer dia (presente ou passado). Usado no anel da tela Hoje,
 * no calendário e na correlação sintoma × fase (RF06).
 * Fases: menstrual | follicular | ovulatory | luteal | expected | late | not_tracked | pregnancy | postpartum | unknown.
 * `expected` = dentro da janela prevista, a menstruação pode começar a qualquer dia.
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
  // Previsão é janela: dentro dela "pode começar"; "atrasada" só depois que ela passa.
  if (!nextActual) {
    const windowEnd = addDays(period.start, ctx.window.to);
    if (date > windowEnd) return { ...base, phase: 'late', daysLate: diffDays(windowEnd, date) };
    if (date >= addDays(period.start, ctx.window.from)) return { ...base, phase: 'expected' };
  }
  if (!tracksOvulation(methodOn(ctx.methods, date))) return { ...base, phase: 'not_tracked' };

  const { ovulation, fertileWindow } = ovulationFor(ctx, period.start, nextStart);
  const withOvulation = { ...base, ovulation, fertileWindow };
  if (date < fertileWindow.start) return { ...withOvulation, phase: 'follicular' };
  if (date <= fertileWindow.end) return { ...withOvulation, phase: 'ovulatory' };
  return { ...withOvulation, phase: 'luteal' };
}

/**
 * Previsão para a tela Hoje e o calendário: janela da próxima menstruação, próximas
 * menstruações e, quando o método permite, ovulação e janela fértil de cada uma.
 * Modos: cycle | pregnancy | postpartum | awaiting_period (gestação encerrada,
 * menstruação ainda não voltou: sem previsões).
 * Status (modo cycle): before | expected | late | long_absence (mais de 90 dias).
 */
export function predict(ctx, count = 3) {
  const stage = stageOn(ctx.stages, ctx.today);
  if (stage !== 'cycle') return { mode: stage, upcoming: [] };
  const last = findLast(ctx.periods, (p) => p.start <= ctx.today);
  if (!last) return { mode: 'cycle', upcoming: [] };
  const lastStageEnd = ctx.stages.reduce((max, s) => (s.end && s.end <= ctx.today && s.end > max ? s.end : max), '');
  if (lastStageEnd && last.start < lastStageEnd) return { mode: 'awaiting_period', upcoming: [] };

  const windowFrom = addDays(last.start, ctx.window.from);
  const windowTo = addDays(last.start, ctx.window.to);
  const sinceStart = diffDays(last.start, ctx.today);
  const status = sinceStart > LONG_ABSENCE_DAYS ? 'long_absence'
    : ctx.today > windowTo ? 'late' : ctx.today >= windowFrom ? 'expected' : 'before';
  const showFertility = tracksOvulation(methodOn(ctx.methods, ctx.today));
  // Depois que a janela passa, a próxima previsão parte de amanhã, não de uma data vencida.
  let firstNext = addDays(last.start, ctx.avgCycleLength);
  if (status === 'late' || status === 'long_absence') firstNext = addDays(ctx.today, 1);
  const upcoming = [];
  for (let i = 0; i < count; i++) {
    const start = addDays(firstNext, i * ctx.avgCycleLength);
    const entry = { start, end: addDays(start, ctx.avgPeriodLength - 1), ovulation: null, fertileWindow: null };
    upcoming.push(showFertility ? { ...entry, ...ovulationFor(ctx, addDays(start, -ctx.avgCycleLength), start) } : entry);
  }
  return {
    mode: 'cycle', status, window: { from: windowFrom, to: windowTo }, upcoming,
    daysUntilWindow: Math.max(0, diffDays(ctx.today, windowFrom)),
    daysLate: status === 'late' ? diffDays(windowTo, ctx.today) : 0,
    daysSinceStart: sinceStart,
  };
}

function findLastIndex(list, fn) {
  for (let i = list.length - 1; i >= 0; i--) if (fn(list[i])) return i;
  return -1;
}

function findLast(list, fn) {
  const i = findLastIndex(list, fn);
  return i < 0 ? undefined : list[i];
}
