// Catálogo de ícones do registro (Tela 3), espelhando o protótipo validado.
//
// Semântica do toque (RN07.1):
//   - sem `group`: liga/desliga independente;
//   - `group`: escolha única no grupo (tocar outro troca, tocar o mesmo remove);
//   - `negates`: "não teve" explícito da categoria ("Sem sintomas", "Não me exercitei").
//     Exclui os outros itens da categoria e vice-versa.
// Visibilidade por estágio de vida:
//   - `only: 'cycle' | 'pregnancy'` restringe o item ou a categoria;
//   - `minWeek` só aparece a partir dessa semana de gestação.
// `alert: true` marca sinais de alerta da gestação (regra local, ver rules.js).
// Todos os itens têm long-press para a Ficha Analítica (RN07.2).

/** @typedef {'cycle'|'pregnancy'} Stage */
/** @typedef {{id: string, label: string, only?: Stage, minWeek?: number}} Category */
/**
 * @typedef {{code: string, label: string, cat: string, group?: string, negates?: boolean,
 *   only?: Stage, minWeek?: number, alert?: boolean, highlight?: boolean, hiddenInGrid?: boolean}} CatalogItem
 */

/** @type {readonly Category[]} */
export const CATEGORIES = Object.freeze([
  { id: 'flow', label: 'Fluxo & sangramento', only: 'cycle' },
  { id: 'alert', label: 'Sinais de alerta', only: 'pregnancy' },
  { id: 'symptom', label: 'Sintomas' },
  { id: 'mood', label: 'Humor' },
  { id: 'baby', label: 'Bebê', only: 'pregnancy', minWeek: 16 },
  { id: 'discharge', label: 'Secreção' },
  { id: 'sex', label: 'Relação & proteção' },
  { id: 'factors', label: 'Fatores do dia' },
  { id: 'lifestyle', label: 'Atividade física' },
  { id: 'test', label: 'Teste de gravidez', only: 'cycle' },
]);

const C = 'cycle';
const P = 'pregnancy';

