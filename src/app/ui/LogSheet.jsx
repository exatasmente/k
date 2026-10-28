import { useRef, useState } from 'preact/hooks';
import { logView } from '../views.js';
import { Icon, catStyle } from './icons.jsx';
import { Sheet, Switch } from './Sheet.jsx';

const LONG_PRESS_MS = 500;
const SHORT = { flow: 'Fluxo', alert: 'Alerta', symptom: 'Sintomas', mood: 'Humor', baby: 'Bebê', discharge: 'Secreção', sex: 'Relação', factors: 'Fatores', lifestyle: 'Atividade', test: 'Teste' };

/** Toque liga/desliga; segurar abre o histórico. Enter/Espaço no teclado = toque. */
function usePress(onTap, onLong) {
  const timer = useRef(null);
  const fired = useRef(false);
  const cancel = () => clearTimeout(timer.current);
  return {
    onPointerDown: () => {
      fired.current = false;
      cancel();
      timer.current = setTimeout(() => { fired.current = true; onLong(); }, LONG_PRESS_MS);
    },
    onPointerUp: cancel, onPointerLeave: cancel, onPointerCancel: cancel,
    onContextMenu: (e) => e.preventDefault(),
    onClick: () => { if (fired.current) { fired.current = false; return; } onTap(); },
  };
}

function Item({ it, onTap, onLong, tile }) {
  const press = usePress(onTap, onLong);
  const aria = `${it.label}${it.pressed ? ', marcado' : ''}. Segure para ver o histórico.`;
  return (
    <button class={`${tile ? 'tile' : 'item'}${it.highlight ? ' highlight' : ''}`} style={catStyle(it.cat)}
      aria-pressed={it.pressed ? 'true' : 'false'} aria-label={aria} {...press}>
      <span class="ico"><Icon code={it.code} size={tile ? 22 : 20} /></span>
      <span>{it.label}</span>
    </button>
  );
}

