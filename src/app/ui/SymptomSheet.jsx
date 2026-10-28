import { symptomView } from '../views.js';
import { Icon, catStyle } from './icons.jsx';
import { CloseButton, Sheet } from './Sheet.jsx';

const PHASE_COLOR = {
  menstrual: 'var(--berry)', follicular: 'var(--muted)', ovulatory: 'var(--indigo)', luteal: 'var(--c-symptom)',
  not_tracked: 'var(--c-symptom)', t1: 'var(--c-baby)', t2: 'var(--indigo)', t3: 'var(--c-symptom)',
};

export function SymptomSheet({ model, nav, code, back }) {
  const v = symptomView(model, code);
  const close = () => (back ? nav.openLog(back.date) : nav.close());
  const head = (
    <div class="head">
      <div class="row" style={{ flexWrap: 'nowrap', ...catStyle(v.cat) }}>
        <span style={{ width: 48, height: 48, borderRadius: 24, display: 'grid', placeItems: 'center', background: 'var(--tint)', color: 'var(--color)', flex: 'none' }}>
          <Icon code={code} size={26} />
        </span>
        <div>
          <h2 class="title" style={{ lineHeight: 1.1 }}>{v.label}</h2>
          <div class="small muted">{v.catLabel}</div>
        </div>
      </div>
      <CloseButton onClick={close} label={back ? 'Voltar ao registro' : 'Fechar'} />
    </div>
  );
  return (
    <Sheet label={v.label} onClose={close} head={head}>
      <div class="sheet-body" style={catStyle(v.cat)}>
        <div class="stat3">
          {v.windows.map((w) => <div key={w.label} class="stat"><b>{w.count}</b><span class="small muted">{w.label}</span></div>)}
        </div>

        <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h3 style={{ fontSize: 16 }}>{v.phaseTitle}</h3>
          {v.phases.map((p) => (
            <div key={p.key}>
              <div class="head" style={{ fontSize: 14 }}><span>{p.label}</span><strong>{p.pct}%</strong></div>
              <div class="bar"><div style={{ width: `${p.pct}%`, background: PHASE_COLOR[p.key] }} /></div>
            </div>
          ))}
        </section>

        <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h3 style={{ fontSize: 16 }}>{v.rowsTitle}</h3>
          <div class="legend" style={{ fontSize: 12 }}>
            <span><i class="swatch" style={{ background: 'var(--color)', borderRadius: 6 }} />dia com {v.label.toLowerCase()}</span>
            {v.legendCycle && <span><i class="swatch" style={{ background: 'var(--berry-tint)' }} />menstruação</span>}
            {v.legendFertile && <span><i class="swatch" style={{ background: 'var(--indigo-tint)' }} />janela fértil</span>}
            <span><i class="swatch" style={{ border: '1.5px dashed var(--muted)' }} />sem registros</span>
          </div>
          {v.rows.map((r) => (
            <div key={r.key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div class="head small"><strong>{r.label}</strong><span class="muted">{r.right}</span></div>
              {r.observed ? (
                <div class="cycle-bar" style={{ width: `${r.width}%` }}>
                  <div class="bg" />
                  {r.period > 0 && <div class="per" style={{ width: `${r.period}%` }} />}
                  {r.fertile && <div class="fer" style={{ left: `${r.fertile.left}%`, width: `${r.fertile.width}%` }} />}
                  {r.dots.map((left, i) => <div key={i} class="dot" style={{ left: `${left}%` }} />)}
                </div>
              ) : (
                <>
                  <div class="cycle-bar empty" style={{ width: `${r.width}%` }} />
                  <div class="small muted">{r.empty}</div>
                </>
              )}
            </div>
          ))}
          <div class="muted">{v.coverageText}</div>
        </section>

        <div class="card" style={{ background: 'var(--ground)', border: 0 }}>{v.insight}</div>
      </div>
    </Sheet>
  );
}
