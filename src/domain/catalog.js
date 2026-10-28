// Catálogo de ícones do modal de registro (Tela 3).
// `input` define a semântica do toque (RN07.1):
//   - 'toggle': liga/desliga independente dos demais;
//   - 'single': escolha única dentro de `group` (tocar outro troca, tocar o mesmo remove).
// Todos os itens têm long-press para a Ficha Analítica (RN07.2), por isso não há flag para isso.

export const CATEGORIES = Object.freeze({
  sex: 'Atividade Sexual & Contracepção',
  flow: 'Fluxo & Sangramento',
  symptom: 'Sintomas Físicos',
  mood: 'Humor & Sentimentos',
  lifestyle: 'Estilo de Vida',
});

/** @typedef {{code: string, label: string, category: keyof typeof CATEGORIES, input: 'toggle'|'single', group?: string, highlight?: boolean}} CatalogItem */

/** @type {readonly CatalogItem[]} */
export const CATALOG = Object.freeze([
  { code: 'sex_vaginal', label: 'Vaginal', category: 'sex', input: 'toggle' },
  { code: 'sex_oral', label: 'Oral', category: 'sex', input: 'toggle' },
  { code: 'sex_anal', label: 'Anal', category: 'sex', input: 'toggle' },
  { code: 'sex_foreplay', label: 'Preliminares', category: 'sex', input: 'toggle' },
  { code: 'protection_condom', label: 'Com preservativo', category: 'sex', input: 'single', group: 'protection' },
  { code: 'protection_none', label: 'Sem preservativo', category: 'sex', input: 'single', group: 'protection' },
  { code: 'emergency_contraception', label: 'Pílula do Dia Seguinte', category: 'sex', input: 'toggle', highlight: true },

  { code: 'flow_light', label: 'Leve', category: 'flow', input: 'single', group: 'flow' },
  { code: 'flow_medium', label: 'Médio', category: 'flow', input: 'single', group: 'flow' },
  { code: 'flow_heavy', label: 'Intenso', category: 'flow', input: 'single', group: 'flow' },
  { code: 'flow_dark', label: 'Escuro/Borra', category: 'flow', input: 'single', group: 'flow' },
  { code: 'spotting', label: 'Sangramento de escape', category: 'flow', input: 'toggle' },

  { code: 'cramps', label: 'Cólica', category: 'symptom', input: 'toggle' },
  { code: 'back_pain', label: 'Dor nas costas', category: 'symptom', input: 'toggle' },
  { code: 'breast_tenderness', label: 'Sensibilidade nas mamas', category: 'symptom', input: 'toggle' },
  { code: 'acne', label: 'Acne', category: 'symptom', input: 'toggle' },
  { code: 'bloating', label: 'Inchaço', category: 'symptom', input: 'toggle' },
  { code: 'headache', label: 'Dor de cabeça', category: 'symptom', input: 'toggle' },
  { code: 'nausea', label: 'Enjoo', category: 'symptom', input: 'toggle' },

  { code: 'mood_happy', label: 'Feliz', category: 'mood', input: 'toggle' },
  { code: 'mood_anxious', label: 'Ansiosa', category: 'mood', input: 'toggle' },
  { code: 'mood_irritated', label: 'Irritada', category: 'mood', input: 'toggle' },
  { code: 'mood_sad', label: 'Triste', category: 'mood', input: 'toggle' },
  { code: 'mood_sensitive', label: 'Sensível', category: 'mood', input: 'toggle' },
  { code: 'mood_tired', label: 'Cansada', category: 'mood', input: 'toggle' },

  { code: 'workout_light', label: 'Treino leve', category: 'lifestyle', input: 'toggle' },
  { code: 'workout_intense', label: 'Treino intenso', category: 'lifestyle', input: 'toggle' },
  { code: 'walk', label: 'Caminhada', category: 'lifestyle', input: 'toggle' },
  { code: 'yoga', label: 'Yoga', category: 'lifestyle', input: 'toggle' },
]);

const BY_CODE = new Map(CATALOG.map((item) => [item.code, item]));

export function getItem(code) {
  const item = BY_CODE.get(code);
  if (!item) throw new RangeError(`Código de evento desconhecido: ${code}`);
  return item;
}

export const FLOW_CODES = Object.freeze(CATALOG.filter((i) => i.group === 'flow').map((i) => i.code));
export const SEX_CODES = Object.freeze(CATALOG.filter((i) => i.code.startsWith('sex_')).map((i) => i.code));

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
  if (item.input === 'single') {
    for (const other of CATALOG) {
      if (other.group === item.group) next.delete(other.code);
    }
  }
  next.add(code);
  return next;
}