export function LogSheet({ model, store, nav, date }) {
  const v = logView(model, date);
  const [editing, setEditing] = useState(false);
  const [active, setActive] = useState('top');
  const [pregPrompt, setPregPrompt] = useState(false);
  const body = useRef(null);
  const chipsRow = useRef(null);
  const jumping = useRef(false);

  const tap = async (code) => {
    const r = await store.tap(date, code);
    if (code === 'preg_test_positive') setPregPrompt(r.turnedOn && !model.pregnancy);
  };
  const open = (code) => nav.openSymptom(code, { type: 'log', date });

  const jumpTo = (id) => {
    const target = body.current?.querySelector(`[data-sec="${id}"]`);
    if (target) body.current.scrollTo({ top: target.offsetTop - 8, behavior: 'smooth' });
    jumping.current = true;
    setTimeout(() => { jumping.current = false; }, 700);
    setActive(id);
  };
  // Scroll spy: a tag ativa acompanha a seção no topo da lista.
  const onScroll = () => {
    if (jumping.current || !body.current) return;
    const box = body.current;
    const secs = [...box.querySelectorAll('[data-sec]')];
    let cur = 'top';
    for (const s of secs) if (s.offsetTop - 24 <= box.scrollTop) cur = s.dataset.sec;
    if (box.scrollTop + box.clientHeight >= box.scrollHeight - 4 && secs.length) cur = secs[secs.length - 1].dataset.sec;
    if (cur === active) return;
    const chip = chipsRow.current?.querySelector(`[data-chip="${cur}"]`);
    if (chip) chipsRow.current.scrollTo({ left: chip.offsetLeft - 16, behavior: 'smooth' });
    setActive(cur);
  };

  const chips = [{ id: 'top', label: 'Sugeridos', cat: null }, ...v.sections.map((s) => ({ id: s.id, label: SHORT[s.id], cat: s.id }))];

  const head = (
    <>
      <div class="head">
        <div>
          <h2 class="title" style={{ fontSize: 22 }}>Registrar</h2>
          <div class="small muted">{v.dateLabel}</div>
        </div>
        <div class="row" style={{ flexWrap: 'nowrap' }}>
          <button class="btn" aria-pressed={editing ? 'true' : 'false'} onClick={() => setEditing(!editing)}>{editing ? 'Concluir' : 'Editar'}</button>
          <button class="btn primary" onClick={nav.close}>Pronto</button>
        </div>
      </div>
      <div class="small muted">{editing ? 'Escolha o que aparece no registro.' : 'Toque para marcar · segure para ver o histórico'}</div>
      {!editing && (
        <nav class="jump" aria-label="Ir para a seção" ref={chipsRow}>
          {chips.map((c) => (
            <button key={c.id} data-chip={c.id} aria-current={active === c.id ? 'location' : undefined}
              style={c.cat ? catStyle(c.cat) : { '--color': 'var(--ink)', '--tint': 'var(--track)' }} onClick={() => jumpTo(c.id)}>
              {c.label}
            </button>
          ))}
        </nav>
      )}
    </>
  );

  if (editing) {
    return (
      <Sheet label="Editar categorias" onClose={nav.close} head={head}>
        <div class="sheet-body" style={{ gap: 8 }}>
          <div class="muted">Esconder uma categoria tira os ícones dela do registro. Esconder Relação também tira o atalho da tela Hoje.</div>
          {v.editRows.map((r) => (
            <div key={r.id} class="card setting" style={{ background: 'var(--ground)', border: 0 }}>
              <div class="row" style={catStyle(r.id)}>
                <i class="swatch" style={{ background: 'var(--color)', borderRadius: 6 }} />
                <div><strong>{r.label}</strong><div class="small muted">{r.count} itens</div></div>
              </div>
              <Switch on={r.on} label={`${r.on ? 'Esconder' : 'Mostrar'} ${r.label}`} onToggle={() => store.toggleCategory(r.id)} />
            </div>
          ))}
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet label="Registrar" onClose={nav.close} head={head}>
      <div class="sheet-body" ref={body} onScroll={onScroll}>
        {v.redFlag && (
          <div class="alert danger" role="alert"><strong>Procure atendimento</strong><div>{v.redFlag}</div></div>
        )}
        <section class="suggest" data-sec="top">
          <div class="sec-head" style={{ padding: '0 4px' }}>
            <h3 style={{ color: 'var(--ink)' }}>Comuns para você agora</h3>
            <span class="small muted">{v.suggest.label}</span>
          </div>
          <div class="tiles">
            {v.suggest.items.map((it) => <Item key={it.code} it={it} tile onTap={() => tap(it.code)} onLong={() => open(it.code)} />)}
          </div>
          {v.calmVisible && (
            <button class="calm" aria-pressed={v.calmPressed ? 'true' : 'false'} onClick={() => tap('no_symptoms')}>
              <Icon name="check" size={20} width={2} /> Dia tranquilo · sem sintomas
            </button>
          )}
        </section>

        {v.sections.map((s) => (
          <section key={s.id} data-sec={s.id} style={{ ...catStyle(s.id), display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div class="sec-head"><h3>{s.label}</h3><span class="small muted">{s.hint}</span></div>
            {s.id === 'sex' && v.pds && <div class="alert warn" role="alert"><strong>Atenção</strong><div>{v.pds}</div></div>}
            {s.id === 'test' && pregPrompt && (
              <div class="alert" role="status" style={{ background: 'var(--indigo-tint)', border: '1.5px solid var(--indigo)' }}>
                <strong style={{ color: 'var(--indigo-ink)' }}>Teste positivo registrado</strong>
                <div>Quer mudar o app para o modo gestação? Seu histórico de ciclos fica guardado e você pode voltar quando quiser. Um exame de sangue e uma consulta confirmam o resultado.</div>
                <div class="row">
                  <button class="btn accent" onClick={nav.openPregSetup}>Ativar modo gestação</button>
                  <button class="btn ghost" onClick={() => setPregPrompt(false)}>Agora não</button>
                </div>
              </div>
            )}
            <div class="chips">
              {s.items.map((it) => <Item key={it.code} it={it} onTap={() => tap(it.code)} onLong={() => open(it.code)} />)}
            </div>
          </section>
        ))}
      </div>
    </Sheet>
  );
}
