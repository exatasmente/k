import { useState } from 'preact/hooks';
import { todayView } from '../views.js';
import { Icon, catStyle } from './icons.jsx';

const R = 96;
const C = 2 * Math.PI * R;

function Ring({ ring }) {
  const ang = ring.markerFrac * 2 * Math.PI - Math.PI / 2;
  return (
    <div class="ring">
      <svg width="232" height="232" viewBox="0 0 240 240" aria-hidden="true">
        <circle cx="120" cy="120" r={R} fill="none" stroke="var(--track)" stroke-width="18" />
        {ring.fertile && (
          <circle cx="120" cy="120" r={R} fill="none" stroke="var(--fertile)" stroke-width="18"
            stroke-dasharray={`${(ring.fertile.to - ring.fertile.from) * C} ${C}`} stroke-dashoffset={-ring.fertile.from * C}
            transform="rotate(-90 120 120)" />
        )}
        <circle cx="120" cy="120" r={R} fill="none" stroke="var(--berry)" stroke-width="18"
          stroke-dasharray={`${ring.periodFrac * C} ${C}`} transform="rotate(-90 120 120)" />
        <circle cx={120 + R * Math.cos(ang)} cy={120 + R * Math.sin(ang)} r="13" fill="var(--card)" stroke="var(--ink)" stroke-width="4" />
      </svg>
      <div class="ring-text">
        <div class="small muted" style={{ fontWeight: 700 }}>{ring.top}</div>
        <div class={`ring-big tone-${ring.tone}`}>{ring.big}</div>
        <div class="muted" style={{ maxWidth: 140, fontSize: 14 }}>{ring.bottom}</div>
      </div>
    </div>
  );
}

function PregnancyCards({ p, nav, store }) {
  return (
    <>
      <section class="card big">
        <div class="head">
          <span class="eyebrow" style={{ color: 'var(--indigo-ink)' }}>Gestação</span>
          <span class="small muted" style={{ fontWeight: 700 }}>{p.trimester}</span>
        </div>
        <div>
          <div class="display" style={{ fontSize: 44, lineHeight: 1 }}>{p.short}</div>
          <div class="muted">{p.long}</div>
        </div>
        <div role="img" aria-label={`Progresso da gestação: ${p.long} de 40 semanas`}>
          <div class="bar"><div style={{ width: `${p.pct}%`, background: 'var(--indigo)' }} /></div>
          <div class="small muted head"><span>0</span><span>13s</span><span>27s</span><span>40 semanas</span></div>
        </div>
        <div>Data provável do parto: <strong>{p.due}</strong></div>
        <div class="small muted">{p.dating}. É uma estimativa; o pré-natal pode ajustar.</div>
        <div class="row">
          <button class="btn" onClick={nav.openPregSetup}>Ajustar datação</button>
          <button class="btn ghost" onClick={nav.openPregEnd}>Encerrar acompanhamento</button>
        </div>
      </section>
      <section class="card">
        <label for="consult" style={{ fontWeight: 700 }}>Próxima consulta do pré-natal</label>
        <input id="consult" class="field" type="date" value={p.consult} onChange={(e) => store.setConsult(e.currentTarget.value)} />
        <div class="small muted">{p.consultText}</div>
      </section>
      <details class="card">
        <summary style={{ fontWeight: 700, color: 'var(--danger-ink)', minHeight: 32, cursor: 'pointer' }}>Quando procurar atendimento</summary>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          {p.flags.map((f) => <li key={f}>{f}</li>)}
        </ul>
        <div class="small muted">Se acontecer, procure atendimento. Se for intenso, vá ao pronto-socorro ou ligue 192 (SAMU).</div>
      </details>
    </>
  );
}

function PendingPeriod({ p, store, today }) {
  const [end, setEnd] = useState(p.end);
  return (
    <section class="card" aria-label="Confirmar fim da menstruação">
      <strong>Sua menstruação terminou em {p.endText}?</strong>
      <div class="small muted">Ela começou em {p.startText} e o fim não foi marcado. Fechamos pela sua média; confirme ou corrija.</div>
      <label for="period-end" class="small muted">Último dia de sangramento</label>
      <input id="period-end" class="field" type="date" min={p.start} max={today} value={end} onChange={(e) => setEnd(e.currentTarget.value)} />
      <div class="row"><button class="btn accent" onClick={() => store.confirmPeriodEnd(p.id, end)}>Confirmar</button></div>
    </section>
  );
}

