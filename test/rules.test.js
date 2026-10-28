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

test('RN03: limiar exato de 8 dias', () => {
  assert.equal(classifyRegularity([24, 32, 28, 26]).kind, 'regular', 'variação de 8 dias ainda é regular');
  assert.equal(classifyRegularity([24, 33, 24, 33]).kind, 'irregular', 'variação de 9 dias, sem um único ciclo fora da curva');
});

test('RN03 volta a avaliar com 3 ciclos depois da gestação', () => {
  const stages = [{ stage: 'pregnancy', start: '2025-01-01', end: '2025-10-01' }, { stage: 'postpartum', start: '2025-10-02', end: '2026-02-01' }];
  const before = [{ start: '2024-10-01', length: 28 }];
  const after = (lengths) => lengths.map((length, i) => ({ start: `2026-0${i + 2}-10`, length }));
  assert.equal(irregularity({ cycles: [...before, ...after([30, 40])], stages }).kind, 'paused');
  assert.equal(irregularity({ cycles: [...before, ...after([20, 30, 40])], stages }).kind, 'irregular');
});

test('RN04: limites dos 12 meses (3 vezes não dispara, a 4ª sim; 12 meses atrás já não conta)', () => {
  const ctx = { today: '2026-10-28', periods: [{ start: '2026-01-01' }, { start: '2026-03-01' }, { start: '2026-06-01' }, { start: '2026-10-17' }] };
  assert.equal(emergencyContraceptionAlert(ctx, ['2026-01-10', '2026-04-02', '2026-10-28']).triggered, false);
  assert.equal(emergencyContraceptionAlert(ctx, ['2026-01-10', '2026-04-02', '2026-07-15', '2026-10-28']).triggered, true);
  assert.equal(emergencyContraceptionAlert(ctx, ['2025-10-28', '2026-04-02', '2026-07-15', '2026-10-28']).triggered, false, 'exatamente 12 meses atrás fica fora');
});
