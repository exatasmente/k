import { useState } from 'preact/hooks';
import { addDays, addMonths, ageOn, diffDays, today as localToday } from '../../domain/dates.js';
import { METHODS, tracksOvulation } from '../../domain/contraception.js';
import { Icon } from './icons.jsx';
import { Switch } from './Sheet.jsx';
import { MonthPicker } from './MonthPicker.jsx';
import { copyOf, PROLONGED_AFTER_DAYS } from '../views.js';
import { Sourced } from './Sources.jsx';

function Stepper({ label, hint, value, min, max, onChange }) {
  return (
    <div class="card setting">
      <div><strong>{label}</strong><div class="small muted">{hint}</div></div>
      <div class="stepper">
        <button class="icon-btn" aria-label={`Diminuir ${label.toLowerCase()}`} onClick={() => onChange(Math.max(min, value - 1))}>−</button>
        <output aria-live="polite">{value} dias</output>
        <button class="icon-btn" aria-label={`Aumentar ${label.toLowerCase()}`} onClick={() => onChange(Math.min(max, value + 1))}>+</button>
      </div>
    </div>
  );
}

export function Onboarding({ store }) {
  const today = localToday();
  const [step, setStep] = useState(0);
  const [lastPeriodStart, setLast] = useState(addDays(today, -7));
  const [cycleLength, setCycle] = useState(28);
  const [periodLength, setPeriod] = useState(5);
  const [birthDate, setBirth] = useState('');
  const [method, setMethod] = useState('none');
  const [aiEnabled, setAi] = useState(false);
  const [saving, setSaving] = useState(false);

  const daysAgo = diffDays(lastPeriodStart, today);
  const hormonal = !tracksOvulation(method);

  const finish = async () => {
    setSaving(true);
    await store.completeOnboarding({ lastPeriodStart, periodLength, cycleLength, birthDate, method, aiEnabled });
  };

  return (
    <div class="onb app">
      <div class="head">
        {step > 0 ? <button class="icon-btn" aria-label="Voltar" onClick={() => setStep(step - 1)}><Icon name="back" size={20} width={2} /></button> : <span />}
        <div class="steps" aria-hidden="true">{[0, 1, 2, 3].map((n) => <i key={n} class={n <= step ? 'on' : ''} />)}</div>
        <span class="small muted" style={{ fontWeight: 600 }}>{step + 1} de 4</span>
      </div>

      {step === 0 && (
        <>
          <h1>Quando começou sua última menstruação?</h1>
          <p class="muted" style={{ margin: 0 }}>Toque no dia. Use as setas para voltar aos meses anteriores. Se não lembrar exato, escolha o mais próximo.</p>
          <div class="card">
            <MonthPicker label="Primeiro dia da última menstruação" value={lastPeriodStart} onChange={setLast} min={addMonths(today, -12)} max={today} />
          </div>
          <div class="small muted" aria-live="polite">
            {daysAgo === 0 ? 'Começou hoje.' : `Começou há ${daysAgo} ${daysAgo === 1 ? 'dia' : 'dias'}.`}
            {daysAgo > 60 ? ' Faz bastante tempo: se você estiver grávida ou amamentando, dá para ativar o modo gestação depois do cadastro.' : ''}
          </div>
        </>
      )}

      {step === 1 && (
        <>
          <h1>Seu ritmo</h1>
          <p class="muted" style={{ margin: 0 }}>Não sabe? Deixe 28 e 5. O app aprende com seus registros.</p>
          <Stepper label="Duração do ciclo" hint="De uma menstruação à outra" value={cycleLength} min={15} max={90} onChange={setCycle} />
          <Stepper label="Duração da menstruação" hint="Dias de sangramento, em média" value={periodLength} min={1} max={15} onChange={setPeriod} />
          {periodLength > PROLONGED_AFTER_DAYS && <Sourced class="small muted" copy={copyOf('prolongedDeclared')} />}
          <div class="card">
            <label for="birth" style={{ fontWeight: 700 }}>Data de nascimento</label>
            <input id="birth" class="field" type="date" max={today} value={birthDate} onChange={(e) => setBirth(e.currentTarget.value)} />
            <div class="small muted">{birthDate ? `${ageOn(birthDate, today)} anos` : 'Usamos só para calcular sua idade.'}</div>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <h1>Você usa algum método contraceptivo?</h1>
          <p class="muted" style={{ margin: 0 }}>Assim não perguntamos de novo a cada registro.</p>
          <div class="methods">
            {Object.entries(METHODS).map(([id, m]) => (
              <button key={id} aria-pressed={id === method ? 'true' : 'false'} onClick={() => setMethod(id)}>{m.label}</button>
            ))}
          </div>
          {hormonal && <div class="pill-note" style={{ background: 'var(--indigo-tint)', color: 'var(--indigo-ink)' }}>Com esse método não mostramos janela fértil. O foco passa a ser sintomas, humor e sangramentos.</div>}
        </>
      )}

      {step === 3 && (
        <>
          <h1>Seus dados são seus</h1>
          <div class="card row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
            <Icon name="phone" />
            <div><strong>Ficam neste aparelho, cifrados</strong><div class="muted">Sem conta e sem nuvem. Instale o app na tela inicial para o navegador não apagar seus dados.</div></div>
          </div>
          <div class="card row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
            <Icon name="settings" />
            <div><strong>Sem nome, e-mail ou foto</strong><div class="muted">O app não pede nada que identifique você.</div></div>
          </div>
          <div class="card setting">
            <div><strong>Assistente de IA (em breve)</strong><div class="small muted">Opcional. Vai receber só datas e eventos. Dá para mudar depois.</div></div>
            <Switch on={aiEnabled} label="Ativar assistente de IA quando estiver disponível" onToggle={() => setAi(!aiEnabled)} />
          </div>
        </>
      )}

      <div style={{ marginTop: 'auto' }}>
        <button class="btn primary block" disabled={saving} onClick={step < 3 ? () => setStep(step + 1) : finish}>
          {step < 3 ? 'Continuar' : 'Começar'}
        </button>
      </div>
    </div>
  );
}
