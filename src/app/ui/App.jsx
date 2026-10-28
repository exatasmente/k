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

const TABS = [
  ['today', 'Hoje', 'home'],
  ['calendar', 'Calendário', 'calendar'],
  ['stats', 'Resumo', 'chart'],
];

function useModel(store) {
  const [model, setModel] = useState(store.getModel());
  useEffect(() => {
    const off = store.subscribe(setModel);
    // App instalado fica aberto por dias: recalcula "hoje" ao voltar para ele.
    const onVisible = () => { if (document.visibilityState === 'visible') store.refresh(); };
    document.addEventListener('visibilitychange', onVisible);
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

  if (!model.onboarded) return <Onboarding store={store} />;

  const nav = {
    openLog: (date = model.today) => setSheet({ type: 'log', date }),
    openSymptom: (code, back = null) => setSheet({ type: 'symptom', code, back }),
    openSettings: () => setSheet({ type: 'settings' }),
    openPregSetup: () => setSheet({ type: 'pregSetup' }),
    openPregEnd: () => setSheet({ type: 'pregEnd' }),
    close: () => setSheet(null),
    goToday: () => { setSheet(null); setScreen('today'); },
    askCycle: setAskCycle,
  };

  return (
    <div class="app">
      <main>
        {screen === 'today' && <Today model={model} store={store} nav={nav} askCycle={askCycle} />}
        {screen === 'calendar' && <CalendarScreen model={model} nav={nav} />}
        {screen === 'stats' && <Stats model={model} />}
      </main>

      <nav class="tabbar" aria-label="Navegação principal">
        {TABS.map(([id, label, icon]) => (
          <button key={id} aria-current={screen === id ? 'page' : undefined} onClick={() => { setSheet(null); setScreen(id); }}>
            <Icon name={icon} size={24} width={1.9} />
            {label}
          </button>
        ))}
      </nav>

      {sheet?.type === 'log' && <LogSheet model={model} store={store} nav={nav} date={sheet.date} />}
      {sheet?.type === 'symptom' && <SymptomSheet model={model} nav={nav} code={sheet.code} back={sheet.back} />}
      {sheet?.type === 'settings' && <SettingsSheet model={model} store={store} nav={nav} />}
      {sheet?.type === 'pregSetup' && <PregnancySetupSheet model={model} store={store} nav={nav} />}
      {sheet?.type === 'pregEnd' && <PregnancyEndSheet store={store} nav={nav} />}
    </div>
  );
}
