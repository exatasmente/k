import { useState } from 'preact/hooks';
import { Icon } from './icons.jsx';

const WD = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const monthOf = (iso) => iso.slice(0, 7);
function shift(month, delta) {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

/** Calendário mensal para escolher um dia entre `min` e `max` (datas "YYYY-MM-DD"). */
export function MonthPicker({ value, onChange, min, max, label }) {
  const [month, setMonth] = useState(monthOf(value ?? max));
  const [y, m] = month.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells = [];
  for (let i = 0; i < first; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(`${month}-${String(d).padStart(2, '0')}`);
  const canPrev = month > monthOf(min);
  const canNext = month < monthOf(max);

  return (
    <div class="picker" role="group" aria-label={label}>
      <div class="head">
        <button class="icon-btn" aria-label="Mês anterior" disabled={!canPrev} onClick={() => setMonth(shift(month, -1))}>
          <Icon name="back" size={18} width={2.2} />
        </button>
        <strong aria-live="polite">{MONTHS[m - 1][0].toUpperCase()}{MONTHS[m - 1].slice(1)} {y}</strong>
        <button class="icon-btn" aria-label="Próximo mês" disabled={!canNext} onClick={() => setMonth(shift(month, 1))}>
          <Icon name="next" size={18} width={2.2} />
        </button>
      </div>
      <div class="cal">
        {WD.map((d, i) => <div key={i} class="wd" aria-hidden="true">{d}</div>)}
        {cells.map((date, i) => (date == null ? <div key={`b${i}`} /> : (
          <button key={date} class={`day${date === max ? ' today' : ''}`} disabled={date < min || date > max}
            aria-pressed={date === value ? 'true' : 'false'} aria-label={`${Number(date.slice(8))} de ${MONTHS[m - 1]}${date === max ? ', hoje' : ''}`}
            onClick={() => onChange(date)}>
            <span>{Number(date.slice(8))}</span><i />
          </button>
        )))}
      </div>
    </div>
  );
}
