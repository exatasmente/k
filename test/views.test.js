import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { openRepository } from '../src/data/repository.js';
import { createStore } from '../src/app/store.js';
import { calendarView, logView, statsView, symptomView, todayView } from '../src/app/views.js';
import { COPY } from '../src/domain/rules.js';
import { answer, suggestedQuestions } from '../src/app/assistant.js';
import { addDays } from '../src/domain/dates.js';

/** Histórico: 6 ciclos de 27/28 dias com cólica nos dias 1-2 e um ciclo só com relação. */
async function seeded(today = '2026-09-25') {
  const repo = await openRepository({ indexedDB: new IDBFactory() });
  const clock = { today };
  const store = createStore(repo, { today: () => clock.today });
  const lengths = [27, 28, 27, 28, 27, 28];
  let start = '2026-04-01';
  await store.completeOnboarding({ lastPeriodStart: start, periodLength: 5, cycleLength: 28, birthDate: '1996-05-12', method: 'condom', aiEnabled: true });
  for (let i = 0; i <= lengths.length; i++) {
    for (let d = 0; d < 5; d++) await store.tap(addDays(start, d), 'flow_medium');
    if (i !== 2) { await store.tap(start, 'cramps'); await store.tap(addDays(start, 1), 'cramps'); }
    else await store.tap(addDays(start, 10), 'sex_vaginal');
    if (i < lengths.length) start = addDays(start, lengths[i]);
  }
  return { store, clock, lastStart: start };
}

test('Hoje: anel, janela e atalhos', async () => {
  const { store } = await seeded();
  const v = todayView(store.getModel());
  assert.equal(v.mode, 'cycle');
  assert.ok(v.ring);
  assert.match(v.ring.window, /^Previsão: entre /);
  assert.equal(v.quick.showPeriod, true);
  assert.equal(v.redFlag, null);
});

test('Ficha: ciclo só com relação fica fora da conta de sintomas', async () => {
  const { store } = await seeded();
  const v = symptomView(store.getModel(), 'cramps');
  assert.equal(v.coverage.observed, 5);
  assert.equal(v.coverage.present, 5);
  assert.match(v.coverageText, /1 ciclo sem registro de sintomas não entra na conta/);
  assert.match(v.insight, /na menstruação \(dias 1–2 do ciclo\)/);
  assert.equal(v.rows[0].label.startsWith('Ciclo atual'), true);
});

test('Registro: sugestões pela fase e catálogo do estágio', async () => {
  const { store, lastStart } = await seeded();
  const m = store.getModel();
  const v = logView(m, lastStart);
  assert.equal(v.suggest.label, 'Menstruação');
  assert.equal(v.suggest.items[0].code, 'cramps', 'o que ela mais registra nesta fase vem primeiro');
  assert.ok(v.sections.some((s) => s.id === 'flow'));
  assert.ok(!v.sections.some((s) => s.id === 'alert'));
});

test('Calendário e Resumo', async () => {
  const { store, lastStart } = await seeded();
  const m = store.getModel();
  const cal = calendarView(m, lastStart.slice(0, 7), lastStart);
  assert.ok(cal.cells.find((c) => c.date === lastStart).actual);
  assert.match(cal.selected.phase, /Menstruação/);
  const s = statsView(m);
  assert.equal(s.mode, 'cycle');
  assert.equal(s.regularity.title, 'Regular');
  assert.equal(s.bars.length, 6);
});

test('Gestação: Home, registro com alerta, calendário e resumo', async () => {
  const { store, clock, lastStart } = await seeded();
  clock.today = '2026-10-28';
  await store.savePregnancy({ method: 'lmp', lmp: lastStart });
  await store.tap('2026-10-28', 'bleeding');
  const m = store.getModel();
  const t = todayView(m);
  assert.equal(t.mode, 'pregnancy');
  assert.equal(t.pregnancy.short, '6s 3d');
  assert.match(t.redFlag.marked, /sangramento pela vagina/);
  assert.match(t.redFlag.text, /Busque atendimento imediatamente/);
  assert.ok(t.redFlag.sources.some((s) => s.id === 'ms_caderneta_2026'), 'o alerta cita a Caderneta da Gestante');
  assert.equal(t.quick.showSex, false);
  const log = logView(m, '2026-10-28');
  assert.ok(log.sections.some((s) => s.id === 'alert'));
  assert.ok(!log.sections.some((s) => s.id === 'flow'));
  assert.equal(log.suggest.label, '1º trimestre');
  assert.match(calendarView(m, '2026-10', '2026-10-28').selected.phase, /^6s 3d · 1º trimestre/);
  assert.equal(statsView(m).flags.length, 1);
});

test('Ficha: depois de trocar para método hormonal, as fases antigas continuam na conta', async () => {
  const { store } = await seeded();
  await store.setMethod('pill');
  const v = symptomView(store.getModel(), 'cramps');
  const keys = v.phases.map((p) => p.key);
  assert.ok(keys.includes('not_tracked'));
  assert.ok(keys.includes('menstrual'));
  const sum = v.phases.reduce((s, p) => s + p.pct, 0);
  assert.ok(sum >= 98 && sum <= 102, `as porcentagens fecham ~100% (${sum})`);
});

test('Registro: esconder Sintomas esconde também o "Sem sintomas hoje"', async () => {
  const { store, lastStart } = await seeded();
  assert.equal(logView(store.getModel(), lastStart).calmVisible, true);
  await store.toggleCategory('symptom');
  const v = logView(store.getModel(), lastStart);
  assert.equal(v.calmVisible, false);
  assert.ok(!v.sections.some((s) => s.id === 'symptom'));
});

test('Hoje: muito tempo sem menstruação muda o anel e só alerta quem ovula', async () => {
  const { store, clock } = await seeded();
  clock.today = '2027-01-05'; // 3+ meses depois do último início (2026-09-13)
  store.refresh();
  const v = todayView(store.getModel());
  assert.equal(v.ring.status, 'absence');
  assert.equal(v.ring.big, 'Sem menstruação');
  assert.equal(v.ring.window, null);
  assert.equal(v.ring.absenceNote.text, COPY.longAbsence);
  await store.setMethod('implant');
  assert.equal(todayView(store.getModel()).ring.absenceNote, null, 'implante pode suspender a menstruação de propósito');
});

test('método que suprime a ovulação: sem janela fértil no calendário, no Hoje nem na assistente', async () => {
  const { store } = await seeded();
  const fertileDays = (m) => ['2026-09', '2026-10', '2026-11'].flatMap((mo) => calendarView(m, mo, `${mo}-01`).cells.filter((c) => c.fertile || c.ovulation));
  assert.ok(fertileDays(store.getModel()).length > 0, 'com preservativo a janela aparece');
  await store.setMethod('continuous_pill');
  const m = store.getModel();
  assert.deepEqual(fertileDays(m), []);
  assert.equal(todayView(m).ring.fertile, null);
  assert.ok(!suggestedQuestions(m).includes('Estou na janela fértil?'));
  assert.match(answer(m, 'Estou na janela fértil?'), /pílula combinada contínua.*não mostra janela fértil/);
});
