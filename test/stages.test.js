import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activePregnancy, datePregnancy, endPostpartum, endPregnancy, gestationalAge } from '../src/domain/stages.js';

test('idade gestacional em semanas + dias e trimestre', () => {
  assert.deepEqual(gestationalAge('2026-09-02', '2026-10-28'), { days: 56, weeks: 8, extraDays: 0, trimester: 1, label: '8s 0d' });
  assert.equal(gestationalAge('2026-01-01', '2026-05-01').trimester, 2);
  assert.equal(gestationalAge('2026-01-01', '2026-08-01').trimester, 3);
});

test('datação pela DUM avisa quando dá menos de 4 semanas', () => {
  const r = datePregnancy({ method: 'lmp', lmp: '2026-10-17' }, '2026-10-28');
  assert.equal(r.valid, true);
  assert.equal(r.ga.label, '1s 4d');
  assert.equal(r.earlyWarning, true);
  assert.equal(r.stage.dueDate, '2027-07-24');
  assert.equal(datePregnancy({ method: 'lmp', lmp: '2026-09-02' }, '2026-10-28').earlyWarning, false);
});

test('datação pela DPP da ultrassonografia', () => {
  const r = datePregnancy({ method: 'ultrasound', dueDate: '2027-06-01' }, '2026-10-28');
  assert.equal(r.stage.start, '2026-08-25');
  assert.equal(r.stage.dating, 'ultrasound');
  assert.equal(r.ga.label, '9s 1d');
  assert.equal(r.earlyWarning, false, 'aviso só vale para a DUM');
  assert.equal(datePregnancy({ method: 'lmp', lmp: '2026-11-10' }, '2026-10-28').valid, false);
});

test('encerrar guarda só a data, sem desfecho, e segue para pós-parto ou ciclo', () => {
  const stages = [{ stage: 'pregnancy', start: '2026-02-01', end: null, dating: 'lmp', dueDate: '2026-11-08' }];
  const pp = endPregnancy(stages, '2026-10-28', 'postpartum');
  assert.equal(pp[0].end, '2026-10-27', 'gestação termina na véspera; hoje já é pós-parto');
  assert.ok(!('outcome' in pp[0]));
  assert.deepEqual(pp[1], { stage: 'postpartum', start: '2026-10-28', end: null });
  assert.equal(activePregnancy(pp), null);
  assert.equal(endPregnancy(stages, '2026-10-28', 'cycle').length, 1);
  assert.equal(endPostpartum(pp, '2027-01-15')[1].end, '2027-01-14');
  assert.equal(endPostpartum(pp, '2026-10-28').length, 1, 'menstruação no mesmo dia: pós-parto não chega a existir');
});
