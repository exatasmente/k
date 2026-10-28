// Datas do domínio são sempre strings locais "YYYY-MM-DD" (o dia que a usuária vê),
// nunca timestamps. A aritmética roda em UTC para não sofrer com horário de verão.

const MS_PER_DAY = 86_400_000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** @param {string} iso */
function toUtc(iso) {
  if (!ISO_DATE.test(iso)) throw new TypeError(`Data inválida: ${iso}`);
  const [y, m, d] = iso.split('-').map(Number);
  const ms = Date.UTC(y, m - 1, d);
  if (new Date(ms).getUTCDate() !== d) throw new TypeError(`Data inválida: ${iso}`);
  return ms;
}

/** @param {number} ms */
function fromUtc(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

/** @param {string} iso @param {number} days */
export function addDays(iso, days) {
  return fromUtc(toUtc(iso) + days * MS_PER_DAY);
}

/** Dias de `from` até `to` (positivo se `to` é depois). */
export function diffDays(from, to) {
  return Math.round((toUtc(to) - toUtc(from)) / MS_PER_DAY);
}

/** @param {string} iso @param {number} months */
export function addMonths(iso, months) {
  const [y, m, d] = iso.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return fromUtc(target.getTime());
}

/** Intervalo fechado [start, end]; `end` nulo significa "em aberto". */
export function isWithin(iso, start, end) {
  return iso >= start && (end == null || iso <= end);
}

/** Idade em anos completos na data de referência. */
export function ageOn(birthDate, onDate) {
  const [by, bm, bd] = birthDate.split('-').map(Number);
  const [y, m, d] = onDate.split('-').map(Number);
  let age = y - by;
  if (m < bm || (m === bm && d < bd)) age -= 1;
  return age;
}

/** Data local de hoje no formato do domínio. */
export function today(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function assertDate(iso) {
  toUtc(iso);
  return iso;
}
