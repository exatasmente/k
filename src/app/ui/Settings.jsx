import { useRef, useState } from 'preact/hooks';
import { METHODS } from '../../domain/contraception.js';
import { CloseButton, Sheet, Switch } from './Sheet.jsx';

const HOLD_MS = 1500;

function downloadJSON(data, filename) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Segurar para apagar: evita exclusão acidental sem tela extra de confirmação. */
function HoldToDelete({ onDone }) {
  const [progress, setProgress] = useState(0);
  const timer = useRef(null);
  const start = () => {
    const t0 = Date.now();
    clearInterval(timer.current);
    timer.current = setInterval(() => {
      const p = Math.min(100, ((Date.now() - t0) / HOLD_MS) * 100);
      setProgress(p);
      if (p >= 100) { clearInterval(timer.current); onDone(); }
    }, 50);
  };
  const stop = () => { clearInterval(timer.current); setProgress((p) => (p >= 100 ? p : 0)); };
  return (
    <button class="hold" aria-label="Segure para apagar meus dados"
      onPointerDown={start} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop} onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) start(); }} onKeyUp={stop}>
      <span class="fill" style={{ width: `${progress}%` }} />
      <span class="lbl">Segure para apagar</span>
    </button>
  );
}

export function SettingsSheet({ model, store, nav }) {
  const [deleted, setDeleted] = useState(false);
  const [message, setMessage] = useState('');
  const fileInput = useRef(null);

  const exportBackup = () => {
    downloadJSON(store.exportBackup(), `ciclo-backup-${model.today}.json`);
    setMessage('Backup baixado. Guarde o arquivo em um lugar seguro: ele não é cifrado.');
  };
  const importBackup = async (e) => {
    const file = e.currentTarget.files?.[0];
    if (!file) return;
    try {
      await store.importBackup(JSON.parse(await file.text()));
      setMessage('Backup restaurado.');
    } catch (err) {
      setMessage(`Não deu para restaurar: ${err.message}`);
    }
  };
  const deleteAll = async () => {
    await store.deleteAll();
    setDeleted(true);
  };

  const head = (
    <div class="head">
      <h2 class="title">Ajustes & privacidade</h2>
      <CloseButton onClick={nav.close} />
    </div>
  );

  if (deleted) {
    return (
      <Sheet label="Dados apagados" onClose={() => location.reload()} head={head}>
        <div class="sheet-body">
          <div class="card">
            <strong>Pronto. Seus dados foram apagados deste aparelho.</strong>
            <div class="muted">A chave de criptografia também foi apagada. Nada saiu do aparelho.</div>
            <button class="btn primary" onClick={() => location.reload()}>Recomeçar</button>
          </div>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet label="Ajustes e privacidade" onClose={nav.close} head={head}>
      <div class="sheet-body" style={{ gap: 12, background: 'var(--ground)' }}>
        <section class="card">
          <strong>Onde ficam seus dados</strong>
          <div class="muted">Neste aparelho, cifrados. Sem conta e sem nuvem.</div>
          <div class="row">
            <button class="btn" onClick={exportBackup}>Baixar backup</button>
            <button class="btn" onClick={() => fileInput.current?.click()}>Restaurar backup</button>
            <input ref={fileInput} type="file" accept="application/json,.json" class="sr-only" tabIndex={-1} onChange={importBackup} aria-label="Arquivo de backup" />
          </div>
          {message && <div class="small" role="status">{message}</div>}
        </section>

        <section class="card setting">
          <div><strong>Assistente de IA (em breve)</strong><div class="small muted">Vai receber só datas e eventos, nunca nome ou e-mail.</div></div>
          <Switch on={!!model.profile.aiEnabled} label="Assistente de IA" onToggle={() => store.setAiEnabled(!model.profile.aiEnabled)} />
        </section>

        <section class="card">
          <strong>Método contraceptivo</strong>
          <div class="row">
            {Object.entries(METHODS).map(([id, m]) => (
              <button key={id} class="chip" aria-pressed={id === model.method ? 'true' : 'false'} onClick={() => store.setMethod(id)}>{m.label}</button>
            ))}
          </div>
          <div class="small muted">A troca vale a partir de hoje; o histórico anterior fica como estava.</div>
        </section>

        <section class="card setting">
          <div><strong>Modo gestação</strong><div class="small muted">Acompanhe a gestação sem perder seu histórico de ciclos, e volte quando quiser.</div></div>
          <Switch on={!!model.pregnancy} label="Modo gestação" onToggle={model.pregnancy ? nav.openPregEnd : nav.openPregSetup} />
        </section>

        <section class="card" style={{ border: '1.5px solid var(--berry-tint)' }}>
          <strong style={{ color: 'var(--berry-ink)' }}>Apagar meus dados</strong>
          <div class="muted">Apaga deste aparelho tudo que identifica você e seu histórico detalhado. Podemos manter estatísticas anônimas de ciclo, sem datas e sem nome, junto com sua idade.</div>
          <HoldToDelete onDone={deleteAll} />
        </section>
      </div>
    </Sheet>
  );
}
