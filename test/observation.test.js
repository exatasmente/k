import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cycleCoverage, cycleObservation, dayObservation, shouldAskAtPeriodEnd } from '../src/domain/observation.js';

test('três estados por dia e por categoria', () => {
  assert.equal(dayObservation(['cramps'], 'cramps'), 'present');
  assert.equal(dayObservation(['no_symptoms'], 'cramps'), 'absent', 'negativa explícita');
  assert.equal(dayObservation(['headache'], 'cramps'), 'absent', 'abriu a categoria e escolheu outro');
  assert.equal(dayObservation(['mood_happy', 'sex_vaginal'], 'cramps'), 'unknown', 'outras categorias não contam');
  assert.equal(dayObservation([], 'cramps'), 'unknown');
});

test('ciclo só com relação registrada fica fora da conta de sintomas', () => {
  const log = { '2026-09-25': ['sex_vaginal', 'protection_condom'] };
  const codesOn = (d) => log[d] ?? [];
  const obs = cycleObservation({ start: '2026-09-19', end: '2026-10-16' }, 'cramps', codesOn);
  assert.deepEqual(obs, { observed: false, present: false, days: [], confirmedOnly: false });
});

test('resposta do fim da menstruação vale para o ciclo todo', () => {
  const codesOn = () => [];
  const cycle = { start: '2026-09-19', end: '2026-10-16' };
  assert.deepEqual(cycleObservation(cycle, 'cramps', codesOn, 'yes'), { observed: true, present: true, days: [], confirmedOnly: true });
  assert.equal(cycleObservation(cycle, 'cramps', codesOn, 'no').present, false);
  assert.equal(cycleObservation(cycle, 'cramps', codesOn, 'no').observed, true);
});

test('"X de Y ciclos" ignora ciclos sem observação', () => {
  const cov = cycleCoverage([
    { observed: true, present: true }, { observed: true, present: false },
    { observed: false, present: false }, { observed: true, present: true },
  ]);
  assert.deepEqual(cov, { present: 2, observed: 3, skipped: 1 });
});

test('pergunta no fim da menstruação só quando nada foi registrado e ainda não há resposta', () => {
  const period = { start: '2026-10-17', end: '2026-10-21' };
  assert.equal(shouldAskAtPeriodEnd(period, 'cramps', () => ['flow_medium']), true);
  assert.equal(shouldAskAtPeriodEnd(period, 'cramps', (d) => (d === '2026-10-18' ? ['headache'] : [])), false);
  assert.equal(shouldAskAtPeriodEnd(period, 'cramps', () => [], 'no'), false);
});
