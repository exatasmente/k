import { addDays, isWithin } from './dates.js';

// Métodos contraceptivos e o que cada um implica para o app.
// - suppressesOvulation: esconde ovulação/janela fértil (decisão de produto: sem janela
//   fértil para quem não ovula). PENDENTE de revisão médica antes de abrir para terceiras.
// - baselineProtection: protege sem ação a cada relação (o preservativo é por ato).
export const METHODS = Object.freeze({
  none: { label: 'Nenhum', suppressesOvulation: false, baselineProtection: false },
  condom: { label: 'Preservativo', suppressesOvulation: false, baselineProtection: false },
  pill: { label: 'Pílula (com pausa)', suppressesOvulation: true, baselineProtection: true },
  continuous_pill: { label: 'Pílula contínua', suppressesOvulation: true, baselineProtection: true },
  hormonal_iud: { label: 'DIU hormonal', suppressesOvulation: false, baselineProtection: true },
  copper_iud: { label: 'DIU de cobre', suppressesOvulation: false, baselineProtection: true },
  implant: { label: 'Implante', suppressesOvulation: true, baselineProtection: true },
  injection: { label: 'Injeção', suppressesOvulation: true, baselineProtection: true },
  ring_or_patch: { label: 'Anel ou adesivo', suppressesOvulation: true, baselineProtection: true },
  other: { label: 'Outro', suppressesOvulation: false, baselineProtection: false },
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

export function tracksOvulation(method) {
  return !METHODS[method].suppressesOvulation;
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