/** @type {readonly CatalogItem[]} */
export const CATALOG = Object.freeze([
  { code: 'flow_light', label: 'Leve', cat: 'flow', group: 'flow', only: C },
  { code: 'flow_medium', label: 'Médio', cat: 'flow', group: 'flow', only: C },
  { code: 'flow_heavy', label: 'Intenso', cat: 'flow', group: 'flow', only: C },
  { code: 'flow_dark', label: 'Escuro / borra', cat: 'flow', group: 'flow', only: C },
  { code: 'spotting', label: 'Escape', cat: 'flow', only: C },

  // Sinais de alerta da gestação: lista "busque atendimento imediatamente" da Caderneta
  // Brasileira da Gestante (MS, 2026), mais perda de líquido e contrações (CAB 32, MS 2012),
  // vômitos que impedem comer, dor numa perna só e pensamentos de se machucar (CDC, 2024).
  // Fontes: docs/fontes-clinicas.md. PENDENTE de revisão por obstetra antes de abrir para terceiras.
  { code: 'bleeding', label: 'Sangramento pela vagina', cat: 'alert', only: P, alert: true },
  { code: 'fluid_loss', label: 'Perda de líquido pela vagina', cat: 'alert', only: P, alert: true },
  { code: 'severe_abdominal', label: 'Dor forte ou que não passa na barriga', cat: 'alert', only: P, alert: true },
  { code: 'epigastric_pain', label: 'Dor forte na boca do estômago', cat: 'alert', only: P, alert: true },
  { code: 'severe_headache', label: 'Dor de cabeça forte ou que não melhora', cat: 'alert', only: P, alert: true },
  { code: 'vision_change', label: 'Visão turva, flashes ou pontos escuros', cat: 'alert', only: P, alert: true },
  { code: 'sudden_swelling', label: 'Inchaço repentino no rosto, mãos ou pernas', cat: 'alert', only: P, alert: true },
  { code: 'high_bp', label: 'Pressão alta (14 por 9 ou mais)', cat: 'alert', only: P, alert: true },
  { code: 'fever', label: 'Febre (37,8 °C ou mais)', cat: 'alert', only: P, alert: true },
  { code: 'urinary_pain', label: 'Dor ou ardência ao urinar', cat: 'alert', only: P, alert: true },
  { code: 'persistent_vomiting', label: 'Vômitos que impedem comer ou beber', cat: 'alert', only: P, alert: true },
  { code: 'red_spots', label: 'Manchas vermelhas na pele ou olhos vermelhos', cat: 'alert', only: P, alert: true },
  { code: 'short_breath', label: 'Falta de ar', cat: 'alert', only: P, alert: true },
  { code: 'chest_pain', label: 'Dor forte no peito', cat: 'alert', only: P, alert: true },
  { code: 'fainting', label: 'Desmaio', cat: 'alert', only: P, alert: true },
  { code: 'seizure', label: 'Convulsão', cat: 'alert', only: P, alert: true },
  { code: 'leg_pain', label: 'Dor, calor ou inchaço em uma perna só', cat: 'alert', only: P, alert: true },
  { code: 'unwell', label: 'Mal-estar intenso ou sensação de que algo não está bem', cat: 'alert', only: P, alert: true },
  { code: 'self_harm_thoughts', label: 'Pensamentos de se machucar ou machucar o bebê', cat: 'alert', only: P, alert: true },
  { code: 'regular_contractions', label: 'Contrações regulares', cat: 'alert', only: P, alert: true, minWeek: 20 },
  // Caderneta 2026: "mais de 4 horas sem se mexer após as 20 semanas".
  { code: 'less_movement', label: 'Bebê mexendo menos ou parado', cat: 'alert', only: P, alert: true, minWeek: 20 },

  { code: 'no_symptoms', label: 'Sem sintomas', cat: 'symptom', negates: true, hiddenInGrid: true },
  { code: 'cramps', label: 'Cólica', cat: 'symptom', only: C },
  { code: 'abdominal_pain', label: 'Dor abdominal', cat: 'symptom', only: C },
  { code: 'back_pain', label: 'Dor nas costas', cat: 'symptom' },
  { code: 'breast_tenderness', label: 'Mamas sensíveis', cat: 'symptom' },
  { code: 'headache', label: 'Dor de cabeça', cat: 'symptom' },
  { code: 'acne', label: 'Acne', cat: 'symptom' },
  { code: 'bloating', label: 'Inchaço', cat: 'symptom' },
  { code: 'nausea', label: 'Enjoo', cat: 'symptom' },
  { code: 'fatigue', label: 'Fadiga', cat: 'symptom' },
  { code: 'insomnia', label: 'Insônia', cat: 'symptom' },
  { code: 'vaginal_itch', label: 'Coceira vaginal', cat: 'symptom' },
  { code: 'diarrhea', label: 'Diarreia', cat: 'symptom' },
  { code: 'constipation', label: 'Prisão de ventre', cat: 'symptom' },
  { code: 'vomiting', label: 'Vômito', cat: 'symptom', only: P },
  { code: 'heartburn', label: 'Azia', cat: 'symptom', only: P },
  { code: 'sleepy', label: 'Sono', cat: 'symptom', only: P },
  { code: 'leg_cramps', label: 'Câimbras', cat: 'symptom', only: P },
  { code: 'frequent_urination', label: 'Vontade frequente de urinar', cat: 'symptom', only: P },
  { code: 'cravings', label: 'Desejos ou aversões', cat: 'symptom', only: P },
  { code: 'swelling_legs', label: 'Inchaço nas pernas e pés', cat: 'symptom', only: P },

  { code: 'mood_calm', label: 'Calma', cat: 'mood' },
  { code: 'mood_happy', label: 'Feliz', cat: 'mood' },
  { code: 'mood_swings', label: 'Mudanças de humor', cat: 'mood' },
  { code: 'mood_anxious', label: 'Ansiosa', cat: 'mood' },
  { code: 'mood_irritated', label: 'Irritada', cat: 'mood' },
  { code: 'mood_sad', label: 'Triste', cat: 'mood' },
  { code: 'mood_sensitive', label: 'Sensível', cat: 'mood' },

  { code: 'baby_movement', label: 'Bebê se mexendo', cat: 'baby', only: P, minWeek: 16 },
  { code: 'braxton', label: 'Contrações de treinamento', cat: 'baby', only: P, minWeek: 20 },

  { code: 'discharge_dry', label: 'Seca', cat: 'discharge', group: 'discharge' },
  { code: 'discharge_creamy', label: 'Cremosa', cat: 'discharge', group: 'discharge' },
  { code: 'discharge_watery', label: 'Aquosa', cat: 'discharge', group: 'discharge' },
  { code: 'discharge_eggwhite', label: 'Clara de ovo', cat: 'discharge', group: 'discharge', only: C },
  { code: 'discharge_unusual', label: 'Diferente do normal', cat: 'discharge', group: 'discharge' },

  { code: 'sex_vaginal', label: 'Vaginal', cat: 'sex' },
  { code: 'sex_oral', label: 'Oral', cat: 'sex' },
  { code: 'sex_anal', label: 'Anal', cat: 'sex' },
  { code: 'sex_foreplay', label: 'Preliminares', cat: 'sex' },
  { code: 'protection_condom', label: 'Com preservativo', cat: 'sex', group: 'protection', only: C },
  { code: 'protection_none', label: 'Sem preservativo', cat: 'sex', group: 'protection', only: C },
  { code: 'emergency_contraception', label: 'Pílula do dia seguinte', cat: 'sex', only: C, highlight: true },

  { code: 'stress', label: 'Estresse', cat: 'factors' },
  { code: 'illness', label: 'Doença', cat: 'factors' },
  { code: 'travel', label: 'Viagem', cat: 'factors' },
  { code: 'alcohol', label: 'Álcool', cat: 'factors' },

  { code: 'no_workout', label: 'Não me exercitei', cat: 'lifestyle', negates: true },
  { code: 'workout_light', label: 'Treino leve', cat: 'lifestyle' },
  { code: 'workout_intense', label: 'Treino intenso', cat: 'lifestyle' },
  { code: 'walk', label: 'Caminhada', cat: 'lifestyle' },
  { code: 'yoga', label: 'Yoga', cat: 'lifestyle' },

  { code: 'preg_test_none', label: 'Não fiz teste', cat: 'test', group: 'preg_test', only: C },
  { code: 'preg_test_positive', label: 'Teste positivo', cat: 'test', group: 'preg_test', only: C },
  { code: 'preg_test_negative', label: 'Teste negativo', cat: 'test', group: 'preg_test', only: C },
]);

