import { useState } from 'preact/hooks';
import { addDays } from '../../domain/dates.js';
import { datePregnancy, PREGNANCY_DAYS } from '../../domain/stages.js';
import { fmtYear } from '../views.js';
import { Sheet } from './Sheet.jsx';

/** Ativar ou ajustar a gestação: pela DUM ou pela DPP do laudo da ultrassonografia. */
export function PregnancySetupSheet({ model, store, nav }) {
  const current = model.pregnancy;
  const lastStart = [...(model.ctx?.periods ?? [])].reverse().find((p) => p.start <= model.today)?.start ?? model.today;
  const [method, setMethod] = useState(current?.dating ?? 'lmp');
  const [lmp, setLmp] = useState(current?.dating === 'lmp' ? current.start : lastStart);
  const [due, setDue] = useState(current ? addDays(current.start, PREGNANCY_DAYS) : '');

  const input = method === 'ultrasound' ? { method, dueDate: due } : { method, lmp };
  const ready = method === 'ultrasound' ? !!due : !!lmp;
  const r = ready ? datePregnancy(input, model.today) : null;
  const save = async () => {
    await store.savePregnancy(input);
    nav.goToday();
  };

  return (
    <Sheet label="Datação da gestação" onClose={nav.close}
      head={<h2 class="title">Como contamos as semanas?</h2>}>
      <div class="sheet-body" style={{ gap: 14 }}>
        <div class="muted">Dá para ajustar depois. A ultrassonografia do início da gestação costuma ser a referência mais precisa.</div>
        <div class={`choice${method === 'lmp' ? ' on' : ''}`}>
          <button aria-pressed={method === 'lmp' ? 'true' : 'false'} onClick={() => setMethod('lmp')}>Pela última menstruação</button>
          {method === 'lmp' && (
            <>
              <label for="lmp" class="small muted">Primeiro dia da última menstruação</label>
              <input id="lmp" class="field" type="date" max={model.today} value={lmp} onChange={(e) => setLmp(e.currentTarget.value)} />
            </>
          )}
        </div>
        <div class={`choice${method === 'ultrasound' ? ' on' : ''}`}>
          <button aria-pressed={method === 'ultrasound' ? 'true' : 'false'} onClick={() => setMethod('ultrasound')}>Pela ultrassonografia</button>
          {method === 'ultrasound' && (
            <>
              <label for="due" class="small muted">Data provável do parto (DPP) que está no laudo</label>
              <input id="due" class="field" type="date" value={due} onChange={(e) => setDue(e.currentTarget.value)} />
            </>
          )}
        </div>
        <div class="pill-note" style={{ background: 'var(--indigo-tint)', color: 'var(--indigo-ink)' }}>
          {!r ? 'Informe a data provável do parto que está no laudo.'
            : r.valid ? `Hoje: ${r.ga.label} · data provável do parto ${fmtYear(r.stage.dueDate)}`
              : 'Essa data não parece certa. Confira o dia informado.'}
        </div>
        {r?.valid && r.earlyWarning && (
          <div class="alert warn" role="status">
            Pela data informada seriam só {r.ga.label}. Os testes costumam dar positivo a partir de umas 4 semanas, contando da última menstruação. Se aquele sangramento foi um escape, informe a menstruação anterior ou use a ultrassonografia.
          </div>
        )}
        <button class="btn accent block" disabled={!r?.valid} onClick={save}>{current ? 'Salvar datação' : 'Começar o modo gestação'}</button>
        <button class="btn ghost" onClick={nav.close}>Cancelar</button>
      </div>
    </Sheet>
  );
}

/** Encerrar sem perguntar nem guardar o motivo. */
export function PregnancyEndSheet({ store, nav }) {
  const end = async (next) => {
    await store.endPregnancy(next);
    nav.goToday();
  };
  return (
    <Sheet label="Encerrar acompanhamento da gestação" onClose={nav.close}
      head={<h2 class="title">Encerrar o acompanhamento da gestação?</h2>}>
      <div class="sheet-body" style={{ gap: 12 }}>
        <div class="muted">Não vamos perguntar o motivo e não guardamos isso. Seus registros continuam aqui. Escolha como quer seguir:</div>
        <button class="card" style={{ textAlign: 'left' }} onClick={() => end('postpartum')}>
          <strong>Acompanhar o pós-parto</strong>
          <span class="small muted">Avisos de regularidade pausados enquanto o ciclo volta.</span>
        </button>
        <button class="card" style={{ textAlign: 'left' }} onClick={() => end('cycle')}>
          <strong>Voltar a acompanhar o ciclo</strong>
          <span class="small muted">As previsões recomeçam na próxima menstruação.</span>
        </button>
        <button class="btn ghost" onClick={nav.close}>Cancelar</button>
      </div>
    </Sheet>
  );
}
