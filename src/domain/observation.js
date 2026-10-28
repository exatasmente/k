import { addDays, diffDays } from './dates.js';
import { getItem, isKnownCode } from './catalog.js';

// "Não registrou" é diferente de "não teve". Por dia e por categoria:
//   - marcou o item                                   -> 'present'
//   - marcou outro item da mesma categoria ou a negação -> 'absent' (abriu a categoria e escolheu)
//   - nada na categoria                               -> 'unknown' (sem registro)
// Num ciclo, a resposta "Teve X neste ciclo?" (fim da menstruação) vale para o ciclo todo.

/**
 * @param {Iterable<string>} dayCodes
 * @param {string} code
 * @returns {'present'|'absent'|'unknown'}
 */
export function dayObservation(dayCodes, code) {
  const cat = getItem(code).cat;
  let observed = false;
  for (const c of dayCodes) {
    if (c === code) return 'present';
    if (isKnownCode(c) && getItem(c).cat === cat) observed = true;
  }
  return observed ? 'absent' : 'unknown';
}

/**
 * Como um sintoma aparece num ciclo.
 * @param {{start: string, end: string}} cycle intervalo fechado
 * @param {string} code
 * @param {(date: string) => Iterable<string>} codesOn códigos registrados num dia
 * @param {'yes'|'no'|undefined} answer resposta do fim da menstruação para este ciclo
 * @returns {{observed: boolean, present: boolean, days: number[], confirmedOnly: boolean}}
 *   `days` são dias do ciclo (1 = início); `observed: false` = ciclo fora da conta.
 */
export function cycleObservation(cycle, code, codesOn, answer) {
  const days = [];
  let observed = false;
  const span = diffDays(cycle.start, cycle.end) + 1;
  for (let cd = 1; cd <= span; cd++) {
    const state = dayObservation(codesOn(addDays(cycle.start, cd - 1)), code);
    if (state !== 'unknown') observed = true;
    if (state === 'present') days.push(cd);
  }
  if (answer === 'yes' || answer === 'no') observed = true;
  const present = days.length > 0 || answer === 'yes';
  return { observed, present, days, confirmedOnly: present && days.length === 0 };
}

/**
 * "Aparece em X de Y ciclos": só entram ciclos com algum dia observado na categoria.
 * @param {{observed: boolean, present: boolean}[]} observations um por ciclo completo
 */
export function cycleCoverage(observations) {
  const observed = observations.filter((o) => o.observed);
  return {
    present: observed.filter((o) => o.present).length,
    observed: observed.length,
    skipped: observations.length - observed.length,
  };
}

/**
 * Ao encerrar a menstruação: pergunta "Teve X neste ciclo?" só se nada da categoria
 * foi registrado no período e ainda não há resposta.
 */
export function shouldAskAtPeriodEnd(period, code, codesOn, answer) {
  if (answer) return false;
  return !cycleObservation(period, code, codesOn, undefined).observed;
}
