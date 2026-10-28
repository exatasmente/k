import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { openRepository } from '../src/data/repository.js';
import { createStore } from '../src/app/store.js';
import { todayView } from '../src/app/views.js';
import { COPY, COPY_SOURCES, irregularity } from '../src/domain/rules.js';
import { SOURCES } from '../src/domain/sources.js';
import { classifyRegularity, normalRangeForAge } from '../src/domain/regularity.js';
import { METHODS, tracksOvulation } from '../src/domain/contraception.js';
import { datePregnancy } from '../src/domain/stages.js';
import { addDays } from '../src/domain/dates.js';

// Alertas e orientações de saúde: cada um com fonte, e os números das fontes aplicados.
// Ver docs/fontes-clinicas.md.

async function setup(today, { lastPeriodStart = '2026-10-17', method = 'condom', birthDate = '1996-05-12' } = {}) {
  const repo = await openRepository({ indexedDB: new IDBFactory() });
  const clock = { today };
  const store = createStore(repo, { today: () => clock.today });
  await store.completeOnboarding({ lastPeriodStart, periodLength: 5, cycleLength: 28, birthDate, method, aiEnabled: false });
  return { store, clock };
}

test('todo texto de saúde tem fonte, e toda fonte existe com título e link', () => {
  for (const key of Object.keys(COPY)) {
    if (key === 'periodConfirmationNotification') continue; // texto de tela de bloqueio, sem conteúdo de saúde
    assert.ok(COPY_SOURCES[key]?.length, `${key} sem fonte`);
    for (const id of COPY_SOURCES[key]) {
      assert.ok(SOURCES[id], `${key}: fonte desconhecida ${id}`);
      assert.match(SOURCES[id].url, /^https:\/\//);
      assert.ok(SOURCES[id].short && SOURCES[id].title);
    }
  }
  assert.ok(!/alta carga hormonal/.test(COPY.emergencyContraception), 'sem termo que a OMS não sustenta');
  assert.ok(!/viagem/.test(COPY.lateCauses), 'viagem atrasar o ciclo não tem fonte');
});

test('RN03 pela FIGO 2018: variação normal depende da idade', () => {
  assert.equal(normalRangeForAge(22), 9);
  assert.equal(normalRangeForAge(30), 7);
  assert.equal(normalRangeForAge(44), 9);
  assert.equal(normalRangeForAge(null), 8);
  const lengths = [24, 32, 24, 32]; // varia 8 dias, sem um único ciclo fora da curva
  assert.equal(classifyRegularity(lengths, normalRangeForAge(22)).kind, 'regular', 'aos 22 anos, até 9 é normal');
  assert.equal(classifyRegularity(lengths, normalRangeForAge(30)).kind, 'irregular', 'aos 30, mais de 7 já é irregular');
  const ctx = { cycles: lengths.map((length, i) => ({ start: `2026-0${i + 1}-01`, length })), stages: [] };
  assert.equal(irregularity(ctx, { age: 30, method: 'hormonal_iud' }).kind, 'method', 'com DIU hormonal o sangramento é do método');
});

test('métodos: quem não ovula ou pode não ovular fica sem janela fértil (OMS, FSRH)', () => {
  for (const m of ['pill', 'continuous_pill', 'desogestrel', 'implant', 'injection', 'ring_or_patch']) assert.equal(METHODS[m].ovulation, 'suppressed', m);
  for (const m of ['hormonal_iud', 'minipill']) assert.equal(METHODS[m].ovulation, 'uncertain', m);
  for (const m of ['none', 'condom', 'copper_iud', 'other']) assert.equal(tracksOvulation(m), true, m);
  assert.equal(tracksOvulation('hormonal_iud'), false);
});

test('Hoje: DIU de cobre mostra a janela com aviso de proteção; DIU hormonal explica por que não mostra', async () => {
  const copper = await setup('2026-10-28', { method: 'copper_iud' });
  const c = todayView(copper.store.getModel()).ring;
  assert.equal(c.fertileNote.text, COPY.iudProtects);
  assert.ok(c.fertile);
  const hormonal = await setup('2026-10-28', { method: 'hormonal_iud' });
  const h = todayView(hormonal.store.getModel()).ring;
  assert.equal(h.fertile, null);
  assert.equal(h.hormonalNote.text, COPY.ovulationUncertain);
  assert.ok(h.hormonalNote.sources.some((s) => s.id === 'fsrh_iuc_2023'));
});

test('menstruação com mais de 8 dias (FIGO 2018): aviso no 9º dia, e depois se ela confirmar um fim longo', async () => {
  const { store, clock } = await setup('2026-11-14');
  await store.startPeriod();
  clock.today = '2026-11-21'; // 8º dia
  await store.syncReminders();
  assert.equal(todayView(store.getModel()).prolonged, undefined);
  clock.today = '2026-11-22'; // 9º dia
  await store.syncReminders();
  const v = todayView(store.getModel());
  assert.equal(v.prolonged.text, COPY.prolonged);
  assert.ok(v.prolonged.sources.some((s) => s.id === 'figo_2018'));
  await store.dismiss('prolonged', v.prolonged.context);
  assert.equal(todayView(store.getModel()).prolonged, undefined, '"Ok" esconde neste ciclo');

  // Passou de 10 dias sem "Terminou": fecha pela média e pede o último dia (RF01.4).
  const other = await setup('2026-11-14');
  await other.store.startPeriod();
  other.clock.today = '2026-11-26';
  await other.store.syncReminders();
  const pending = todayView(other.store.getModel()).pendingPeriod;
  await other.store.confirmPeriodEnd(pending.id, '2026-11-25'); // 12 dias
  assert.equal(todayView(other.store.getModel()).prolonged.text, COPY.prolongedPast);
});

test('escape fora da menstruação pede avaliação; com método hormonal, só depois da relação', async () => {
  const { store, clock } = await setup('2026-11-01');
  await store.tap('2026-11-01', 'spotting'); // dia 16 do ciclo
  let v = todayView(store.getModel());
  assert.equal(v.intermenstrual.title, 'Sangramento fora da menstruação');
  assert.ok(v.intermenstrual.sources.some((s) => s.id === 'ms_mulheres_2016'));
  await store.tap('2026-10-19', 'spotting'); // dentro da menstruação: não conta
  clock.today = '2026-10-19';
  await store.syncReminders();
  assert.equal(todayView(store.getModel()).intermenstrual, undefined);

  const pill = await setup('2026-11-01', { method: 'pill' });
  await pill.store.tap('2026-11-01', 'spotting');
  assert.equal(todayView(pill.store.getModel()).intermenstrual, undefined, 'escape é comum com a pílula (MS 2016)');
  await pill.store.quickSex();
  v = todayView(pill.store.getModel());
  assert.equal(v.intermenstrual.title, 'Sangramento depois da relação');
});

test('gestação: 41 semanas pede avaliação; aviso de teste cedo usa o ciclo dela', async () => {
  const { store, clock } = await setup('2026-10-28');
  await store.savePregnancy({ method: 'lmp', lmp: '2026-01-10' });
  clock.today = addDays('2026-01-10', 41 * 7);
  await store.syncReminders();
  assert.equal(todayView(store.getModel()).pregnancy.postTerm.text, COPY.postTerm);
  assert.equal(datePregnancy({ method: 'lmp', lmp: '2026-10-01', cycleLength: 28 }, '2026-10-28').earlyWarning, true);
  assert.equal(datePregnancy({ method: 'lmp', lmp: '2026-09-25', cycleLength: 28 }, '2026-10-28').earlyWarning, false);
  assert.equal(datePregnancy({ method: 'lmp', lmp: '2026-09-25', cycleLength: 40 }, '2026-10-28').earlyWarning, true, 'ciclo de 40 dias: ovula mais tarde');
});

test('pós-parto: sinais de alerta da Caderneta e "Menstruei" nas 6 primeiras semanas pergunta se não é lóquio', async () => {
  const { store, clock } = await setup('2026-10-28');
  await store.savePregnancy({ method: 'ultrasound', dueDate: '2026-11-05' });
  await store.endPregnancy('postpartum');
  let pp = todayView(store.getModel()).postpartum;
  assert.equal(pp.lochiaPossible, true);
  assert.match(pp.warning.text, /encharca o absorvente/);
  assert.ok(pp.warning.sources.some((s) => s.id === 'ms_caderneta_2026'));
  clock.today = addDays('2026-10-28', 42);
  await store.syncReminders();
  pp = todayView(store.getModel()).postpartum;
  assert.equal(pp.lochiaPossible, false);
});
