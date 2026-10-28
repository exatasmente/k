// RN03 em dois tons, sobre os últimos 6 ciclos completos:
//   - variação (maior − menor) dentro do normal para a idade: regular;
//   - acima, mas só por causa de UM ciclo fora da curva: aviso suave
//     ("um ciclo fora do padrão"), e esse ciclo sai da média;
//   - acima mesmo sem ele: irregular, sugere levar à ginecologista.
// O normal vem da FIGO 2018 (Munro et al.), que exclui ciclos ocasionais fora da curva:
// até 9 dias de variação dos 18 aos 25 anos, até 7 dos 26 aos 41, até 9 dos 42 aos 45.
// Sem idade, 8 dias (tabela 1 do mesmo artigo). Fontes: docs/fontes-clinicas.md.
// O onboarding não informa variação, então são precisos 3 ciclos registrados.

export const IRREGULAR_RANGE_DAYS = 8;
export const REGULARITY_WINDOW = 6;
export const REGULARITY_MIN_CYCLES = 3;

/** Maior variação normal (mais longo − mais curto) para a idade, em dias. */
export function normalRangeForAge(age) {
  if (age == null) return IRREGULAR_RANGE_DAYS;
  return age >= 26 && age <= 41 ? 7 : 9;
}

const range = (xs) => Math.max(...xs) - Math.min(...xs);

/**
 * @param {number[]} lengths durações dos ciclos completos, do mais antigo ao mais recente
 * @returns {{kind: 'insufficient'|'regular'|'outlier'|'irregular', last: number[], range?: number,
 *   outlierIndex?: number, rest?: number[], restRange?: number, cyclesNeeded?: number}}
 */
export function classifyRegularity(lengths, maxRange = IRREGULAR_RANGE_DAYS) {
  const last = lengths.slice(-REGULARITY_WINDOW);
  if (last.length < REGULARITY_MIN_CYCLES) {
    return { kind: 'insufficient', last, cyclesNeeded: REGULARITY_MIN_CYCLES - last.length };
  }
  const total = range(last);
  if (total <= maxRange) return { kind: 'regular', last, range: total };

  // O ciclo mais distante da mediana é o candidato a "fora do padrão".
  const median = [...last].sort((a, b) => a - b)[Math.floor(last.length / 2)];
  let outlierIndex = 0;
  last.forEach((l, i) => {
    if (Math.abs(l - median) > Math.abs(last[outlierIndex] - median)) outlierIndex = i;
  });
  const rest = last.filter((_, i) => i !== outlierIndex);
  const restRange = range(rest);
  if (restRange <= maxRange) return { kind: 'outlier', last, range: total, outlierIndex, rest, restRange };
  return { kind: 'irregular', last, range: total };
}

/** Durações que entram na média: sem o ciclo fora do padrão, quando houver um. */
export function lengthsForAverage(lengths) {
  const r = classifyRegularity(lengths);
  if (r.kind !== 'outlier') return lengths;
  const cut = lengths.length - r.last.length + r.outlierIndex;
  return lengths.filter((_, i) => i !== cut);
}
