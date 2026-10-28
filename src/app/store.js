import { addDays, ageOn, today as localToday } from '../domain/dates.js';
import { applyTap, FLOW_CODES, getItem } from '../domain/catalog.js';
import { METHODS, methodOn, quickSexCodes } from '../domain/contraception.js';
import {
  buildCycleContext, endPeriod, periodFromOnboarding, predict, registerFlowDay, startPeriodOn, unregisterFlowDay,
} from '../domain/cycles.js';
import { shouldAskAtPeriodEnd } from '../domain/observation.js';
import { activePregnancy, datePregnancy, endPostpartum, endPregnancy, gestationalAge } from '../domain/stages.js';
import { buildAnonymousRetention } from '../domain/privacy.js';
import { cycleAnswerId, dismissalId, entryId } from '../data/schema.js';
import { dueReminders, planReminders, reminderPrefs } from './reminders.js';

// Liga o repositório (dados gravados) ao domínio (tudo calculado).
// As telas leem `getModel()` e chamam as ações; cada ação grava e notifica.

const SINCE_ALWAYS = '1900-01-01';
const PRENATAL_ID = 'prenatal-next';
const uuid = () => globalThis.crypto.randomUUID();

/** Modelo calculado a partir do que está gravado. Puro: só lê o repositório. */
export function buildModel(repo, today) {
  const profile = repo.get('profile', 'me') ?? null;
  const byDate = new Map();
  for (const e of repo.all('entries')) {
    if (!byDate.has(e.date)) byDate.set(e.date, new Set());
    byDate.get(e.date).add(e.code);
  }
  const codesOn = (date) => byDate.get(date) ?? new Set();
  const periods = repo.all('periods').map(({ id, start, end, source }) => ({ id, start, end, source }));
  const methods = repo.all('methods').map(({ id, method, from, to }) => ({ id, method, from, to }));
  const stages = repo.all('stages');
  const answers = {};
  for (const a of repo.all('cycleAnswers')) (answers[a.cycleStart] ??= {})[a.code] = a.answer;
  const dismissed = new Set(repo.all('dismissals').map((d) => d.id));

  const ctx = profile ? buildCycleContext({ periods, stages, methods, onboarding: profile.onboarding, today }) : null;
  const pregnancy = activePregnancy(stages);
  const ga = pregnancy ? gestationalAge(pregnancy.start, today) : null;
  const postpartum = stages.find((s) => s.stage === 'postpartum' && s.end == null) ?? null;
  // Menstruações como valem hoje: aberta há 10+ dias já conta como fechada pela média (RF01.4).
  // `periods` é o que está gravado; as ações partem de `livePeriods` e gravam o fechamento.
  const livePeriods = ctx?.periods ?? periods;

  return {
    today, profile, onboarded: !!profile, byDate, codesOn, periods, methods, stages, answers, dismissed,
    // 6 ciclos de previsão: o calendário cobre uns 6 meses à frente.
    ctx, prediction: ctx ? predict(ctx, 6) : null,
    pregnancy, ga, postpartum,
    stage: pregnancy ? 'pregnancy' : 'cycle',
    method: methodOn(methods, today),
    age: profile?.birthDate ? ageOn(profile.birthDate, today) : null,
    consult: repo.get('appointments', PRENATAL_ID)?.date ?? '',
    livePeriods,
    openPeriod: livePeriods.find((p) => p.end == null && p.start <= today) ?? null,
    hidden: new Set(profile?.hiddenCategories ?? []),
  };
}

