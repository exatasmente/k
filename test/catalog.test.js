import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG, CATEGORIES, applyTap, getItem, isVisible } from '../src/domain/catalog.js';

const tap = (codes, code) => [...applyTap(codes, code)].sort();

test('códigos e categorias do catálogo são únicos e consistentes', () => {
  const codes = CATALOG.map((i) => i.code);
  assert.equal(new Set(codes).size, codes.length);
  const cats = new Set(CATEGORIES.map((c) => c.id));
  for (const item of CATALOG) assert.ok(cats.has(item.cat), `${item.code} sem categoria`);
});

test('toque liga e desliga o item', () => {
  assert.deepEqual(tap([], 'cramps'), ['cramps']);
  assert.deepEqual(tap(['cramps'], 'cramps'), []);
});

test('escolha única dentro do grupo', () => {
  assert.deepEqual(tap(['flow_light'], 'flow_heavy'), ['flow_heavy']);
  assert.deepEqual(tap(['protection_condom', 'sex_vaginal'], 'protection_none'), ['protection_none', 'sex_vaginal']);
});

test('negação exclui o resto da categoria e vice-versa, sem mexer nas outras', () => {
  assert.deepEqual(tap(['cramps', 'headache', 'mood_happy'], 'no_symptoms'), ['mood_happy', 'no_symptoms']);
  assert.deepEqual(tap(['no_symptoms', 'mood_happy'], 'headache'), ['headache', 'mood_happy']);
  assert.deepEqual(tap(['walk', 'yoga'], 'no_workout'), ['no_workout']);
});

test('visibilidade por estágio de vida e semana de gestação', () => {
  const cycle = { stage: 'cycle' };
  const early = { stage: 'pregnancy', gestationalWeek: 8 };
  const late = { stage: 'pregnancy', gestationalWeek: 30 };
  assert.ok(isVisible(getItem('cramps'), cycle));
  assert.ok(!isVisible(getItem('cramps'), early), 'cólica sai na gestação');
  assert.ok(!isVisible(getItem('emergency_contraception'), early), 'PDS sai na gestação');
  assert.ok(!isVisible(getItem('flow_heavy'), early), 'fluxo menstrual sai na gestação');
  assert.ok(isVisible(getItem('bleeding'), early), 'sangramento entra como alerta');
  assert.ok(!isVisible(getItem('bleeding'), cycle));
  assert.ok(!isVisible(getItem('baby_movement'), early), 'bebê só a partir de 16 semanas');
  assert.ok(isVisible(getItem('baby_movement'), late));
  assert.ok(!isVisible(getItem('less_movement'), { stage: 'pregnancy', gestationalWeek: 27 }));
  assert.ok(isVisible(getItem('less_movement'), late));
  assert.ok(isVisible(getItem('nausea'), early) && isVisible(getItem('nausea'), cycle), 'compartilhado aparece nos dois');
});
