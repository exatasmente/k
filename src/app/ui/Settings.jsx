import { useEffect, useRef, useState } from 'preact/hooks';
import { METHODS } from '../../domain/contraception.js';
import { buildICS, calendarPredictions, reminderPrefs } from '../reminders.js';
import { copyOf, PROLONGED_AFTER_DAYS } from '../views.js';
import { Sourced } from './Sources.jsx';
import { disableBackground, notificationSupport, registerBackground, requestNotifications, SUPPORT_TEXT } from '../notify.js';
import { SOURCES } from '../../domain/sources.js';
import { CloseButton, Sheet, Switch } from './Sheet.jsx';

const HOLD_MS = 1500;

function downloadJSON(data, filename) {
  download(JSON.stringify(data, null, 2), 'application/json', filename);
}

function download(text, type, filename) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Lembretes: notificação quando o aparelho deixa, e agenda (.ics) sempre. */
function Reminders({ model, store }) {
  const prefs = reminderPrefs(model);
  const [support, setSupport] = useState(null);
  const [note, setNote] = useState('');
  useEffect(() => { notificationSupport().then(setSupport); }, [prefs.enabled]);
  const blocked = support === 'unsupported' || support === 'ios_install' || support === 'denied';
  const status = !support ? ''
    : blocked ? SUPPORT_TEXT[support]
      : !prefs.enabled ? (support === 'needs_permission' ? SUPPORT_TEXT.needs_permission : '')
        : SUPPORT_TEXT[support === 'needs_permission' ? 'denied' : support];

  const toggle = async () => {
    if (prefs.enabled) {
      await store.setReminders({ enabled: false });
      await disableBackground();
      return;
    }
    if (typeof Notification === 'undefined') return;
    // O pedido sai direto do toque, sem espera antes: o Safari só mostra a pergunta com o gesto.
    const granted = Notification.permission === 'granted' || (Notification.permission === 'default' && await requestNotifications());
    if (granted) {
      await registerBackground();
      await store.setReminders({ enabled: true });
    }
    setSupport(await notificationSupport());
  };
  const predictions = calendarPredictions(model);
  const exportCalendar = () => {
    download(buildICS(model, prefs), 'text/calendar', 'ciclo-previsoes.ics');
    setNote(`${predictions.length} previsões prontas para a agenda. Se você mudar algo no app, baixe de novo.`);
  };
  const pill = ['pill', 'continuous_pill', 'desogestrel', 'minipill'].includes(model.method);

  return (
    <section class="card" aria-label="Lembretes">
      <div class="setting">
        <div><strong>Lembretes</strong><div class="small muted">{model.pregnancy ? 'Véspera da consulta do pré-natal.' : 'Menstruação chegando, fim da menstruação a confirmar e ciclos irregulares.'}</div></div>
        <Switch on={prefs.enabled} label="Lembretes" disabled={blocked && !prefs.enabled} onToggle={toggle} />
      </div>
      {status && <div class="small muted" role="status">{status}</div>}
      {prefs.enabled && (
        <>
          {!model.pregnancy && (
            <div class="setting">
              <div class="small">Avisar antes da menstruação</div>
              <div class="stepper">
                <button class="icon-btn" aria-label="Menos dias antes" onClick={() => store.setReminders({ daysBefore: Math.max(1, prefs.daysBefore - 1) })}>−</button>
                <output aria-live="polite">{prefs.daysBefore} {prefs.daysBefore === 1 ? 'dia' : 'dias'}</output>
                <button class="icon-btn" aria-label="Mais dias antes" onClick={() => store.setReminders({ daysBefore: Math.min(7, prefs.daysBefore + 1) })}>+</button>
              </div>
            </div>
          )}
          <div class="setting">
            <div><div class="small">Mostrar o assunto na notificação</div><div class="small muted">Aparece na tela de bloqueio. Desligado, ela diz só "Você tem um lembrete".</div></div>
            <Switch on={prefs.details} label="Mostrar o assunto na notificação" onToggle={() => store.setReminders({ details: !prefs.details })} />
          </div>
        </>
      )}
      {!model.pregnancy && (
        <>
          <button class="btn" disabled={!predictions.length} onClick={exportCalendar}>Adicionar previsões à agenda</button>
          <div class="small muted">
            {predictions.length
              ? `Baixa as próximas ${predictions.length} menstruações previstas com alarme. A agenda pode sincronizar com a nuvem (Google, iCloud); por isso o título é só "Ciclo", a não ser que você ligue o assunto acima.`
              : 'Com a menstruação atrasada as previsões mudam a cada dia. Elas voltam para a agenda depois da próxima menstruação.'}
          </div>
        </>
      )}
      {pill && <div class="small muted">Lembrete da pílula: use o alarme do celular. Sem servidor, o navegador não garante o horário exato.</div>}
      {note && <div class="small" role="status">{note}</div>}
    </section>
  );
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
  const historyInput = useRef(null);
  const periodLength = model.profile.onboarding.periodLength;

  const exportBackup = () => {
    downloadJSON(store.exportBackup(), `ciclo-backup-${model.today}.json`);
    setMessage('Backup baixado. Guarde o arquivo em um lugar seguro: ele não é cifrado.');
  };
  const importBackup = async (e) => {
    const file = e.currentTarget.files?.[0];
    if (!file) return;
    try {
      await store.importBackup(JSON.parse(await file.text()));
      setMessage('Backup restaurado. Ele substituiu os dados que estavam neste aparelho.');
    } catch (err) {
      setMessage(`Não deu para restaurar: ${err.message}`);
    }
  };
  const importHistory = async (e) => {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!file) return;
    try {
      const r = await store.importHistory(JSON.parse(await file.text()));
      setMessage(`Histórico importado: ${r.periods} ${r.periods === 1 ? 'menstruação' : 'menstruações'} e ${r.entries} ${r.entries === 1 ? 'registro' : 'registros'}.`
        + (r.skipped ? ` ${r.skipped} já ${r.skipped === 1 ? 'existia' : 'existiam'} aqui e ${r.skipped === 1 ? 'ficou' : 'ficaram'} como estava${r.skipped === 1 ? '' : 'm'}.` : ''));
    } catch (err) {
      setMessage(`Não deu para importar: ${err.message}`);
    }
  };
  const deleteAll = async () => {
    await disableBackground().catch(() => {});
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
          <div class="small muted">Restaurar um backup substitui o que está neste aparelho.</div>
          <button class="btn" onClick={() => historyInput.current?.click()}>Importar histórico de outro app</button>
          <input ref={historyInput} type="file" accept="application/json,.json" class="sr-only" tabIndex={-1} onChange={importHistory} aria-label="Arquivo de histórico" />
          <div class="small muted">Acrescenta ciclos antigos sem apagar nada. O que você já registrou aqui vale mais.</div>
          <div class="row">
            <button class="btn" onClick={exportBackup}>Baixar backup</button>
            <button class="btn" onClick={() => fileInput.current?.click()}>Restaurar backup</button>
            <input ref={fileInput} type="file" accept="application/json,.json" class="sr-only" tabIndex={-1} onChange={importBackup} aria-label="Arquivo de backup" />
          </div>
          {message && <div class="small" role="status">{message}</div>}
        </section>

        <Reminders model={model} store={store} />

        <section class="card setting">
          <div><strong>Assistente de IA (em breve)</strong><div class="small muted">Vai receber só datas e eventos, nunca nome ou e-mail.</div></div>
          <Switch on={!!model.profile.aiEnabled} label="Assistente de IA" onToggle={() => store.setAiEnabled(!model.profile.aiEnabled)} />
        </section>

        <section class="card setting" aria-label="Duração da menstruação">
          <div><strong>Duração da sua menstruação</strong><div class="small muted">Usada nas previsões e para fechar uma menstruação esquecida.</div></div>
          <div class="stepper">
            <button class="icon-btn" aria-label="Diminuir duração da menstruação" onClick={() => store.setPeriodLength(Math.max(1, periodLength - 1))}>−</button>
            <output aria-live="polite">{periodLength} {periodLength === 1 ? 'dia' : 'dias'}</output>
            <button class="icon-btn" aria-label="Aumentar duração da menstruação" onClick={() => store.setPeriodLength(Math.min(15, periodLength + 1))}>+</button>
          </div>
        </section>
        {periodLength > PROLONGED_AFTER_DAYS && <Sourced class="small muted" copy={copyOf('prolongedDeclared')} />}

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

        <details class="card" aria-label="Fontes clínicas">
          <summary style={{ fontWeight: 700, cursor: 'pointer', minHeight: 32 }}>Fontes clínicas dos alertas</summary>
          <div class="small muted">Os alertas e orientações do app seguem estas fontes. Eles informam e não substituem uma consulta.</div>
          <ul class="small" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>
            {Object.entries(SOURCES).map(([id, s]) => (
              <li key={id}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a></li>
            ))}
          </ul>
        </details>

        <section class="card" style={{ border: '1.5px solid var(--berry-tint)' }}>
          <strong style={{ color: 'var(--berry-ink)' }}>Apagar meus dados</strong>
          <div class="muted">Apaga deste aparelho tudo que identifica você e seu histórico detalhado. Podemos manter estatísticas anônimas de ciclo, sem datas e sem nome, junto com sua idade.</div>
          <HoldToDelete onDone={deleteAll} />
        </section>
      </div>
    </Sheet>
  );
}