export function Today({ model, store, nav, askCycle }) {
  const v = todayView(model);
  const q = v.quick;

  const endOrStartPeriod = async () => {
    if (q.periodOpen) nav.askCycle(await store.endPeriod());
    else await store.startPeriod();
  };
  const answer = async (a) => {
    await store.answerCycle(askCycle, 'cramps', a);
    nav.askCycle(null);
  };

  return (
    <div class="screen">
      <div class="head">
        <div>
          <div class="eyebrow">Hoje</div>
          <h1 class="title">{v.dateLong}</h1>
        </div>
        <button class="icon-btn" aria-label="Ajustes e privacidade" onClick={nav.openSettings}><Icon name="settings" /></button>
      </div>

      {v.redFlag && (
        <div class="alert danger" role="alert">
          <strong style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Icon name="warn" width={2} /> Procure atendimento</strong>
          <div>{v.redFlag}</div>
        </div>
      )}

      {v.pregnancy && <PregnancyCards p={v.pregnancy} nav={nav} store={store} />}

      {v.postpartum && (
        <section class="card big">
          <span class="eyebrow" style={{ color: 'var(--indigo-ink)' }}>Pós-parto</span>
          <div class="display" style={{ fontSize: 22 }}>{v.postpartum.since}</div>
          <div class="muted">Nos primeiros meses, principalmente amamentando, a menstruação pode demorar a voltar e vir irregular. Os avisos de regularidade ficam pausados.</div>
          <div style={{ color: 'var(--danger-ink)' }}>Sangramento muito intenso, febre ou dor forte: procure atendimento.</div>
        </section>
      )}

      {v.mode === 'awaiting' && (
        <section class="card big">
          <div class="display" style={{ fontSize: 22 }}>Esperando a menstruação voltar</div>
          <div class="muted">Quando ela vier, toque em "Menstruei". As previsões voltam a partir daí. Seu histórico continua guardado.</div>
        </section>
      )}

      {v.pendingPeriod && <PendingPeriod key={v.pendingPeriod.id} p={v.pendingPeriod} store={store} today={model.today} />}

      {askCycle && v.mode === 'cycle' && (
        <section class="card" aria-label="Pergunta sobre o ciclo">
          <strong>Teve cólica nesta menstruação?</strong>
          <div class="small muted">Uma resposta vale para o ciclo todo. "Não lembro" deixa como sem registro.</div>
          <div class="row">
            <button class="btn accent" onClick={() => answer('yes')}>Sim</button>
            <button class="btn" onClick={() => answer('no')}>Não</button>
            <button class="btn ghost" onClick={() => answer('unknown')}>Não lembro</button>
          </div>
        </section>
      )}

      {v.ring && (
        <section class="card big center">
          <Ring ring={v.ring} />
          {v.ring.tracks && (
            <div class="legend">
              <span><i class="swatch" style={{ background: 'var(--berry)' }} />Menstruação</span>
              <span><i class="swatch" style={{ background: 'var(--fertile)' }} />Janela fértil</span>
            </div>
          )}
          {v.ring.hormonalNote && <div class="small muted">{v.ring.hormonalNote}</div>}
          {v.ring.window && <div class="pill-note">{v.ring.window}</div>}
        </section>
      )}

      {(q.showPeriod || q.showSex) && (
        <div class="grid2" style={!(q.showPeriod && q.showSex) ? { gridTemplateColumns: '1fr' } : undefined}>
          {q.showPeriod && (
            <button class={`quick period${q.periodOpen ? ' on' : ''}`} aria-pressed={q.periodOpen ? 'true' : 'false'} onClick={endOrStartPeriod}>
              <strong><Icon name="drop" size={20} width={2} />{q.periodOpen ? 'Menstruando' : 'Menstruei'}</strong>
              <span>{q.periodOpen ? 'Toque quando terminar' : 'Marca hoje como dia 1'}</span>
            </button>
          )}
          {q.showSex && (
            <button class={`quick sex${q.sexDone ? ' on' : ''}`} aria-pressed={q.sexDone ? 'true' : 'false'} onClick={store.quickSex}>
              <strong><Icon name="heart" size={20} width={2} />{q.sexDone ? 'Relação hoje' : 'Relação'}</strong>
              <span>{q.sexSub}</span>
            </button>
          )}
        </div>
      )}

      {q.showStrip && (
        <section class={q.unprotected ? 'alert warn' : 'card'}>
          <div style={{ fontWeight: 600 }}>{q.stripText}</div>
          <div class="row">
            <button class="chip" aria-pressed={q.hasCondom ? 'true' : 'false'} onClick={() => store.tap(model.today, 'protection_condom')}>Com preservativo</button>
            <button class="chip" aria-pressed={q.hasNone ? 'true' : 'false'} onClick={() => store.tap(model.today, 'protection_none')}>Sem preservativo</button>
          </div>
          <button class={`pds-btn${q.unprotected && !q.pdsToday ? ' urgent' : ''}`} aria-pressed={q.pdsToday ? 'true' : 'false'}
            onClick={() => store.tap(model.today, 'emergency_contraception')}>
            <Icon name="pill" size={20} width={2} />
            {q.pdsToday ? 'Pílula do dia seguinte registrada' : 'Tomei a pílula do dia seguinte'}
          </button>
        </section>
      )}

      {v.pds && (
        <div class="alert warn" role="alert">
          <strong style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Icon name="warn" width={2} />{v.pds.title}</strong>
          <div>{v.pds.body}</div>
          <div class="row">
            <button class="btn" style={{ background: 'var(--warn-ink)', color: '#fff', border: 0 }}
              onClick={() => { store.dismiss('pds', v.pds.context); nav.ask('Quantas vezes tomei a pílula do dia seguinte neste ano?'); }}>Entender melhor</button>
            <button class="btn" onClick={() => store.dismiss('pds', v.pds.context)}>Ok</button>
          </div>
        </div>
      )}

      <button class="btn primary block" onClick={() => nav.openLog()}>
        <span class="row" style={{ justifyContent: 'center' }}><Icon name="plus" width={2.2} />Registrar sintomas, humor e mais</span>
      </button>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div class="head">
          <h2 class="display" style={{ fontSize: 19 }}>Registros de hoje</h2>
          <span class="small muted">{v.tags.length === 1 ? '1 item' : `${v.tags.length} itens`}</span>
        </div>
        {v.tags.length === 0 && <div class="muted">Nada marcado hoje ainda.</div>}
        <div class="tags">
          {v.tags.map((t) => (
            <span key={t.code} class="tag" style={{ ...catStyle(t.cat), background: 'var(--tint)', color: 'var(--color)' }}>
              {t.label}
              <button aria-label={`Remover ${t.label}`} onClick={() => store.tap(model.today, t.code)}><Icon name="close" size={14} width={2.5} /></button>
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
