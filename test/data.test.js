import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STORES, entryId, upgrade, validate } from '../src/data/schema.js';
import { buildCycleContext } from '../src/domain/cycles.js';
import { buildAnonymousRetention } from '../src/domain/privacy.js';

const stamp = { updatedAt: '2026-10-28T12:00:00Z', deletedAt: null };

test('todo store tem validador', () => {
  assert.deepEqual(Object.keys(validate).sort(), Object.keys(STORES).sort());
});

test('perfil não aceita dados de identificação direta', () => {
  assert.deepEqual(validate.profile({ id: 'me', birthDate: '1996-05-12', ...stamp }), []);
  assert.ok(validate.profile({ id: 'me', email: 'x@y.com', ...stamp }).some((m) => m.includes('email')));
});

test('registro do dia tem id determinístico e código do catálogo', () => {
  const ok = { id: entryId('2026-10-28', 'cramps'), date: '2026-10-28', code: 'cramps', source: 'user', ...stamp };
  assert.deepEqual(validate.entries(ok), []);
  assert.ok(validate.entries({ ...ok, id: 'outro' }).length > 0);
  assert.ok(validate.entries({ ...ok, code: 'inventado', id: entryId('2026-10-28', 'inventado') }).length > 0);
});

test('gestação não guarda desfecho', () => {
  const preg = { id: 'a', stage: 'pregnancy', start: '2026-09-02', end: null, dating: 'lmp', dueDate: '2027-06-09', ...stamp };
  assert.deepEqual(validate.stages(preg), []);
  assert.ok(validate.stages({ ...preg, outcome: 'qualquer' }).some((m) => m.includes('desfecho')));
});

test('resposta de ciclo só aceita sim ou não ("não lembro" não é gravado)', () => {
  const r = { id: '2026-10-17|cramps', cycleStart: '2026-10-17', code: 'cramps', answer: 'yes', ...stamp };
  assert.deepEqual(validate.cycleAnswers(r), []);
  assert.ok(validate.cycleAnswers({ ...r, answer: 'unknown' }).length > 0);
});

test('upgrade cria os stores só com id, sem índices', () => {
  const created = [];
  const db = { objectStoreNames: { contains: () => false }, createObjectStore: (name, opts) => created.push([name, opts]) };
  upgrade(db);
  assert.equal(created.length, Object.keys(STORES).length);
  assert.ok(created.every(([, opts]) => opts.keyPath === 'id'));
});

test('registro anônimo de retenção: sem datas, sem vida sexual, idade em anos', () => {
  const periods = [
    { start: '2026-08-23', end: '2026-08-27' }, { start: '2026-09-19', end: '2026-09-23' }, { start: '2026-10-17', end: '2026-10-21' },
  ];
  const onboarding = { lastPeriodStart: '2026-08-23', periodLength: 5, cycleLength: 28 };
  const ctx = buildCycleContext({ periods, onboarding, today: '2026-10-28' });
  const entries = [
    { date: '2026-10-17', code: 'cramps' }, { date: '2026-10-23', code: 'sex_vaginal' },
    { date: '2026-10-24', code: 'emergency_contraception' }, { date: '2026-10-27', code: 'mood_anxious' },
  ];
  const r = buildAnonymousRetention({ birthDate: '1996-05-12', ctx, entries, today: '2026-10-28' });
  assert.equal(r.ageYears, 30);
  assert.deepEqual(r.cycleLengths, [27, 28]);
  assert.deepEqual(Object.keys(r.symptomCountsByPhase).sort(), ['cramps', 'mood_anxious']);
  assert.ok(!/\d{4}-\d{2}-\d{2}/.test(JSON.stringify(r)), 'nenhuma data no registro');
});
