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
  for (const field of ['name', 'email', 'phone', 'photo']) {
    assert.ok(validate.profile({ id: 'me', [field]: 'x', ...stamp }).some((m) => m.includes(field)), field);
  }
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
  // Ciclos de 30 e depois 26 dias: a ordem no tempo também não pode ficar no registro.
  const periods = [
    { start: '2026-08-20', end: '2026-08-24' }, { start: '2026-09-19', end: '2026-09-23' }, { start: '2026-10-15', end: '2026-10-19' },
  ];
  const onboarding = { lastPeriodStart: '2026-08-20', periodLength: 5, cycleLength: 28 };
  const ctx = buildCycleContext({ periods, onboarding, today: '2026-10-28' });
  const entries = [
    { date: '2026-10-15', code: 'cramps' }, { date: '2026-10-23', code: 'sex_vaginal' }, { date: '2026-10-23', code: 'protection_none' },
    { date: '2026-10-24', code: 'emergency_contraception' }, { date: '2026-10-25', code: 'preg_test_negative' },
    { date: '2026-10-27', code: 'mood_anxious' },
  ];
  const r = buildAnonymousRetention({ birthDate: '1996-05-12', ctx, entries, today: '2026-10-28' });
  assert.equal(r.ageYears, 30);
  assert.deepEqual(r.cycleLengths, [26, 30], 'ordenadas, não na sequência em que aconteceram');
  assert.deepEqual(Object.keys(r.symptomCountsByPhase).sort(), ['cramps', 'mood_anxious']);
  const text = JSON.stringify(r);
  assert.ok(!/\d{4}-\d{2}/.test(text), 'nenhuma data, nem parcial (ano-mês)');
  assert.ok(!/sex|protection|emergency|preg|1996/.test(text), 'nada de vida sexual, PDS, teste ou nascimento');
});

test('preferências de lembrete e plano validados', () => {
  const prefs = { enabled: true, details: false, daysBefore: 2 };
  assert.deepEqual(validate.profile({ id: 'me', reminders: prefs, ...stamp }), []);
  assert.ok(validate.profile({ id: 'me', reminders: { ...prefs, daysBefore: 30 }, ...stamp }).length > 0);
  const item = { key: 'period_soon|2026-10-17', kind: 'period_soon', date: '2026-11-10', title: 'Ciclo', body: 'Você tem um lembrete.' };
  assert.deepEqual(validate.reminders({ id: 'plan', items: [item], ...stamp }), []);
  assert.ok(validate.reminders({ id: 'plan', items: [{ ...item, kind: 'pilula' }], ...stamp }).length > 0);
  assert.ok(validate.reminders({ id: 'outro', items: [], ...stamp }).length > 0);
});
