import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays } from '../src/domain/dates.js';
import {
  buildCycleContext, endPeriod, LONG_ABSENCE_DAYS, periodFromOnboarding, phaseOn, predict, registerFlowDay, startPeriodOn, unregisterFlowDay,
} from '../src/domain/cycles.js';

const onboarding = { lastPeriodStart: '2026-10-17', periodLength: 5, cycleLength: 28, birthDate: '1996-05-12' };

/** Menstruações de 5 dias começando nas datas dadas. */
const periodsAt = (...starts) => starts.map((start) => ({ start, end: addDays(start, 4), source: 'user' }));

/** Inícios encadeados a partir de `first` com as durações dadas. */
function startsFrom(first, lengths) {
  const out = [first];
  for (const l of lengths) out.push(addDays(out[out.length - 1], l));
  return out;
}

test('onboarding valida faixas e já gera previsão sem histórico', () => {
  assert.throws(() => periodFromOnboarding({ ...onboarding, cycleLength: 10 }), RangeError);
  const ctx = buildCycleContext({ periods: [periodFromOnboarding(onboarding)], onboarding, today: '2026-10-28' });
  assert.equal(ctx.avgCycleLength, 28);
  const p = predict(ctx);
  assert.equal(p.mode, 'cycle');
  assert.equal(p.status, 'before');
  assert.deepEqual(p.window, { from: '2026-11-11', to: '2026-11-17' }, 'sem histórico: média ± 3 (variação típica de ~2,6 dias, Bull 2019)');
});

test('registrar fluxo estende a menstruação vizinha ou abre uma nova', () => {
  let periods = periodsAt('2026-10-01');
  periods = registerFlowDay(periods, '2026-10-07', '2026-10-28');
  assert.equal(periods[0].end, '2026-10-07', 'até 2 dias de intervalo ainda é a mesma');
  periods = registerFlowDay(periods, '2026-10-28', '2026-10-28');
  assert.equal(periods.length, 2);
  assert.equal(periods[1].end, null, 'hoje abre em aberto');
  periods = unregisterFlowDay(periods, '2026-10-28');
  assert.equal(periods.length, 1);
  assert.equal(endPeriod(registerFlowDay(periods, '2026-10-28', '2026-10-28'), '2026-10-30')[1].end, '2026-10-30');
});

test('RF01.4: menstruação aberta há 10+ dias fecha pela média e pede confirmação', () => {
  const ctx = buildCycleContext({ periods: [{ start: '2026-10-10', end: null, source: 'user' }], onboarding, today: '2026-10-20' });
  assert.equal(ctx.pendingConfirmation.length, 1);
  assert.equal(ctx.periods[0].end, '2026-10-14');
});

test('ciclo fora do padrão não puxa a média', () => {
  const starts = startsFrom('2026-04-01', [27, 28, 37, 26, 27, 28]);
  const ctx = buildCycleContext({ periods: periodsAt(...starts), onboarding, today: addDays(starts.at(-1), 3) });
  assert.equal(ctx.avgCycleLength, 27, 'sem o 37 a média é 27, com ele seria 29');
});

test('previsão é janela: antes, pode começar, atrasada', () => {
  const starts = startsFrom('2026-05-01', [26, 28, 27, 26, 28, 27]);
  const last = starts.at(-1);
  const at = (offset) => {
    const ctx = buildCycleContext({ periods: periodsAt(...starts), onboarding, today: addDays(last, offset) });
    return { p: predict(ctx), phase: phaseOn(ctx, addDays(last, offset)).phase };
  };
  const before = at(12);
  assert.equal(before.p.status, 'before');
  assert.deepEqual(before.p.window, { from: addDays(last, 26), to: addDays(last, 28) });
  assert.equal(at(27).p.status, 'expected');
  assert.equal(at(27).phase, 'expected');
  const late = at(31);
  assert.equal(late.p.status, 'late');
  assert.equal(late.p.daysLate, 3, 'atraso conta a partir do fim da janela');
  assert.equal(late.phase, 'late');
  assert.equal(late.p.upcoming[0].start, addDays(last, 32), 'próxima previsão parte de amanhã');
});

test('método que suprime ovulação esconde a janela fértil', () => {
  const methods = [{ method: 'continuous_pill', from: '2020-01-01', to: null }];
  const ctx = buildCycleContext({ periods: periodsAt('2026-10-17'), methods, onboarding, today: '2026-10-28' });
  assert.equal(phaseOn(ctx, '2026-10-28').phase, 'not_tracked');
  assert.equal(predict(ctx).upcoming[0].fertileWindow, null);
});

