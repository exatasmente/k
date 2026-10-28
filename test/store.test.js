import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { openRepository } from '../src/data/repository.js';
import { createStore } from '../src/app/store.js';

async function setup(today = '2026-10-28') {
  const indexedDB = new IDBFactory();
  const repo = await openRepository({ indexedDB });
  const clock = { today };
  const store = createStore(repo, { today: () => clock.today });
  await store.completeOnboarding({
    lastPeriodStart: '2026-10-17', periodLength: 5, cycleLength: 28, birthDate: '1996-05-12', method: 'condom', aiEnabled: true,
  });
  return { store, repo, indexedDB, clock };
}

test('onboarding já dá previsão', async () => {
  const { store } = await setup();
  const m = store.getModel();
  assert.ok(m.onboarded);
  assert.equal(m.prediction.status, 'before');
  assert.equal(m.method, 'condom');
});

test('marcar fluxo abre a menstruação; "Terminou" fecha e pergunta pela cólica', async () => {
  const { store, clock } = await setup('2026-11-14');
  await store.startPeriod();
  assert.equal(store.getModel().openPeriod.start, '2026-11-14');
  clock.today = '2026-11-18';
  const ask = await store.endPeriod();
  assert.equal(ask, '2026-11-14', 'nada de sintoma registrado: pergunta');
  await store.answerCycle(ask, 'cramps', 'yes');
  assert.equal(store.getModel().answers['2026-11-14'].cramps, 'yes');
  await store.answerCycle(ask, 'headache', 'unknown');
  assert.equal(store.getModel().answers['2026-11-14'].headache, undefined, '"não lembro" não é gravado');
});

test('relação em 1 toque usa o método padrão e desfaz no segundo toque', async () => {
  const { store } = await setup();
  await store.quickSex();
  assert.deepEqual([...store.getModel().codesOn('2026-10-28')].sort(), ['protection_condom', 'sex_vaginal']);
  await store.quickSex();
  assert.equal(store.getModel().codesOn('2026-10-28').size, 0);
});

test('negação e escolha única chegam gravadas', async () => {
  const { store } = await setup();
  await store.tap('2026-10-28', 'cramps');
  await store.tap('2026-10-28', 'no_symptoms');
  assert.deepEqual([...store.getModel().codesOn('2026-10-28')], ['no_symptoms']);
});

test('trocar método fecha o anterior sem reescrever o passado', async () => {
  const { store } = await setup();
  await store.setMethod('continuous_pill');
  const m = store.getModel();
  assert.equal(m.method, 'continuous_pill');
  assert.equal(m.methods.length, 2);
  assert.equal(m.prediction.upcoming[0].fertileWindow, null, 'sem janela fértil');
});

test('gestação: ativa pela ultrassonografia, encerra para o pós-parto sem guardar motivo', async () => {
  const { store, repo } = await setup();
  await store.savePregnancy({ method: 'ultrasound', dueDate: '2027-06-01' });
  let m = store.getModel();
  assert.equal(m.stage, 'pregnancy');
  assert.equal(m.ga.label, '9s 1d');
  assert.equal(m.prediction.mode, 'pregnancy');
  await store.setConsult('2026-11-05');
  assert.equal(store.getModel().consult, '2026-11-05');

  await store.endPregnancy('postpartum');
  m = store.getModel();
  assert.equal(m.stage, 'cycle');
  assert.ok(m.postpartum);
  assert.equal(m.consult, '');
  assert.ok(repo.all('stages').every((s) => !('outcome' in s)));

  await store.startPeriod();
  assert.equal(store.getModel().postpartum, null, 'menstruação voltou: fim do pós-parto');
});

test('apagar tudo devolve só o registro anônimo e zera o banco', async () => {
  const { store, indexedDB } = await setup();
  await store.tap('2026-10-20', 'cramps');
  const retention = await store.deleteAll();
  assert.equal(retention.ageYears, 30);
  assert.ok(!/\d{4}-\d{2}-\d{2}/.test(JSON.stringify(retention)));
  const fresh = await openRepository({ indexedDB });
  assert.equal(fresh.get('profile', 'me'), undefined);
});
