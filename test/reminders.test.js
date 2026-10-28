import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { openRepository } from '../src/data/repository.js';
import { createStore } from '../src/app/store.js';
import { buildICS, calendarPredictions, dueReminders, planReminders, STALE_DAYS } from '../src/app/reminders.js';
import { todayView } from '../src/app/views.js';
import { addDays } from '../src/domain/dates.js';

// Última menstruação 17/10, ciclo de 28: janela prevista 12–16/11.
async function setup(today = '2026-10-28', { lastPeriodStart = '2026-10-17' } = {}) {
  const repo = await openRepository({ indexedDB: new IDBFactory() });
  const clock = { today };
  const store = createStore(repo, { today: () => clock.today });
  await store.completeOnboarding({ lastPeriodStart, periodLength: 5, cycleLength: 28, birthDate: '1996-05-12', method: 'condom', aiEnabled: false });
  return { store, repo, clock };
}

const byKind = (items, kind) => items.find((i) => i.kind === kind);
const shown = (repo) => repo.all('dismissals').filter((d) => d.rule === 'notified').map((d) => d.context);

/** Menstruações de 5 dias começando nos dias dados (cada uma vira um ciclo). */
async function periodsAt(store, clock, starts) {
  for (const s of starts) {
    clock.today = s;
    for (let d = 0; d < 5; d++) await store.tap(addDays(s, d), 'flow_medium');
  }
}

test('desligado por padrão: nenhum plano gravado', async () => {
  const { store, repo } = await setup();
  assert.deepEqual(planReminders(store.getModel()), []);
  assert.equal(repo.get('reminders', 'plan'), undefined);
});

test('menstruação chegando: N dias antes da janela, texto discreto por padrão', async () => {
  const { store, repo } = await setup();
  await store.setReminders({ enabled: true });
  const soon = byKind(repo.get('reminders', 'plan').items, 'period_soon');
  assert.equal(soon.date, '2026-11-10', 'janela começa 12/11, 2 dias antes');
  assert.equal(soon.key, 'period_soon|2026-10-17', 'um aviso por ciclo, mesmo que a previsão mude');
  assert.deepEqual([soon.title, soon.body], ['Ciclo', 'Você tem um lembrete. Toque para abrir.'], 'nada de saúde na tela de bloqueio');

  await store.setReminders({ details: true, daysBefore: 4 });
  const detailed = byKind(repo.get('reminders', 'plan').items, 'period_soon');
  assert.equal(detailed.date, '2026-11-08');
  assert.equal(detailed.title, 'Menstruação chegando');
  assert.match(detailed.body, /a partir de 12 nov/);
});

test('com o app aberto no dia do aviso, ele conta como visto (sem notificação repetida)', async () => {
  const { store, repo, clock } = await setup();
  await store.setReminders({ enabled: true });
  assert.deepEqual(shown(repo), []);
  clock.today = '2026-11-10';
  await store.syncReminders();
  assert.deepEqual(shown(repo), ['period_soon|2026-10-17']);
});

test('menstruação começou: some o "chegando" e o fim a confirmar vence no 10º dia (RF01.4)', async () => {
  const { store, repo, clock } = await setup('2026-11-12');
  await store.setReminders({ enabled: true });
  await store.startPeriod();
  const items = repo.get('reminders', 'plan').items;
  assert.equal(byKind(items, 'period_soon'), undefined);
  assert.equal(byKind(items, 'confirm_end').date, '2026-11-22');
  clock.today = '2026-11-25';
  await store.syncReminders();
  assert.ok(shown(repo).includes('confirm_end|2026-11-12'), 'pendente no app aberto: card na tela, conta como visto');
});

test('ciclos irregulares (RN03): aviso no app e lembrete, até ela tocar em "Ok"', async () => {
  const { store, repo, clock } = await setup('2026-03-01', { lastPeriodStart: '2026-03-01' });
  await periodsAt(store, clock, ['2026-03-23', '2026-04-29', '2026-05-23', '2026-06-30', '2026-07-24']);
  clock.today = '2026-08-01';
  await store.setReminders({ enabled: true });
  const m = store.getModel();
  const card = todayView(m).irregular;
  assert.ok(card, 'ciclos de 22, 37, 24, 38 e 24 dias');
  assert.equal(byKind(repo.get('reminders', 'plan').items, 'irregular').key, `irregular|${card.context}`);
  await store.dismiss('irregular', card.context);
  assert.equal(todayView(store.getModel()).irregular, undefined);
  assert.equal(byKind(repo.get('reminders', 'plan').items, 'irregular'), undefined);
});

test('gestação: só a véspera da consulta; nada de previsão de menstruação', async () => {
  const { store, repo } = await setup();
  await store.setReminders({ enabled: true, details: true });
  await store.savePregnancy({ method: 'lmp', lmp: '2026-10-17' });
  await store.setConsult('2026-11-20');
  const items = repo.get('reminders', 'plan').items;
  assert.deepEqual(items.map((i) => i.kind), ['prenatal']);
  assert.equal(items[0].date, '2026-11-19');
  assert.equal(calendarPredictions(store.getModel()).length, 0);
});

test('depois de apagar tudo, voltar ao app não tenta gravar no banco apagado', async () => {
  const { store, repo, clock } = await setup();
  await store.setReminders({ enabled: true });
  await store.deleteAll();
  clock.today = '2026-11-10'; // aviso venceria hoje
  await store.syncReminders(); // visibilitychange com a tela "Dados apagados" aberta
  await store.tap('2026-11-10', 'cramps');
  assert.equal(repo.all('dismissals').length, 0);
  assert.equal(repo.all('entries').length, 0);
});

test('só mostra o que venceu, não é velho demais e ainda não foi mostrado', () => {
  const item = (key, date) => ({ key, kind: 'period_soon', date, title: 'Ciclo', body: '' });
  const items = [item('a', '2026-11-10'), item('b', '2026-11-11'), item('c', addDays('2026-11-10', -STALE_DAYS - 1)), item('d', '2026-11-09')];
  assert.deepEqual(dueReminders(items, new Set(['d']), '2026-11-10').map((i) => i.key), ['a']);
});

test('agenda (.ics): próximas menstruações, dia inteiro, alarme, título discreto e sem janela fértil', async () => {
  const { store } = await setup();
  const ics = buildICS(store.getModel(), { stamp: '2026-10-28T13:00:00.000Z' });
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n') && ics.endsWith('END:VCALENDAR\r\n'));
  assert.equal(ics.match(/BEGIN:VEVENT/g).length, 6);
  assert.match(ics, /DTSTART;VALUE=DATE:20261114\r\nDTEND;VALUE=DATE:20261119\r\n/, '14 a 18/11; DTEND é exclusivo');
  assert.match(ics, /TRIGGER;RELATED=START:-P1DT15H/, '9h de 2 dias antes');
  assert.match(ics, /DTSTAMP:20261028T130000Z/);
  assert.ok(!/Menstrua|f[ée]rtil|ovula/i.test(ics), 'título discreto por padrão');
  assert.match(buildICS(store.getModel(), { details: true, daysBefore: 1 }), /SUMMARY:Menstruação prevista[\s\S]*TRIGGER;RELATED=START:-PT15H/);
});

test('agenda: com a menstruação atrasada não exporta datas que mudam todo dia', async () => {
  const { store, clock } = await setup();
  clock.today = '2026-11-25';
  await store.syncReminders();
  assert.equal(store.getModel().prediction.status, 'late');
  assert.equal(calendarPredictions(store.getModel()).length, 0);
  assert.equal((buildICS(store.getModel()).match(/BEGIN:VEVENT/g) ?? []).length, 0);
});