test('gestação suspende previsões e ciclos que a cruzam saem das médias', () => {
  const starts = startsFrom('2026-01-01', [28, 28, 28]);
  const pregnancy = { stage: 'pregnancy', start: starts.at(-1), end: null, dating: 'lmp', dueDate: addDays(starts.at(-1), 280) };
  const ctx = buildCycleContext({ periods: periodsAt(...starts), stages: [pregnancy], onboarding, today: addDays(starts.at(-1), 50) });
  assert.equal(predict(ctx).mode, 'pregnancy');
  assert.equal(phaseOn(ctx, ctx.today).phase, 'pregnancy');

  // Gestação encerrada, menstruação ainda não voltou: aguardando, sem previsões.
  const ended = { ...pregnancy, end: addDays(starts.at(-1), 70) };
  const ctx2 = buildCycleContext({ periods: periodsAt(...starts), stages: [ended], onboarding, today: addDays(starts.at(-1), 90) });
  assert.equal(predict(ctx2).mode, 'awaiting_period');

  // Menstruação voltou: o intervalo que cruza a gestação não vira "ciclo de 120 dias".
  const back = addDays(starts.at(-1), 120);
  const ctx3 = buildCycleContext({ periods: periodsAt(...starts, back), stages: [ended], onboarding, today: addDays(back, 3) });
  assert.ok(ctx3.cycles.every((c) => c.length === 28));
  assert.equal(predict(ctx3).mode, 'cycle');
});

test('"Menstruei" abre uma menstruação nova mesmo colada na anterior, e reabre a de hoje', () => {
  const prev = periodsAt('2026-10-17');
  const next = startPeriodOn(prev, '2026-10-24');
  assert.equal(next.length, 2, 'não emenda na anterior (registrar fluxo emendaria)');
  assert.deepEqual(next.at(-1), { start: '2026-10-24', end: null, source: 'user' });
  assert.equal(next[0].end, '2026-10-21', 'a anterior fica como estava');

  const closedToday = [{ start: '2026-10-24', end: '2026-10-28', source: 'user' }];
  const reopened = startPeriodOn(closedToday, '2026-10-28');
  assert.equal(reopened.length, 1);
  assert.equal(reopened[0].end, null, '"Terminou" e "Menstruei" no mesmo dia: reabre');
});

test('mais de 3 meses sem menstruação: sem previsão de atraso, status próprio', () => {
  const start = addDays('2026-10-28', -(LONG_ABSENCE_DAYS + 10));
  const ob = { ...onboarding, lastPeriodStart: start };
  const ctx = buildCycleContext({ periods: [periodFromOnboarding(ob)], onboarding: ob, today: '2026-10-28' });
  const p = predict(ctx);
  assert.equal(p.status, 'long_absence');
  assert.equal(p.daysSinceStart, LONG_ABSENCE_DAYS + 10);
  assert.ok(p.upcoming[0].start > '2026-10-28', 'as próximas previsões partem de amanhã, não do passado');

  const late = buildCycleContext({ periods: [periodFromOnboarding({ ...onboarding, lastPeriodStart: '2026-09-20' })], onboarding, today: '2026-10-28' });
  assert.equal(predict(late).status, 'late', '38 dias ainda é atraso comum');
});

test('previsão pedida para 6 ciclos devolve 6', () => {
  const ctx = buildCycleContext({ periods: [periodFromOnboarding(onboarding)], onboarding, today: '2026-10-28' });
  const p = predict(ctx, 6);
  assert.equal(p.upcoming.length, 6);
  for (let i = 1; i < 6; i++) assert.ok(p.upcoming[i].start > p.upcoming[i - 1].start);
});

test('RF01.2: ovulação 14 dias antes da próxima; janela fértil pela regra do calendário (OMS/MS)', () => {
  const ctx = buildCycleContext({ periods: [periodFromOnboarding(onboarding)], onboarding, today: '2026-10-28' });
  const next = predict(ctx).upcoming[0];
  assert.equal(next.start, '2026-11-14');
  assert.equal(next.ovulation, '2026-10-31');
  assert.deepEqual(next.fertileWindow, { start: '2026-10-26', end: '2026-11-02' }, 'ciclo de 28: do dia 10 (28 − 18) ao dia 17 (28 − 11)');
});

test('janela fértil com histórico: do ciclo mais curto − 18 ao mais longo − 11; pouco confiável se variam 10+ dias', () => {
  const regular = buildCycleContext({ periods: periodsAt(...startsFrom('2026-05-01', [26, 30, 28])), onboarding, today: '2026-08-01' });
  assert.deepEqual(regular.fertileDays, { from: 8, to: 19 });
  assert.equal(regular.fertileUnreliable, false);
  const varied = buildCycleContext({ periods: periodsAt(...startsFrom('2026-04-01', [24, 34, 27])), onboarding, today: '2026-07-20' });
  assert.equal(varied.fertileUnreliable, true, 'o MS desaconselha o calendário com diferença de 10 dias ou mais');
});

test('RN02: média dos últimos 6 ciclos; com menos de 3, mistura com o valor do cadastro', () => {
  const starts = startsFrom('2026-01-01', [32, 32]);
  const few = buildCycleContext({ periods: periodsAt(...starts), onboarding: { ...onboarding, cycleLength: 26 }, today: '2026-03-20' });
  assert.ok(few.avgCycleLength > 26 && few.avgCycleLength < 32, `misturada: ${few.avgCycleLength}`);
  const many = startsFrom('2025-06-01', [40, 40, 40, 28, 28, 28, 28, 28, 28]);
  const ctx = buildCycleContext({ periods: periodsAt(...many), onboarding, today: addDays(many.at(-1), 5) });
  assert.equal(ctx.avgCycleLength, 28, 'os ciclos de 40 dias ficaram fora da janela de 6');
});