const BY_CODE = new Map(CATALOG.map((item) => [item.code, item]));
const CATEGORY_BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));

export function getItem(code) {
  const item = BY_CODE.get(code);
  if (!item) throw new RangeError(`Código de evento desconhecido: ${code}`);
  return item;
}

export function isKnownCode(code) {
  return BY_CODE.has(code);
}

export const FLOW_CODES = Object.freeze(CATALOG.filter((i) => i.group === 'flow').map((i) => i.code));
export const ALERT_CODES = Object.freeze(CATALOG.filter((i) => i.alert).map((i) => i.code));

/**
 * O item ou categoria aparece neste estágio de vida?
 * @param {{only?: Stage, minWeek?: number}} entity
 * @param {{stage: Stage, gestationalWeek?: number}} ctx
 */
export function isVisible(entity, { stage, gestationalWeek = 0 }) {
  if (entity.only && entity.only !== stage) return false;
  if (entity.minWeek && (stage !== 'pregnancy' || gestationalWeek < entity.minWeek)) return false;
  if ('cat' in entity) return isVisible(CATEGORY_BY_ID.get(entity.cat), { stage, gestationalWeek });
  return true;
}

/**
 * Resultado de um toque simples num ícone, dado o que já está marcado no dia.
 * @param {Iterable<string>} dayCodes códigos ativos no dia
 * @param {string} code ícone tocado
 * @returns {Set<string>} novo conjunto de códigos ativos
 */
export function applyTap(dayCodes, code) {
  const item = getItem(code);
  const next = new Set(dayCodes);
  if (next.has(code)) {
    next.delete(code);
    return next;
  }
  for (const other of next) {
    const o = BY_CODE.get(other);
    if (!o) continue;
    const sameGroup = item.group && o.group === item.group;
    const negationClash = o.cat === item.cat && (item.negates || o.negates);
    if (sameGroup || negationClash) next.delete(other);
  }
  next.add(code);
  return next;
}
