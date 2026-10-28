import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { openRepository } from '../src/data/repository.js';
import { createStore } from '../src/app/store.js';
import { answer, suggestedQuestions, symptomQuestion } from '../src/app/assistant.js';
import { addDays } from '../src/domain/dates.js';

async function seeded(today = '2026-09-25') {
  const repo = await openRepository({ indexedDB: new IDBFactory() });
  const clock = { today };
  const store = createStore(repo, { today: () => clock.today });
  await store.completeOnboarding({ lastPeriodStart: '2026-04-01', periodLength: 5, cycleLength: 28, birthDate: '1996-05-12', method: 'condom', aiEnabled: false });
  let start = '2026-04-01';
  for (const len of [27, 28, 27, 28, 27, 28, 0]) {
    for (let d = 0; d < 5; d++) await store.tap(addDays(start, d), 'flow_medium');
    await store.tap(start, 'cramps');
    if (len) start = addDays(start, len);
  }
  await store.tap('2026-09-20', 'sex_vaginal');
  return { store, clock, lastStart: start };
}

test('perguntas sugeridas respondidas com os dados do aparelho', async () => {
  const { store } = await seeded();
  const m = store.getModel();
  assert.ok(suggestedQuestions(m).includes('Estou na janela fértil?'));
  assert.match(answer(m, 'Quando foi minha última menstruação?'), /começou em 13 de setembro \(há 12 dias\) e durou 5 dias/);
  assert.match(answer(m, 'Quando vem a próxima menstruação?'), /prevista entre/);
  assert.match(answer(m, 'Senti cólica em todos os ciclos?'), /em 6 de 6 ciclos com registro/);
  assert.match(answer(m, 'Quando foi minha última relação?'), /20 de setembro, há 5 dias/);
  assert.match(answer(m, 'Quantas vezes tomei a pílula do dia seguinte neste ano?'), /não registrou/);
  assert.match(answer(m, 'Estou na janela fértil?'), /não funciona como método contraceptivo/);
  assert.match(answer(m, 'qual a capital da frança?'), /só as perguntas sugeridas/);
});

test('pergunta vinda da ficha do sintoma', async () => {
  const { store } = await seeded();
  const m = store.getModel();
  assert.equal(symptomQuestion(m, 'headache'), 'Tive dor de cabeça em todos os ciclos?');
  assert.equal(symptomQuestion(m, 'mood_anxious'), 'Me senti ansiosa em todos os ciclos?');
});

test('gestação: guardrail de remédio e de sinal de alerta', async () => {
  const { store, clock, lastStart } = await seeded();
  clock.today = '2026-10-28';
  await store.savePregnancy({ method: 'lmp', lmp: lastStart });
  const m = store.getModel();
  assert.ok(suggestedQuestions(m).includes('Com quantas semanas estou?'));
  assert.match(answer(m, 'Posso tomar dipirona?'), /não indico nem avalio remédios/);
  assert.match(answer(m, 'Estou com sangramento'), /Procure atendimento hoje/);
  assert.match(answer(m, 'Com quantas semanas estou?'), /6 semanas e 3 dias/);
  assert.match(answer(m, 'Quando é a data provável do parto?'), /de 2027/);
});

test('menstruação atrasada: sem janela fértil do passado, e responde "estou grávida?"', async () => {
  const { store, clock } = await seeded();
  clock.today = '2026-10-20'; // janela prevista ~9–13/10 já passou
  store.refresh();
  const m = store.getModel();
  assert.equal(m.prediction.status, 'late');
  assert.match(answer(m, 'Estou na janela fértil?'), /atrasada não dá para estimar/);
  assert.match(answer(m, 'Quando vem a próxima menstruação?'), /já passou há/);
  assert.match(answer(m, 'Será que estou grávida?'), /teste de gravidez/);
});

test('janela fértil sugerida é sempre a próxima, nunca uma que já passou', async () => {
  const { store, clock } = await seeded();
  clock.today = '2026-09-30'; // dia 18: a janela deste ciclo acabou
  store.refresh();
  const a = answer(store.getModel(), 'Estou na janela fértil?');
  assert.match(a, /Hoje não\. A próxima janela fértil estimada vai de \d+ out/);
});

test('muito tempo sem menstruação: não arrisca previsão', async () => {
  const { store, clock } = await seeded();
  clock.today = '2027-01-05';
  store.refresh();
  assert.match(answer(store.getModel(), 'Quando vem a próxima menstruação?'), /não dá para prever a próxima/);
});
