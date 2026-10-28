import { test } from 'node:test';
import assert from 'node:assert/strict';
import { changeMethod, isUnprotected, methodOn, quickSexCodes } from '../src/domain/contraception.js';

test('trocar de método não reescreve o passado', () => {
  let periods = [{ method: 'condom', from: '2025-01-01', to: null }];
  periods = changeMethod(periods, 'hormonal_iud', '2026-06-01');
  assert.equal(methodOn(periods, '2026-05-31'), 'condom');
  assert.equal(methodOn(periods, '2026-06-01'), 'hormonal_iud');
  assert.equal(methodOn(periods, '2024-01-01'), 'none', 'antes do primeiro registro: nenhum');
});

test('registro de relação em 1 toque assume o método padrão (RN01)', () => {
  assert.deepEqual(quickSexCodes('condom'), ['sex_vaginal', 'protection_condom']);
  assert.deepEqual(quickSexCodes('pill'), ['sex_vaginal']);
});

test('desprotegida = vaginal, sem preservativo no ato e sem método de base', () => {
  assert.equal(isUnprotected(new Set(['sex_vaginal', 'protection_none']), 'hormonal_iud'), false, 'DIU protege');
  assert.equal(isUnprotected(new Set(['sex_vaginal', 'protection_none']), 'condom'), true);
  assert.equal(isUnprotected(new Set(['sex_vaginal']), 'condom'), false, 'sem marcação vale o padrão');
  assert.equal(isUnprotected(new Set(['sex_vaginal']), 'none'), true);
  assert.equal(isUnprotected(new Set(['sex_oral']), 'none'), false, 'oral não conta');
});