export function createStore(repo, { today = localToday } = {}) {
  const listeners = new Set();
  let model = buildModel(repo, today());

  const refresh = () => {
    model = buildModel(repo, today());
    for (const l of listeners) l(model);
  };

  /** Grava a lista nova de menstruações: cria, atualiza e remove pelo id. */
  async function savePeriods(next) {
    const before = new Map(model.periods.map((p) => [p.id, p]));
    const keep = new Set();
    const writes = [];
    for (const p of next) {
      const id = p.id ?? uuid();
      keep.add(id);
      const old = before.get(id);
      if (!old || old.start !== p.start || old.end !== p.end || old.source !== p.source) {
        writes.push({ id, start: p.start, end: p.end, source: p.source ?? 'user', confirmed: p.source !== 'auto' });
      }
    }
    if (writes.length) await repo.put('periods', ...writes);
    const gone = [...before.keys()].filter((id) => !keep.has(id));
    if (gone.length) await repo.remove('periods', ...gone);
  }

  async function setCodes(date, nextCodes) {
    const before = model.codesOn(date);
    const added = [...nextCodes].filter((c) => !before.has(c));
    const removed = [...before].filter((c) => !nextCodes.has(c));
    if (added.length) await repo.put('entries', ...added.map((code) => ({ id: entryId(date, code), date, code, source: 'user' })));
    if (removed.length) await repo.remove('entries', ...removed.map((code) => entryId(date, code)));

    // Fluxo é anotação diária; a menstruação (periods) acompanha.
    const hadFlow = [...before].some((c) => FLOW_CODES.includes(c));
    const hasFlow = [...nextCodes].some((c) => FLOW_CODES.includes(c));
    if (!hadFlow && hasFlow) await savePeriods(registerFlowDay(model.livePeriods, date, model.today));
    if (hadFlow && !hasFlow) await savePeriods(unregisterFlowDay(model.livePeriods, date));
  }

  async function updateProfile(patch) {
    await repo.put('profile', { ...model.profile, ...patch, id: 'me' });
  }

  /** Lembretes já mostrados (notificação ou tela), pela chave. */
  const shownReminders = () => new Set(repo.all('dismissals').filter((d) => d.rule === 'notified').map((d) => d.context));

  /**
   * Regrava o plano de lembretes que o service worker lê. Com o app aberto ela já vê
   * o aviso na tela, então o que venceu hoje conta como mostrado. Devolve se gravou algo.
   */
  async function syncReminders() {
    if (!model.onboarded) return false;
    const items = planReminders(model);
    let wrote = false;
    if (JSON.stringify(repo.get('reminders', 'plan')?.items ?? []) !== JSON.stringify(items)) {
      await repo.put('reminders', { id: 'plan', items });
      wrote = true;
    }
    const due = dueReminders(items, shownReminders(), model.today);
    if (due.length) {
      await repo.put('dismissals', ...due.map((r) => ({ id: dismissalId('notified', r.key), rule: 'notified', context: r.key })));
      wrote = true;
    }
    return wrote;
  }

  // Ações em fila: cada uma lê o modelo já atualizado pela anterior. Sem isso, dois
  // toques rápidos (ex.: "Cólica" e logo "Dia tranquilo") partem do mesmo estado
  // antigo e um desfaz o efeito do outro.
  let queue = Promise.resolve();
  let wiped = false;
  const act = (fn) => (...args) => {
    const run = queue.then(async () => {
      // Depois de apagar tudo a tela de confirmação ainda está aberta: nada mais grava.
      if (wiped) return null;
      // App aberto virando a meia-noite: "hoje" das ações é o dia de agora.
      if (today() !== model.today) refresh();
      try {
        return await fn(...args);
      } finally {
        // Mesmo se a ação falhar no meio, a tela mostra o que ficou gravado.
        refresh();
        if (await syncReminders()) refresh();
      }
    });
    queue = run.catch(() => {});
    return run;
  };

  return {
    getModel: () => model,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    refresh,

    completeOnboarding: act(async ({ lastPeriodStart, periodLength, cycleLength, birthDate, method, aiEnabled }) => {
      const onboarding = { lastPeriodStart, periodLength, cycleLength };
      const period = periodFromOnboarding(onboarding);
      await repo.put('profile', { id: 'me', birthDate: birthDate || null, onboarding, defaultMethod: method, aiEnabled, hiddenCategories: [] });
      await repo.put('periods', { id: uuid(), ...period, end: period.end > model.today ? null : period.end, confirmed: true });
      await repo.put('methods', { id: uuid(), method, from: SINCE_ALWAYS, to: null });
    }),

    /** Toque simples num ícone. Devolve o que a tela precisa reagir (ex.: teste positivo). */
    tap: act(async (date, code) => {
      const next = applyTap(model.codesOn(date), code);
      await setCodes(date, next);
      return { turnedOn: next.has(code) };
    }),

    /** "Menstruei": abre a menstruação hoje com fluxo médio. Volta do pós-parto, se for o caso. */
    startPeriod: act(async () => {
      const t = model.today;
      if (model.postpartum) {
        const next = endPostpartum(model.stages, t);
        const changed = next.filter((s) => s.end !== model.stages.find((o) => o.id === s.id)?.end);
        const removed = model.stages.filter((o) => !next.some((s) => s.id === o.id));
        if (changed.length) await repo.put('stages', ...changed);
        if (removed.length) await repo.remove('stages', ...removed.map((s) => s.id));
      }
      // Início explícito: menstruação nova (ou reaberta), sem emendar na anterior.
      await savePeriods(startPeriodOn(model.livePeriods, t));
      // Fluxo do dia é só anotação; grava direto, sem mexer de novo nas menstruações.
      if (![...model.codesOn(t)].some((c) => FLOW_CODES.includes(c))) {
        await repo.put('entries', { id: entryId(t, 'flow_medium'), date: t, code: 'flow_medium', source: 'user' });
      }
    }),

    /** "Terminou": fecha a menstruação. Devolve o início do ciclo se for para perguntar pela cólica. */
    endPeriod: act(async () => {
      const open = model.openPeriod;
      if (!open) return null;
      await savePeriods(endPeriod(model.livePeriods, model.today));
      const period = { start: open.start, end: model.today };
      return shouldAskAtPeriodEnd(period, 'cramps', model.codesOn, model.answers[open.start]?.cramps) ? open.start : null;
    }),

    /** RF01.4: confirma (ou corrige) o fim de uma menstruação fechada automaticamente pela média. */
    confirmPeriodEnd: act(async (periodId, end) => {
      const p = model.periods.find((x) => x.id === periodId);
      if (!p || end < p.start || end > model.today) return;
      await repo.put('periods', { id: p.id, start: p.start, end, source: 'user', confirmed: true });
    }),

    answerCycle: act(async (cycleStart, code, answer) => {
      if (answer !== 'yes' && answer !== 'no') return; // "Não lembro" não é gravado
      await repo.put('cycleAnswers', { id: cycleAnswerId(cycleStart, code), cycleStart, code, answer });
    }),

    /** Relação em 1 toque com o método padrão (RN01). Tocar de novo desfaz. */
    quickSex: act(async () => {
      const t = model.today;
      const codes = new Set(model.codesOn(t));
      if (codes.has('sex_vaginal')) {
        for (const c of ['sex_vaginal', 'protection_condom', 'protection_none']) codes.delete(c);
      } else {
        for (const c of quickSexCodes(model.method)) codes.add(c);
      }
      await setCodes(t, codes);
    }),

    setMethod: act(async (method) => {
      if (!METHODS[method] || method === model.method) return;
      const t = model.today;
      const current = model.methods.find((m) => m.to == null);
      if (current) {
        // Trocado no mesmo dia em que começou: só corrige.
        if (current.from === t) await repo.put('methods', { ...current, method });
        else await repo.put('methods', { ...current, to: addDays(t, -1) }, { id: uuid(), method, from: t, to: null });
      } else {
        await repo.put('methods', { id: uuid(), method, from: t, to: null });
      }
      await updateProfile({ defaultMethod: method });
    }),

    setAiEnabled: act((on) => updateProfile({ aiEnabled: on })),

    /** Duração da menstruação que ela informa (1 a 15 dias). */
    setPeriodLength: act((days) => {
      if (!Number.isInteger(days) || days < 1 || days > 15) throw new RangeError('Duração da menstruação entre 1 e 15 dias');
      return updateProfile({ onboarding: { ...model.profile.onboarding, periodLength: days } });
    }),

    /** Preferências de lembrete: {enabled, details, daysBefore}. */
    setReminders: act((patch) => updateProfile({ reminders: { ...reminderPrefs(model), ...patch } })),

    /** App voltou à tela: recalcula o dia e o plano de lembretes. */
    syncReminders: act(async () => {}),

    toggleCategory: act((catId) => {
      const hidden = new Set(model.hidden);
      if (hidden.has(catId)) hidden.delete(catId); else hidden.add(catId);
      return updateProfile({ hiddenCategories: [...hidden] });
    }),

    /** Ativa ou reajusta a gestação. `input`: {method:'lmp', lmp} ou {method:'ultrasound', dueDate}. */
    savePregnancy: act(async (input) => {
      const r = datePregnancy({ ...input, cycleLength: model.ctx?.avgCycleLength }, model.today);
      if (!r.valid) throw new Error(r.reason);
      const current = model.pregnancy;
      await repo.put('stages', { id: current?.id ?? uuid(), ...r.stage });
      // Uma menstruação aberta não segue aberta na gestação.
      if (model.openPeriod) await savePeriods(endPeriod(model.livePeriods, model.today));
    }),

    /** Encerra sem perguntar nem guardar o motivo. `next`: 'postpartum' | 'cycle'. */
    endPregnancy: act(async (next) => {
      const updated = endPregnancy(model.stages, model.today, next);
      const writes = updated.filter((s) => !s.id || s.end !== model.stages.find((o) => o.id === s.id)?.end)
        .map((s) => ({ ...s, id: s.id ?? uuid() }));
      if (writes.length) await repo.put('stages', ...writes);
      await repo.remove('appointments', PRENATAL_ID);
    }),

    setConsult: act(async (date) => {
      if (date) await repo.put('appointments', { id: PRENATAL_ID, date, kind: 'prenatal' });
      else await repo.remove('appointments', PRENATAL_ID);
    }),

    dismiss: act((rule, context) => repo.put('dismissals', { id: dismissalId(rule, context), rule, context })),

    exportBackup: () => repo.exportJSON(),
    importBackup: act((backup) => repo.importJSON(backup)),

    /**
     * Apaga tudo do aparelho. Devolve o registro anônimo (sem datas) que PODE ser
     * mantido; sem servidor no MVP, ele não sai daqui.
     */
    async deleteAll() {
      const m = model;
      const retention = m.ctx
        ? buildAnonymousRetention({ birthDate: m.profile?.birthDate, ctx: m.ctx, entries: repo.all('entries'), today: m.today })
        : null;
      wiped = true;
      await queue;
      await repo.wipe();
      return retention;
    },
  };
}

/** Item do catálogo, para as telas. */
export const itemOf = getItem;
