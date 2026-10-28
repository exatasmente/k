import { addDays, isWithin } from './dates.js';

// Métodos contraceptivos e o que cada um implica para o app (fontes: docs/fontes-clinicas.md).
// - ovulation: 'suppressed' = impede a ovulação como mecanismo principal (OMS, Handbook 2022):
//   sem janela fértil. 'uncertain' = pode ou não ovular (DIU hormonal: >75% ovulam, FSRH 2023;
//   minipílula de levonorgestrel/noretisterona, FSRH 2022): sem janela fértil e sem avaliar
//   regularidade. 'normal' = ovula normalmente.
// - baselineProtection: protege sem ação a cada relação (o preservativo é por ato).
// - hormonal: muda o padrão de sangramento (não avaliamos regularidade nem ausência).
export const METHODS = Object.freeze({
  none: { label: 'Nenhum', ovulation: 'normal', baselineProtection: false, hormonal: false },
  condom: { label: 'Preservativo', ovulation: 'normal', baselineProtection: false, hormonal: false },
  pill: { label: 'Pílula combinada (com pausa)', ovulation: 'suppressed', baselineProtection: true, hormonal: true },
  continuous_pill: { label: 'Pílula combinada contínua', ovulation: 'suppressed', baselineProtection: true, hormonal: true },
  desogestrel: { label: 'Pílula de desogestrel', ovulation: 'suppressed', baselineProtection: true, hormonal: true },
  minipill: { label: 'Minipílula (amamentação)', ovulation: 'uncertain', baselineProtection: true, hormonal: true },
  hormonal_iud: { label: 'DIU hormonal', ovulation: 'uncertain', baselineProtection: true, hormonal: true },
  copper_iud: { label: 'DIU de cobre', ovulation: 'normal', baselineProtection: true, hormonal: false },
  implant: { label: 'Implante', ovulation: 'suppressed', baselineProtection: true, hormonal: true },
  injection: { label: 'Injeção', ovulation: 'suppressed', baselineProtection: true, hormonal: true },
  ring_or_patch: { label: 'Anel ou adesivo', ovulation: 'suppressed', baselineProtection: true, hormonal: true },
  other: { label: 'Outro', ovulation: 'normal', baselineProtection: false, hormonal: false },
});

/** @typedef {{method: keyof typeof METHODS, from: string, to: string|null}} MethodPeriod */

/**
 * Método vigente numa data. O histórico tem vigência para que mudar de método
 * não reescreva o passado (RN01 e consultas históricas da IA).
 * @param {MethodPeriod[]} periods
 * @param {string} date
 */
export function methodOn(periods, date) {
  const match = periods.find((p) => isWithin(date, p.from, p.to));
  return match ? match.method : 'none';
}

/**
 * Troca o método a partir de `from`, fechando o vigente no dia anterior.
 * @param {MethodPeriod[]} periods
 * @param {keyof typeof METHODS} method
 * @param {string} from
 */
export function changeMethod(periods, method, from) {
  if (!METHODS[method]) throw new RangeError(`Método desconhecido: ${method}`);
  const kept = periods
    .filter((p) => p.from < from)
    .map((p) => (p.to == null || p.to >= from ? { ...p, to: addDays(from, -1) } : p));
  return [...kept, { method, from, to: null }];
}

/** Ovulação previsível: mostra janela fértil e fases do ciclo. */
export function tracksOvulation(method) {
  return METHODS[method].ovulation === 'normal';
}

/** O padrão de sangramento é do método, não do ciclo: sem avaliar regularidade nem ausência. */
export function bleedingFromMethod(method) {
  return METHODS[method].hormonal;
}

/**
 * Códigos gravados pelo registro de relação em 1 toque (RF02.2 / RN01):
 * assume o método padrão, sem perguntar de novo sobre proteção.
 */
export function quickSexCodes(defaultMethod) {
  return defaultMethod === 'condom' ? ['sex_vaginal', 'protection_condom'] : ['sex_vaginal'];
}

/**
 * Relação com risco de gravidez: vaginal, sem preservativo naquele ato e sem método
 * de base vigente. Oral/anal/preliminares não contam.
 * @param {Set<string>} dayCodes
 * @param {keyof typeof METHODS} method método vigente no dia
 */
export function isUnprotected(dayCodes, method) {
  if (!dayCodes.has('sex_vaginal')) return false;
  if (dayCodes.has('protection_condom')) return false;
  if (dayCodes.has('protection_none')) return !METHODS[method].baselineProtection;
  // Sem marcação de proteção vale o padrão do perfil (RN01).
  return method !== 'condom' && !METHODS[method].baselineProtection;
}
