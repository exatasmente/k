import { ageOn, diffDays } from './dates.js';
import { getItem, isKnownCode } from './catalog.js';
import { phaseOn } from './cycles.js';

// Exclusão de dados (decisão de produto, RNF05 revisado):
// ao pedir para apagar, removemos tudo que identifica a pessoa e todo o histórico
// detalhado. Pode ficar um registro ANÔNIMO, para uso interno do app e nunca
// repassado a terceiros (LGPD art. 16, IV). Para ser anônimo de verdade (art. 12):
//   - sem datas (datas de menstruação e de relação reidentificam);
//   - idade em anos, não data de nascimento;
//   - sem vida sexual, pílula do dia seguinte, testes, gestação ou sinais de alerta;
//   - durações ordenadas, sem a sequência no tempo.

export const RETENTION_SCHEMA = 1;
const RETAINED_CATEGORIES = new Set(['symptom', 'mood']);
const PHASES = ['menstrual', 'follicular', 'ovulatory', 'luteal', 'not_tracked'];

/**
 * @param {{birthDate?: string, ctx: ReturnType<import('./cycles.js').buildCycleContext>,
 *   entries: {date: string, code: string}[], today: string}} input
 */
export function buildAnonymousRetention({ birthDate, ctx, entries, today }) {
  const symptomCountsByPhase = {};
  for (const { date, code } of entries) {
    if (!isKnownCode(code)) continue;
    const item = getItem(code);
    if (!RETAINED_CATEGORIES.has(item.cat) || item.negates) continue;
    const { phase } = phaseOn(ctx, date);
    if (!PHASES.includes(phase)) continue;
    symptomCountsByPhase[code] ??= {};
    symptomCountsByPhase[code][phase] = (symptomCountsByPhase[code][phase] ?? 0) + 1;
  }
  const periodLengths = ctx.periods
    .filter((p) => p.end != null && p.end <= today)
    .map((p) => diffDays(p.start, p.end) + 1);
  return {
    schema: RETENTION_SCHEMA,
    ageYears: birthDate ? ageOn(birthDate, today) : null,
    cycleLengths: ctx.cycles.map((c) => c.length).sort((a, b) => a - b),
    periodLengths: periodLengths.sort((a, b) => a - b),
    symptomCountsByPhase,
  };
}
