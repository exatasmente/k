import { useEffect, useState } from 'preact/hooks';
import { Icon } from './icons.jsx';
import { Onboarding } from './Onboarding.jsx';
import { Today } from './Today.jsx';
import { CalendarScreen } from './Calendar.jsx';
import { Stats } from './Stats.jsx';
import { LogSheet } from './LogSheet.jsx';
import { SymptomSheet } from './SymptomSheet.jsx';
import { SettingsSheet } from './Settings.jsx';
import { PregnancySetupSheet, PregnancyEndSheet } from './Pregnancy.jsx';
import { ChatSheet } from './ChatSheet.jsx';
import { answer, GREETING } from '../assistant.js';
import { registerBackground } from '../notify.js';

const TABS = [
  ['today', 'Hoje', 'home'],
  ['calendar', 'Calendário', 'calendar'],
  ['stats', 'Resumo', 'chart'],
];

function useModel(store) {
  const [model, setModel] = useState(store.getModel());
  useEffect(() => {
    const off = store.subscribe(setModel);
    // App instalado fica aberto por dias: recalcula "hoje" e os lembretes ao voltar para ele.
    const onVisible = () => { if (document.visibilityState === 'visible') store.syncReminders(); };
    document.addEventListener('visibilitychange', onVisible);
    store.syncReminders();
    // O navegador pode ter liberado a verificação em segundo plano depois (ex.: app instalado).
    if (store.getModel().profile?.reminders?.enabled) registerBackground().catch(() => {});
    return () => { off(); document.removeEventListener('visibilitychange', onVisible); };
  }, [store]);
  return model;
}

export function App({ store }) {
  const model = useModel(store);
  const [screen, setScreen] = useState('today');
  // Folha aberta: {type: 'log'|'symptom'|'settings'|'pregSetup'|'pregEnd', ...}
  const [sheet, setSheet] = useState(null);
  const [askCycle, setAskCycle] = useState(null);
  // Conversa da assistente: só em memória, some ao fechar o app.
  const [messages, setMessages] = useState([{ from: 'ai', text: GREETING }]);

  if (!model.onboarded) return <Onboarding store={store} />;

  const nav = {
    openLog: (date = model.today) => setSheet({ type: 'log', date }),
    openSymptom: (code, back = null) => setSheet({ type: 'symptom', code, back }),
    openSettings: () => setSheet({ type: 'settings' }),
    openPregSetup: () => setSheet({ type: 'pregSetup' }),
    openPregEnd: () => setSheet({ type: 'pregEnd' }),
    close: () => setSheet(null),
    goToday: () => { setSheet(null); setScreen('today'); },
    goStats: () => { setSheet(null); setScreen('stats'); },
    askCycle: setAskCycle,
    openChat: () => setSheet({ type: 'chat' }),
    ask: (q) => {
      setMessages((ms) => [...ms, { from: 'me', text: q }, { from: 'ai', text: answer(store.getModel(), q) }]);
      setSheet({ type: 'chat' });
    },
  };

  return (
    <div class="app">
      <main>
        {screen === 'today' && <Today model={model} store={store} nav={nav} askCycle={askCycle} />}
        {screen === 'calendar' && <CalendarScreen model={model} nav={nav} store={store} />}
        {screen === 'stats' && <Stats model={model} />}
      </main>

      <nav class="tabbar" aria-label="Navegação principal">
        {TABS.map(([id, label, icon]) => (
          <button key={id} aria-current={screen === id && sheet?.type !== 'chat' ? 'page' : undefined} onClick={() => { setSheet(null); setScreen(id); }}>
            <Icon name={icon} size={24} width={1.9} />
            {label}
          </button>
        ))}
        <button aria-current={sheet?.type === 'chat' ? 'page' : undefined} onClick={nav.openChat}>
          <Icon name="spark" size={24} width={1.9} />
          Assistente
        </button>
      </nav>

      {sheet?.type === 'log' && <LogSheet model={model} store={store} nav={nav} date={sheet.date} />}
      {sheet?.type === 'symptom' && <SymptomSheet model={model} nav={nav} code={sheet.code} back={sheet.back} />}
      {sheet?.type === 'settings' && <SettingsSheet model={model} store={store} nav={nav} />}
      {sheet?.type === 'pregSetup' && <PregnancySetupSheet model={model} store={store} nav={nav} />}
      {sheet?.type === 'pregEnd' && <PregnancyEndSheet store={store} nav={nav} />}
      {sheet?.type === 'chat' && <ChatSheet model={model} nav={nav} messages={messages} ask={nav.ask} />}
    </div>
  );
}
