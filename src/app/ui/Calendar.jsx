import { useState } from 'preact/hooks';
import { calendarView, copyOf } from '../views.js';
import { Sourced } from './Sources.jsx';
import { Icon, catStyle } from './icons.jsx';

const WD = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

function shiftMonth(month, delta) {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

export function CalendarScreen({ model, nav }) {
  const [month, setMonth] = useState(model.today.slice(0, 7));
  const [selected, setSelected] = useState(model.today);
  const v = calendarView(model, month, selected);
  const tracks = !model.pregnancy && v.cells.some((c) => c.fertile);

  return (
    <div class="screen">
      <div class="head">
        <h1 class="title" style={{ fontSize: 26 }}>{v.title}</h1>
        <div class="row" style={{ flexWrap: 'nowrap' }}>
          <button class="icon-btn" aria-label="Mês anterior" onClick={() => setMonth(shiftMonth(month, -1))}><Icon name="back" size={18} width={2.2} /></button>
          <button class="icon-btn" aria-label="Próximo mês" onClick={() => setMonth(shiftMonth(month, 1))}><Icon name="next" size={18} width={2.2} /></button>
        </div>
      </div>

      <div class="card" style={{ padding: '14px 10px' }}>
        <div class="cal">
          {WD.map((d, i) => <div key={i} class="wd" aria-hidden="true">{d}</div>)}
          {v.cells.map((c) => (c.blank ? <div key={c.key} /> : (
            <button key={c.key}
              class={['day', c.actual && 'actual', c.predicted && 'predicted', c.fertile && 'fertile', c.ovulation && 'ovulation', c.consult && 'consult', c.today && 'today', c.sex && 'sex'].filter(Boolean).join(' ')}
              aria-pressed={c.selected ? 'true' : 'false'}
              aria-label={`${c.day}${c.today ? ', hoje' : ''}${c.actual ? ', menstruação' : ''}${c.predicted ? ', menstruação prevista' : ''}${c.fertile ? ', janela fértil' : ''}${c.consult ? ', consulta do pré-natal' : ''}${c.sex ? ', relação registrada' : ''}`}
              onClick={() => setSelected(c.date)}>
              <span>{c.day}</span><i />
            </button>
          )))}
        </div>
      </div>

      <div class="legend">
        <span><i class="swatch" style={{ background: 'var(--berry)' }} />Menstruação</span>
        <span><i class="swatch" style={{ border: '2px dashed var(--berry)' }} />Prevista</span>
        {tracks && <span><i class="swatch" style={{ background: 'var(--indigo-tint)' }} />Janela fértil</span>}
        {tracks && <span><i class="swatch" style={{ border: '2px solid var(--indigo)' }} />Ovulação</span>}
        {model.consult && <span><i class="swatch" style={{ background: 'var(--indigo-tint)', border: '2px solid var(--indigo)' }} />Consulta</span>}
        <span><i class="swatch" style={{ background: 'var(--c-sex)', borderRadius: 6, width: 8, height: 8 }} />Relação</span>
      </div>
      {tracks && <Sourced class="small muted" copy={copyOf('fertileEstimate')} />}

      <section class="card">
        <h2 class="display" style={{ fontSize: 19 }}>{v.selected.title}</h2>
        <div class="muted">{v.selected.phase}</div>
        {v.selected.tags.length > 0 && (
          <div class="tags">
            {v.selected.tags.map((t) => (
              <span key={t.code} class="tag static" style={{ ...catStyle(t.cat), background: 'var(--tint)', color: 'var(--color)' }}>{t.label}</span>
            ))}
          </div>
        )}
        {v.selected.canLog && <button class="btn" onClick={() => nav.openLog(selected)}>Registrar neste dia</button>}
      </section>
    </div>
  );
}
