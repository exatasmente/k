import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyRegularity, lengthsForAverage } from '../src/domain/regularity.js';
import { emergencyContraceptionAlert, irregularity, pregnancyAlert } from '../src/domain/rules.js';

test('RN03: precisa de 3 ciclos', () => {
  assert.deepEqual(classifyRegularity([28, 29]).kind, 'insufficient');
  assert.equal(classifyRegularity([28, 29]).cyclesNeeded, 1);
});

test('RN03 em dois tons: regular, um ciclo fora do padrão, irregular', () => {
  assert.equal(classifyRegularity([27, 28, 26, 27, 28, 27]).kind, 'regular');
  const outlier = classifyRegularity([27, 27, 37, 26, 27, 28]);
  assert.equal(outlier.kind, 'outlier');
  assert.equal(outlier.last[outlier.outlierIndex], 37);
  assert.equal(outlier.restRange, 2);
  assert.equal(classifyRegularity([21, 35, 38, 27, 26, 28]).kind, 'irregular', 'o caso real de 2024');
  assert.deepEqual(lengthsForAverage([30, 27, 27, 37, 26, 27, 28]), [30, 27, 27, 26, 27, 28], 'só tira o fora do padrão da janela');
});

test('RN03 fica pausada na gestação, no pós-parto e até 3 ciclos depois', () => {
  const cycles = [
    { start: '2025-12-01', length: 35 }, { start: '2026-01-05', length: 21 },
    { start: '2026-01-26', length: 38 }, { start: '2026-03-05', length: 27 },
  ];
  assert.equal(irregularity({ cycles, stages: [] }).kind, 'irregular');
  assert.equal(irregularity({ cycles, stages: [{ stage: 'postpartum', start: '2026-04-01', end: null }] }).kind, 'paused');
  const after = [...cycles, { start: '2027-01-01', length: 40 }];
  assert.equal(irregularity({ cycles: after, stages: [{ stage: 'pregnancy', start: '2026-04-01', end: '2026-12-20' }] }).kind, 'paused');
});

test('RN04: PDS 2 vezes no mesmo ciclo ou mais de 3 em 12 meses', () => {
  const ctx = { today: '2026-10-28', periods: [{ start: '2026-09-19' }, { start: '2026-10-17' }] };
  assert.equal(emergencyContraceptionAlert(ctx, ['2026-10-24']).triggered, false);
  const sameCycle = emergencyContraceptionAlert(ctx, ['2026-10-24', '2026-10-28']);
  assert.deepEqual(sameCycle.reasons, ['same_cycle']);
  const year = emergencyContraceptionAlert(ctx, ['2026-01-10', '2026-04-02', '2026-07-15', '2026-10-28']);
  assert.deepEqual(year.reasons, ['twelve_months']);
  assert.equal(emergencyContraceptionAlert(ctx, ['2025-09-01', '2026-04-02', '2026-07-15', '2026-10-28']).triggered, false);
});

test('sinais de alerta só disparam na gestação', () => {
  assert.deepEqual(pregnancyAlert(['nausea', 'bleeding'], 'pregnancy').codes, ['bleeding']);
  assert.equal(pregnancyAlert(['nausea'], 'pregnancy').triggered, false);
  assert.equal(pregnancyAlert(['bleeding'], 'cycle').triggered, false);
});
