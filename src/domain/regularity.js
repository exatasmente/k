// RN03 em dois tons, sobre os últimos 6 ciclos completos:
//   - variação (maior − menor) de até 8 dias: regular;
//   - acima de 8, mas só por causa de UM ciclo fora da curva: aviso suave
//     ("um ciclo fora do padrão"), e esse ciclo sai da média;
//   - acima de 8 mesmo sem ele: irregular, sugere levar à ginecologista.
// O onboarding não informa variação, então são precisos 3 ciclos registrados.

export const IRREGULAR_RANGE_DAYS = 8;
export const REGULARITY_WINDOW = 6;
export const REGULARITY_MIN_CYCLES = 3;

const range = (xs) => Math.max(...xs) - Math.min(...xs);

/**
 * @param {number[]} lengths durações dos ciclos completos, do mais antigo ao mais recente
 * @returns {{kind: 'insufficient'|'regular'|'outlier'|'irregular', last: number[], range?: number,
 *   outlierIndex?: number, rest?: number[], restRange?: number, cyclesNeeded?: number}}
 */
export function classifyRegularity(lengths) {
  const last = lengths.slice(-REGULARITY_WINDOW);
  if (last.length < REGULARITY_MIN_CYCLES) {
    return { kind: 'insufficient', last, cyclesNeeded: REGULARITY_MIN_CYCLES - last.length };
  }
  const total = range(last);
  if (total <= IRREGULAR_RANGE_DAYS) return { kind: 'regular', last, range: total };

  // O ciclo mais distante da mediana é o candidato a "fora do padrão".
  const median = [...last].sort((a, b) => a - b)[Math.floor(last.length / 2)];
  let outlierIndex = 0;
  last.forEach((l, i) => {
    if (Math.abs(l - median) > Math.abs(last[outlierIndex] - median)) outlierIndex = i;
  });
  const rest = last.filter((_, i) => i !== outlierIndex);
  const restRange = range(rest);
  if (restRange <= IRREGULAR_RANGE_DAYS) return { kind: 'outlier', last, range: total, outlierIndex, rest, restRange };
  return { kind: 'irregular', last, range: total };
}

/** Durações que entram na média: sem o ciclo fora do padrão, quando houver um. */
export function lengthsForAverage(lengths) {
  const r = classifyRegularity(lengths);
  if (r.kind !== 'outlier') return lengths;
  const cut = lengths.length - r.last.length + r.outlierIndex;
  return lengths.filter((_, i) => i !== cut);
}
