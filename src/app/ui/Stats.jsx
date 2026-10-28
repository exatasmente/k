import { statsView } from '../views.js';
import { Sources } from './Sources.jsx';

const TONE = { good: 'var(--good)', warn: 'var(--warn-ink)', muted: 'var(--muted)' };

function TopList({ items, color, empty }) {
  if (!items.length) return <div class="muted">{empty}</div>;
  return items.map((s) => (
    <div key={s.code}>
      <div class="head" style={{ fontSize: 14 }}><span>{s.label}</span><span class="muted">{s.text}</span></div>
      <div class="bar" style={{ height: 8 }}><div style={{ width: `${s.pct}%`, background: color }} /></div>
    </div>
  ));
}

export function Stats({ model }) {
  const v = statsView(model);
  if (v.mode === 'pregnancy') {
    return (
      <div class="screen">
        <h1 class="title" style={{ fontSize: 26 }}>Resumo</h1>
        <section class="card">
          <div class="small muted" style={{ fontWeight: 600 }}>Gestação · {v.card.trimester}</div>
          <div class="display" style={{ fontSize: 30 }}>{v.card.short}</div>
          <div class="muted">Data provável do parto: {v.card.due}</div>
        </section>
        <section class="card">
          <strong>Sinais de alerta registrados</strong>
          {v.flags.length ? v.flags.map((f) => <div key={f} style={{ color: 'var(--danger-ink)' }}>{f}</div>) : <div class="muted">Nenhum até agora.</div>}
        </section>
        <section class="card">
          <strong>Mais registrados na gestação</strong>
          <TopList items={v.top} color="var(--c-baby)" empty="Ainda sem registros de sintomas ou humor na gestação." />
        </section>
        <div class="small muted">Regularidade e médias do ciclo ficam pausadas durante a gestação.</div>
      </div>
    );
  }
  if (v.mode === 'empty') return <div class="screen"><h1 class="title">Resumo</h1><div class="muted">Sem dados ainda.</div></div>;

  return (
    <div class="screen">
      <h1 class="title" style={{ fontSize: 26 }}>Resumo</h1>
      <div class="grid2">
        <section class="card">
          <div class="small muted" style={{ fontWeight: 600 }}>Ciclo médio</div>
          <div class="display" style={{ fontSize: 30 }}>{v.avgCycle} dias</div>
          <div class="small muted">{v.avgCycleSub}</div>
        </section>
        <section class="card">
          <div class="small muted" style={{ fontWeight: 600 }}>Menstruação média</div>
          <div class="display" style={{ fontSize: 30 }}>{v.avgPeriod} dias</div>
          <div class="small muted">{v.avgPeriodSub}</div>
        </section>
      </div>
      <section class="card">
        <div class="head"><strong>Regularidade</strong><strong style={{ color: TONE[v.regularity.tone], fontSize: 14 }}>{v.regularity.title}</strong></div>
        <div class="muted">{v.regularity.text}</div>
        <Sources sources={v.regularity.sources} />
        {v.bars.length > 0 && (
          <>
            <div class="bars" role="img" aria-label={`Duração dos últimos ciclos: ${v.bars.map((b) => b.len).join(', ')} dias`}>
              {v.bars.map((b) => (
                <div key={b.key} class={b.odd ? 'odd' : undefined}>
                  <strong>{b.len}</strong>
                  <span class="b" style={{ height: b.height }} />
                  <span class="small muted">{b.month}</span>
                </div>
              ))}
            </div>
            <div class="small muted">Duração dos últimos ciclos, em dias, pelo mês de início</div>
          </>
        )}
      </section>
      <section class="card">
        <strong>Pílula do dia seguinte</strong>
        <div class="muted">{v.pds}</div>
      </section>
      <section class="card">
        <strong>Sintomas mais frequentes</strong>
        {v.hasCycles
          ? <TopList items={v.top} color="var(--c-symptom)" empty="" />
          : <div class="muted">Aparece aqui depois do primeiro ciclo completo.</div>}
        <div class="small muted">Um ciclo só entra na conta se você registrou algum sintoma nele ou marcou "Sem sintomas". Ciclo em branco não é ciclo sem sintoma.</div>
      </section>
    </div>
  );
}
