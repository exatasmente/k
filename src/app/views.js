import { addDays, diffDays } from '../domain/dates.js';
import { CATALOG, CATEGORIES, getItem, isVisible } from '../domain/catalog.js';
import { bleedingFromMethod, METHODS, tracksOvulation } from '../domain/contraception.js';
import { sourcesFor } from '../domain/sources.js';
import { phaseOn } from '../domain/cycles.js';
import { cycleCoverage, cycleObservation } from '../domain/observation.js';
import { emergencyContraceptionAlert, irregularity, pregnancyAlert, COPY, COPY_SOURCES } from '../domain/rules.js';
import { gestationalAge, PREGNANCY_DAYS } from '../domain/stages.js';

// O que cada tela mostra, calculado a partir do modelo (store.js). Sem DOM: testável.

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MONTHS_LONG = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const WEEK_LONG = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const parts = (iso) => iso.split('-').map(Number);
const weekday = (iso) => { const [y, m, d] = parts(iso); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };

export const fmt = (iso) => { const [, m, d] = parts(iso); return `${d} de ${MONTHS_LONG[m - 1]}`; };
export const fmtShort = (iso) => { const [, m, d] = parts(iso); return `${d} ${MONTHS[m - 1]}`; };
export const fmtYear = (iso) => `${fmt(iso)} de ${iso.slice(0, 4)}`;
export const fmtLong = (iso) => `${WEEK_LONG[weekday(iso)]}, ${fmt(iso)}`;
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export const PHASE_LABEL = {
  menstrual: 'Menstruação', follicular: 'Fase folicular', ovulatory: 'Janela fértil', luteal: 'Fase lútea',
  expected: 'Pode começar', late: 'Atrasada', not_tracked: 'Fora da menstruação',
  pregnancy: 'Gestação', postpartum: 'Pós-parto', unknown: 'Sem dados',
};
const PHASE_PREP = {
  menstrual: 'na menstruação', follicular: 'na fase folicular', ovulatory: 'na janela fértil', luteal: 'na fase lútea',
  not_tracked: 'fora da menstruação',
};
// Fases do ciclo para estatística: "pode começar" e "atrasada" contam como lútea.
const statPhase = (phase) => (phase === 'expected' || phase === 'late' ? 'luteal' : phase);

/** Texto de saúde com as fontes que o sustentam, para a tela mostrar "Fonte: ...". */
export const copyOf = (key) => ({ text: COPY[key], sources: sourcesFor(COPY_SOURCES[key]) });

// Duração aproximada do lóquio, o sangramento normal depois do parto (Caderneta, MS 2026).
export const LOCHIA_DAYS = 42;

// Menstruação mais longa que isso é "prolongada" (FIGO 2018).
export const PROLONGED_AFTER_DAYS = 8;

const PAIN = new Set(['cramps', 'back_pain', 'headache', 'abdominal_pain']);
// Orientação na ficha do sintoma (chave do texto em COPY).
const CARE = { discharge_unusual: 'discharge', vaginal_itch: 'itch', flow_heavy: 'heavyFlow' };
const DEFAULT_SUGGEST = ['cramps', 'headache', 'fatigue', 'mood_swings'];
const PREG_SUGGEST = [
  ['nausea', 'fatigue', 'breast_tenderness', 'sleepy'],
  ['heartburn', 'back_pain', 'baby_movement', 'leg_cramps'],
  ['swelling_legs', 'insomnia', 'back_pain', 'frequent_urination'],
];

const visCtx = (model) => ({ stage: model.stage, gestationalWeek: model.ga?.weeks ?? 0 });
const lastPeriodStart = (model) => [...model.ctx.periods].reverse().find((p) => p.start <= model.today)?.start ?? null;

function ecDates(model) {
  const out = [];
  for (const [date, codes] of model.byDate) if (codes.has('emergency_contraception')) out.push(date);
  return out.sort();
}

// ---------------------------------------------------------------- Hoje

export function todayView(model) {
  const { today, ctx, prediction } = model;
  const codes = model.codesOn(today);
  const mode = model.pregnancy ? 'pregnancy' : model.postpartum ? 'postpartum'
    : prediction?.mode === 'awaiting_period' ? 'awaiting' : 'cycle';
  const view = { mode, dateLong: fmtLong(today), tags: [...codes].map((c) => tagOf(c)) };

  // Sinais de alerta (gestação) e PDS (ciclo): regras locais.
  const red = pregnancyAlert(codes, model.stage);
  view.redFlag = redFlagOf(red);

  if (mode === 'pregnancy') view.pregnancy = pregnancyCard(model);
  if (mode === 'postpartum') {
    const days = diffDays(model.postpartum.start, today);
    view.postpartum = {
      since: `Desde ${fmt(model.postpartum.start)} · ${plural(Math.floor(days / 7), 'semana', 'semanas')}`,
      paused: copyOf('paused'),
      warning: copyOf('postpartumWarning'),
      // Lóquio (sangramento normal do pós-parto) dura cerca de 42 dias (Caderneta, MS 2026):
      // antes disso, "Menstruei" pede confirmação.
      lochiaPossible: days < LOCHIA_DAYS,
    };
  }
  if (mode === 'cycle' && lastPeriodStart(model)) view.ring = ringView(model);
  // RF01.4: menstruação aberta há 10+ dias foi fechada pela média; pede confirmação.
  const pending = ctx?.pendingConfirmation.at(-1);
  if (pending && mode === 'cycle') {
    view.pendingPeriod = { id: pending.id, start: pending.start, end: pending.end, startText: fmt(pending.start), endText: fmt(pending.end) };
  }

  const sexDone = codes.has('sex_vaginal');
  const hasCondom = codes.has('protection_condom');
  const hasNone = codes.has('protection_none');
  const baseline = METHODS[model.method].baselineProtection;
  const unprotected = sexDone && !hasCondom && (hasNone ? !baseline : model.method !== 'condom' && !baseline);
  view.quick = {
    showPeriod: mode !== 'pregnancy',
    periodOpen: !!model.openPeriod,
    showSex: mode !== 'pregnancy' && !model.hidden.has('sex'),
    sexDone,
    sexSub: sexDone ? 'Toque para desfazer' : `1 toque · ${model.method === 'condom' ? 'com preservativo' : METHODS[model.method].label.toLowerCase()}`,
    showStrip: sexDone && mode !== 'pregnancy',
    stripText: `Registrada ${hasCondom ? 'com preservativo' : hasNone ? 'sem preservativo' : baseline ? `protegida por: ${METHODS[model.method].label.toLowerCase()}` : 'sem proteção registrada'}.`,
    unprotected, hasCondom, hasNone,
    pdsToday: codes.has('emergency_contraception'),
  };

  // RN03: ciclos irregulares, uma vez por ciclo completo até ela tocar em "Ok".
  const lastCycle = ctx?.cycles.at(-1)?.start;
  if (mode === 'cycle' && lastCycle && irregularity(ctx, model).kind === 'irregular' && !model.dismissed.has(`irregular|${lastCycle}`)) {
    view.irregular = { context: lastCycle, title: 'Seus ciclos variaram bastante', ...copyOf('irregular') };
  }
  if (mode === 'cycle' && ctx) Object.assign(view, bleedingNotices(model));

  if (ctx && codes.has('emergency_contraception')) {
    const alert = emergencyContraceptionAlert(ctx, ecDates(model), today);
    const context = lastPeriodStart(model) ?? today;
    if (alert.triggered && !model.dismissed.has(`pds|${context}`)) {
      view.pds = {
        context,
        title: alert.inCycle >= 2 ? `Pílula do dia seguinte: ${alert.inCycle}ª vez neste ciclo` : `Pílula do dia seguinte: ${alert.in12Months} vezes em 12 meses`,
        ...copyOf('emergencyContraception'),
      };
    }
  }
  return view;
}

export function tagOf(code) {
  const item = getItem(code);
  return { code, label: item.label, cat: item.cat };
}

/** Sinal de alerta da gestação marcado: o que ela marcou + "busque atendimento" com fontes. */
function redFlagOf(red) {
  if (!red.triggered) return null;
  return { marked: `Você marcou: ${red.codes.map((c) => getItem(c).label.toLowerCase()).join(', ')}.`, ...copyOf('pregnancyUrgent') };
}

/**
 * Sangramentos que merecem avaliação (FIGO 2018, ACOG, MS 2016): menstruação com mais de
 * 8 dias e escape fora da menstruação. Cada aviso aparece uma vez por contexto até o "Ok".
 */
function bleedingNotices(model) {
  const { today, livePeriods, dismissed } = model;
  const out = {};
  const open = model.openPeriod;
  if (open && diffDays(open.start, today) >= PROLONGED_AFTER_DAYS && !dismissed.has(`prolonged|${open.start}`)) {
    out.prolonged = { context: open.start, title: 'Menstruação longa', ...copyOf('prolonged') };
  } else {
    const last = [...livePeriods].reverse().find((p) => p.end && p.end <= today);
    if (last && diffDays(last.start, last.end) + 1 > PROLONGED_AFTER_DAYS && diffDays(last.end, today) <= 30
      && !dismissed.has(`prolonged|${last.start}`)) {
      out.prolonged = { context: last.start, title: 'Menstruação longa', ...copyOf('prolongedPast') };
    }
  }
  // Escape nos últimos 14 dias, fora de qualquer menstruação. Com método hormonal o escape
  // é comum (MS 2016); aí só vale o que vem logo depois da relação.
  const hormonal = bleedingFromMethod(model.method);
  for (let i = 0; i < 14; i++) {
    const d = addDays(today, -i);
    if (!model.codesOn(d).has('spotting')) continue;
    if (livePeriods.some((p) => d >= addDays(p.start, -2) && d <= addDays(p.end ?? today, 2))) continue;
    const afterSex = [d, addDays(d, -1)].some((x) => [...model.codesOn(x)].some((c) => c.startsWith('sex_')));
    if ((hormonal && !afterSex) || dismissed.has(`intermenstrual|${d}`)) continue;
    out.intermenstrual = { context: d, title: afterSex ? 'Sangramento depois da relação' : 'Sangramento fora da menstruação', ...copyOf('intermenstrual') };
    break;
  }
  return out;
}

function ringView(model) {
  const { today, ctx, prediction } = model;
  const start = lastPeriodStart(model);
  const L = ctx.avgCycleLength;
  const cd = diffDays(start, today) + 1;
  const phase = phaseOn(ctx, today);
  const tracks = tracksOvulation(model.method);
  const ovCd = L - 13;
  const status = phase.phase === 'menstrual' ? 'period' : prediction.status === 'long_absence' ? 'absence'
    : prediction.status === 'late' ? 'late' : prediction.status === 'expected' ? 'window' : 'before';
  const big = { period: 'Menstruação', late: 'Atrasada', window: 'Pode começar', absence: 'Sem menstruação' }[status]
    ?? (tracks ? PHASE_LABEL[phase.phase].replace('Fase ', '') : `Dia ${cd}`);
  const untilWindow = prediction.daysUntilWindow;
  return {
    status, tracks, cycleDay: cd, length: L,
    periodFrac: Math.min(ctx.avgPeriodLength, L) / L,
    fertile: tracks ? { from: (ovCd - 6) / L, to: (ovCd + 1) / L } : null,
    markerFrac: (Math.min(cd, L) - 0.5) / L,
    top: tracks ? `Dia ${cd} do ciclo` : METHODS[model.method].label,
    big,
    tone: status === 'period' || status === 'window' ? 'period' : status === 'late' || status === 'absence' ? 'late' : phase.phase === 'ovulatory' ? 'fertile' : 'neutral',
    bottom: status === 'period' ? `Dia ${cd} da menstruação`
      : status === 'absence' ? `há ${plural(cd - 1, 'dia', 'dias')} desde a última`
      : status === 'late' ? `há ${plural(prediction.daysLate, 'dia', 'dias')} além da janela prevista`
        : status === 'window' ? `a qualquer dia até ${fmtShort(prediction.window.to)}`
          : `Menstruação em ${plural(untilWindow, 'dia', 'dias')}`,
    window: status === 'before' || status === 'window' ? `Previsão: entre ${fmtShort(prediction.window.from)} e ${fmtShort(prediction.window.to)}` : null,
    hormonalNote: METHODS[model.method].ovulation === 'suppressed'
      ? { text: `Sem janela fértil com ${METHODS[model.method].label.toLowerCase()}. O foco aqui é como você se sente.`, sources: [] }
      : METHODS[model.method].ovulation === 'uncertain' ? copyOf('ovulationUncertain') : null,
    // Com DIU de cobre a ovulação continua, mas a proteção vale todos os dias.
    fertileNote: !tracks ? null : model.method === 'copper_iud' ? copyOf('iudProtects')
      : ctx.fertileUnreliable ? copyOf('fertileUnreliable') : null,
    // Com método hormonal ficar sem menstruar costuma ser efeito do método (CDC US SPR 2024).
    absenceNote: status === 'absence' && !bleedingFromMethod(model.method) ? copyOf('longAbsence') : null,
  };
}

function pregnancyCard(model) {
  const p = model.pregnancy;
  const ga = model.ga;
  const consultIn = model.consult ? diffDays(model.today, model.consult) : null;
  return {
    short: ga.label, trimester: `${ga.trimester}º trimestre`,
    long: `${plural(ga.weeks, 'semana', 'semanas')}${ga.extraDays ? ` e ${plural(ga.extraDays, 'dia', 'dias')}` : ''}`,
    pct: Math.min(100, Math.max(0, (ga.days / PREGNANCY_DAYS) * 100)),
    due: fmtYear(p.dueDate),
    dating: p.dating === 'ultrasound' ? 'Datação pela ultrassonografia' : `Datação pela última menstruação (${fmt(p.start)})`,
    consult: model.consult,
    consultText: consultIn == null ? 'Nenhuma consulta marcada' : consultIn > 1 ? `Em ${consultIn} dias` : consultIn === 1 ? 'Amanhã' : consultIn === 0 ? 'Hoje' : 'Já passou: marque a próxima',
    flags: CATALOG.filter((i) => i.alert && isVisible(i, visCtx(model))).map((i) => i.label),
    flagsCopy: copyOf('pregnancyUrgent'),
    // Com 41 semanas a gestante é encaminhada para avaliação (MS, CAB 32).
    postTerm: ga.weeks >= 41 ? copyOf('postTerm') : null,
  };
}

// ---------------------------------------------------------------- Registro

export function logView(model, date) {
  const codes = model.codesOn(date);
  const vis = visCtx(model);
  const sections = CATEGORIES.filter((c) => isVisible(c, vis) && !model.hidden.has(c.id)).map((cat) => ({
    id: cat.id, label: cat.label,
    hint: { flow: 'fluxo: escolha um', discharge: 'escolha uma', factors: 'ajudam a explicar mudanças', alert: 'pedem avaliação' }[cat.id] ?? '',
    items: CATALOG.filter((i) => i.cat === cat.id && !i.hiddenInGrid && isVisible(i, vis)).map((i) => ({
      code: i.code, label: i.label, cat: i.cat, pressed: codes.has(i.code), highlight: !!i.highlight,
    })),
  }));
  const red = pregnancyAlert(codes, model.stage);
  let pds = null;
  if (model.ctx && codes.has('emergency_contraception')) {
    const a = emergencyContraceptionAlert(model.ctx, ecDates(model), date);
    if (a.triggered) pds = copyOf('emergencyContraception');
  }
  const sug = suggestions(model, date);
  return {
    dateLabel: date === model.today ? `Hoje, ${fmt(date)}` : fmtLong(date),
    sections,
    suggest: { label: sug.label, items: sug.codes.filter((c) => !model.hidden.has(getItem(c).cat)).map((c) => ({ code: c, label: getItem(c).label, cat: getItem(c).cat, pressed: codes.has(c) })) },
    calmPressed: codes.has('no_symptoms'),
    calmVisible: !model.hidden.has('symptom'),
    redFlag: redFlagOf(red),
    pds,
    editRows: CATEGORIES.filter((c) => isVisible(c, vis)).map((c) => ({
      id: c.id, label: c.label, on: !model.hidden.has(c.id),
      count: CATALOG.filter((i) => i.cat === c.id && !i.hiddenInGrid && isVisible(i, vis)).length,
    })),
  };
}

/** "Comuns para você agora": na gestação por trimestre; no ciclo pela fase do dia. */
export function suggestions(model, date) {
  const vis = visCtx(model);
  const visible = (c) => isVisible(getItem(c), vis);
  if (model.pregnancy) {
    const counts = {};
    for (const [d, codes] of model.byDate) {
      if (d < model.pregnancy.start || d > date) continue;
      for (const c of codes) if (getItem(c).cat === 'symptom' && !getItem(c).negates) counts[c] = (counts[c] ?? 0) + 1;
    }
    const mine = Object.keys(counts).filter((c) => counts[c] >= 2).sort((a, b) => counts[b] - counts[a]).slice(0, 2);
    const codes = [...new Set([...mine, ...PREG_SUGGEST[model.ga.trimester - 1]])].filter(visible).slice(0, 4);
    return { label: `${model.ga.trimester}º trimestre`, codes };
  }
  if (!model.ctx) return { label: '', codes: DEFAULT_SUGGEST.filter(visible) };
  const now = statPhase(phaseOn(model.ctx, date).phase);
  const current = lastPeriodStart(model);
  const counts = {};
  for (const [d, codes] of model.byDate) {
    if (current && d >= current) continue; // só ciclos anteriores
    let phase;
    for (const c of codes) {
      const item = getItem(c);
      if ((item.cat !== 'symptom' && item.cat !== 'mood') || item.negates) continue;
      phase ??= statPhase(phaseOn(model.ctx, d).phase);
      if (phase === now) counts[c] = (counts[c] ?? 0) + 1;
    }
  }
  const mine = Object.keys(counts).sort((a, b) => counts[b] - counts[a]).slice(0, 4);
  const codes = [...new Set([...mine, ...DEFAULT_SUGGEST])].filter(visible).slice(0, 4);
  return { label: PHASE_LABEL[now] ?? '', codes };
}

// ---------------------------------------------------------------- Ficha do sintoma

export function symptomView(model, code) {
  const item = getItem(code);
  const cat = CATEGORIES.find((c) => c.id === item.cat);
  const base = { code, label: item.label, cat: cat.id, catLabel: cat.label };
  return model.pregnancy ? { ...base, ...symptomPregnancy(model, item, cat) } : { ...base, ...symptomCycle(model, item, cat) };
}

function symptomCycle(model, item, cat) {
  const { ctx, today } = model;
  const code = item.code;
  const catName = cat.label.toLowerCase();
  const tracks = tracksOvulation(model.method);
  if (!ctx) return { windows: [], phases: [], rows: [], coverageText: '', insight: '' };

  // Ciclos: completos (sem os que cruzam gestação) + o atual.
  const current = lastPeriodStart(model);
  const cycles = ctx.cycles.map((c) => ({ start: c.start, len: c.length, end: addDays(c.start, c.length - 1) }));
  if (current && !cycles.some((c) => c.start === current)) {
    cycles.push({ start: current, len: ctx.avgCycleLength, end: today, current: true });
  }
  const obs = cycles.map((c) => ({ ...c, ...cycleObservation(c, code, model.codesOn, model.answers[c.start]?.[code]) }));

  // Contagens por janela e distribuição por fase (últimos 12 meses).
  const cuts = [-91, -182, -365].map((n) => addDays(today, n));
  const counts = [0, 0, 0];
  // Cada dia é classificado com o método vigente nele; depois de trocar de método,
  // dias antigos podem cair em fases que o método atual não usa.
  const ALL = ['menstrual', 'follicular', 'ovulatory', 'luteal', 'not_tracked'];
  const base = tracks ? ['menstrual', 'follicular', 'ovulatory', 'luteal'] : ['menstrual', 'not_tracked'];
  const byPhase = Object.fromEntries(ALL.map((k) => [k, []]));
  for (const [d, codes] of model.byDate) {
    if (!codes.has(code) || d > today) continue;
    cuts.forEach((k, i) => { if (d > k) counts[i]++; });
    if (d <= cuts[2]) continue;
    const ph = phaseOn(ctx, d);
    const key = statPhase(ph.phase);
    if (byPhase[key]) byPhase[key].push(ph.cycleDay);
  }
  const keys = ALL.filter((k) => base.includes(k) || byPhase[k].length > 0);
  const total = keys.reduce((s, k) => s + byPhase[k].length, 0);
  const phases = keys.map((k) => ({ key: k, label: PHASE_LABEL[k], pct: total ? Math.round((byPhase[k].length / total) * 100) : 0 }));
  const top = [...phases].sort((a, b) => b.pct - a.pct)[0];

  const done = obs.filter((c) => !c.current).slice(-6);
  const cov = cycleCoverage(done);
  const coverageText = done.length === 0 ? 'Ainda não há ciclos completos registrados.'
    : `Aparece em ${cov.present} de ${plural(cov.observed, 'ciclo', 'ciclos')} com registro de ${catName}`
      + (cov.skipped ? `. ${plural(cov.skipped, 'ciclo', 'ciclos')} sem registro de ${catName} ${cov.skipped === 1 ? 'não entra' : 'não entram'} na conta.` : '.');

  let insight;
  let topPrep = '';
  if (cov.present < 3 || !total) {
    insight = `Ainda há poucos registros para apontar um padrão. A partir de 3 ciclos com ${item.label.toLowerCase()} mostramos a tendência.`;
  } else {
    // Faixa central (quartis), para um ciclo longo não esticar o padrão.
    const days = [...byPhase[top.key]].sort((a, b) => a - b);
    const lo = days[Math.floor((days.length - 1) * 0.25)];
    const hi = days[Math.ceil((days.length - 1) * 0.75)];
    topPrep = `${PHASE_PREP[top.key]} (${lo === hi ? `dia ${lo}` : `dias ${lo}–${hi}`} do ciclo)`;
    insight = `Aparece mais ${topPrep}.`;
  }
  const care = PAIN.has(code) && cov.present > 0 ? copyOf('pain') : CARE[code] ? copyOf(CARE[code]) : null;

  const shown = obs.slice(-8).reverse();
  const maxLen = Math.max(28, ...shown.map((c) => c.len));
  const periodLen = (start) => {
    const p = ctx.periods.find((x) => x.start === start);
    return p?.end ? diffDays(p.start, p.end) + 1 : ctx.avgPeriodLength;
  };
  const rows = shown.map((c) => {
    let right = c.current ? `dia ${diffDays(c.start, today) + 1}` : `${c.len} dias`;
    if (c.observed) right += ` · ${c.confirmedOnly ? 'teve, sem dia marcado' : `${c.days.length}×`}`;
    return {
      key: c.start,
      label: c.current ? `Ciclo atual · desde ${fmtShort(c.start)}` : `${fmtShort(c.start)} – ${fmtShort(c.end)}`,
      right, observed: c.observed,
      empty: c.current ? `Ainda sem registros de ${catName} neste ciclo` : `Sem registros de ${catName} neste ciclo · não entra na conta`,
      width: (c.len / maxLen) * 100,
      period: (Math.min(periodLen(c.start), c.len) / c.len) * 100,
      fertile: tracks ? { left: ((ctx.fertileDays.from - 1) / c.len) * 100, width: ((ctx.fertileDays.to - ctx.fertileDays.from + 1) / c.len) * 100 } : null,
      dots: c.days.map((d) => ((d - 0.5) / c.len) * 100),
    };
  });

  return {
    windows: [3, 6, 12].map((months, i) => ({ count: counts[i], label: `${counts[i] === 1 ? 'dia' : 'dias'} em ${months} meses` })),
    phaseTitle: 'Em que fase aparece', phases, rowsTitle: 'Ciclo a ciclo', rows, legendCycle: true, legendFertile: tracks,
    coverageText, insight, care, coverage: cov, topPrep,
  };
}

function symptomPregnancy(model, item, cat) {
  const { today } = model;
  const lmp = model.pregnancy.start;
  const ga = model.ga;
  const catName = cat.label.toLowerCase();
  const week = (w) => {
    const days = [];
    let observed = false;
    for (let d = 0; d < 7; d++) {
      const date = addDays(lmp, w * 7 + d);
      if (date > today) break;
      const codes = model.codesOn(date);
      if ([...codes].some((c) => getItem(c).cat === item.cat)) observed = true;
      if (codes.has(item.code)) days.push(d);
    }
    return { days, observed };
  };
  const byTri = [0, 0, 0];
  let total = 0;
  let thisWeek = 0;
  for (let w = 0; w <= ga.weeks; w++) {
    const { days } = week(w);
    byTri[w < 14 ? 0 : w < 28 ? 1 : 2] += days.length;
    total += days.length;
    if (w === ga.weeks) thisWeek = days.length;
  }
  const rows = [];
  for (let w = ga.weeks; w >= Math.max(0, ga.weeks - 7); w--) {
    const { days, observed } = week(w);
    rows.push({
      key: String(w), label: `Semana ${w}${w === ga.weeks ? ' · atual' : ''}`, right: observed ? `${days.length}×` : '',
      observed, empty: `Sem registros de ${catName} nesta semana`, width: 100, period: 0, fertile: null,
      dots: days.map((d) => ((d + 0.5) / 7) * 100),
    });
  }
  const observedRows = rows.filter((r) => r.observed);
  const insight = item.alert ? 'É um sinal de alerta.'
    : total ? `Registrado em ${plural(total, 'dia', 'dias')} desde o início da gestação.` : 'Ainda sem registros na gestação.';
  const care = item.alert ? copyOf('pregnancyUrgent') : CARE[item.code] ? copyOf(CARE[item.code]) : null;
  return {
    windows: [
      { count: thisWeek, label: `${thisWeek === 1 ? 'dia' : 'dias'} nesta semana` },
      { count: byTri[ga.trimester - 1], label: `${byTri[ga.trimester - 1] === 1 ? 'dia' : 'dias'} no ${ga.trimester}º trimestre` },
      { count: total, label: `${total === 1 ? 'dia' : 'dias'} na gestação` },
    ],
    phaseTitle: 'Em que trimestre aparece',
    phases: ['1º trimestre', '2º trimestre', '3º trimestre'].slice(0, ga.trimester)
      .map((label, i) => ({ key: `t${i + 1}`, label, pct: total ? Math.round((byTri[i] / total) * 100) : 0 })),
    rowsTitle: 'Semana a semana', rows, legendCycle: false, legendFertile: false,
    coverageText: `Aparece em ${observedRows.filter((r) => r.dots.length).length} das últimas ${plural(observedRows.length, 'semana', 'semanas')} com registro de ${catName}.`,
    insight, care,
  };
}

// ---------------------------------------------------------------- Calendário

export function calendarView(model, month, selected) {
  const [y, m] = month.split('-').map(Number);
  const first = `${month}-01`;
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const { ctx, prediction, today } = model;
  const upcoming = prediction?.upcoming ?? [];
  const inRange = (d, from, to) => from && d >= from && d <= to;
  const cells = Array.from({ length: weekday(first) }, (_, i) => ({ blank: true, key: `b${i}` }));
  for (let n = 1; n <= days; n++) {
    const date = `${month}-${String(n).padStart(2, '0')}`;
    const codes = model.codesOn(date);
    const actual = model.livePeriods.some((p) => date >= p.start && date <= (p.end ?? today) && date <= today);
    const predicted = !actual && date > today && upcoming.some((u) => inRange(date, u.start, u.end));
    let fertile = false;
    let ovulation = false;
    if (ctx && !model.pregnancy && tracksOvulation(model.method)) {
      const fromPrediction = upcoming.find((u) => u.fertileWindow && inRange(date, u.fertileWindow.start, u.fertileWindow.end));
      if (fromPrediction && date > today) {
        fertile = true;
        ovulation = fromPrediction.ovulation === date;
      } else if (date <= (prediction?.window?.from ?? today)) {
        const ph = phaseOn(ctx, date);
        fertile = ph.phase === 'ovulatory';
        ovulation = ph.ovulation === date;
      }
    }
    cells.push({
      key: date, date, day: n, today: date === today, selected: date === selected,
      actual, predicted, fertile: fertile && !actual, ovulation, consult: model.consult === date,
      sex: [...codes].some((c) => c.startsWith('sex_')),
    });
  }
  return { title: `${MONTHS_LONG[m - 1][0].toUpperCase()}${MONTHS_LONG[m - 1].slice(1)} ${y}`, cells, selected: dayDetail(model, selected) };
}

export function dayDetail(model, date) {
  const codes = model.codesOn(date);
  let phase = 'Sem dados de ciclo';
  if (model.pregnancy && date >= model.pregnancy.start) {
    const ga = gestationalAge(model.pregnancy.start, date);
    phase = `${ga.label} · ${ga.trimester}º trimestre`;
  } else if (model.ctx) {
    const ph = phaseOn(model.ctx, date);
    phase = `${date > model.today ? 'Previsão: ' : ''}${PHASE_LABEL[ph.phase]}${ph.cycleDay ? ` · dia ${ph.cycleDay} do ciclo` : ''}`;
  }
  if (model.consult === date) phase += ' · consulta do pré-natal';
  // Menstruação registrada que contém o dia (para corrigir um registro feito por engano).
  const p = model.livePeriods.find((x) => x.start <= date && date <= (x.end ?? model.today) && date <= model.today);
  const period = p && {
    id: p.id,
    text: p.end ? `Menstruação de ${fmt(p.start)} a ${fmt(p.end)}` : `Menstruação desde ${fmt(p.start)}`,
  };
  return { date, title: `${date === model.today ? 'Hoje, ' : ''}${fmt(date)}`, phase, tags: [...codes].map(tagOf), canLog: date <= model.today, period };
}

// ---------------------------------------------------------------- Resumo

export function statsView(model) {
  const { ctx } = model;
  if (model.pregnancy) {
    const counts = {};
    const flags = [];
    for (const [d, codes] of [...model.byDate].sort(([a], [b]) => (a < b ? -1 : 1))) {
      if (d < model.pregnancy.start || d > model.today) continue;
      for (const c of codes) {
        const item = getItem(c);
        if (item.alert) flags.push(`${fmt(d)} · ${item.label}`);
        else if ((item.cat === 'symptom' || item.cat === 'mood') && !item.negates) counts[c] = (counts[c] ?? 0) + 1;
      }
    }
    const top = Object.keys(counts).sort((a, b) => counts[b] - counts[a]).slice(0, 5);
    const max = top.length ? counts[top[0]] : 1;
    return {
      mode: 'pregnancy', card: pregnancyCard(model), flags,
      top: top.map((c) => ({ code: c, label: getItem(c).label, text: plural(counts[c], 'dia', 'dias'), pct: (counts[c] / max) * 100 })),
    };
  }
  if (!ctx) return { mode: 'empty' };
  const reg = irregularity(ctx, model);
  const recent = ctx.cycles.slice(-reg.last.length);
  const regText = {
    insufficient: ['Ainda sem dados suficientes', 'muted', `Precisamos de 3 ciclos completos registrados para avaliar${ctx.cycles.length ? `. Até agora: ${ctx.cycles.map((c) => c.length).join(' e ')} dias.` : '.'}`],
    regular: ['Regular', 'good', `Seus últimos ciclos variaram ${plural(reg.range, 'dia', 'dias')} entre o mais curto e o mais longo.`],
    outlier: ['Um ciclo fora do padrão', 'warn', reg.kind === 'outlier'
      ? `O ciclo que começou em ${fmt(recent[reg.outlierIndex].start)} durou ${reg.last[reg.outlierIndex]} dias. Os outros variaram só ${plural(reg.restRange, 'dia', 'dias')}. Isso pode acontecer de vez em quando; se repetir, vale mostrar este histórico à sua ginecologista.` : ''],
    irregular: ['Ciclos irregulares', 'warn', COPY.irregular],
    paused: ['Pausado', 'muted', COPY.paused],
    method: ['Depende do método', 'muted', COPY.methodBleeding],
  }[reg.kind];
  const maxBar = Math.max(28, ...reg.last);
  const ec = ecDates(model);
  const yearAgo = addDays(model.today, -365);
  const cycleStart = lastPeriodStart(model);
  return {
    mode: 'cycle',
    avgCycle: ctx.avgCycleLength,
    avgCycleSub: reg.kind === 'outlier' ? 'sem contar o ciclo fora do padrão'
      : ctx.cycles.length ? `últimos ${plural(Math.min(6, ctx.cycles.length), 'ciclo', 'ciclos')}` : 'pelo seu cadastro, até o primeiro ciclo completo',
    avgPeriod: ctx.avgPeriodLength,
    avgPeriodSub: ctx.recordedPeriodLength == null ? 'a que você informou'
      : `a que você informou · registrada: ${plural(ctx.recordedPeriodLength, 'dia', 'dias')}`,
    regularity: {
      title: regText[0], tone: regText[1], text: regText[2],
      sources: sourcesFor(COPY_SOURCES[{ irregular: 'irregular', outlier: 'outlier', paused: 'paused', method: 'methodBleeding' }[reg.kind] ?? 'outlier']),
    },
    bars: reg.last.map((len, i) => ({
      key: recent[i].start, len, height: Math.round((len / maxBar) * 60) + 8,
      odd: reg.kind === 'outlier' && i === reg.outlierIndex, month: fmtShort(recent[i].start).split(' ')[1],
    })),
    pds: `${plural(ec.filter((d) => d > yearAgo).length, 'vez', 'vezes')} nos últimos 12 meses · ${ec.filter((d) => cycleStart && d >= cycleStart).length} neste ciclo.`,
    hasCycles: ctx.cycles.length > 0,
    top: ['cramps', 'fatigue', 'breast_tenderness'].map((c) => {
      const v = symptomCycle(model, getItem(c), CATEGORIES.find((x) => x.id === getItem(c).cat));
      return { code: c, label: getItem(c).label, text: `${v.coverage?.present ?? 0} de ${plural(v.coverage?.observed ?? 0, 'ciclo', 'ciclos')}`, pct: v.coverage?.observed ? (v.coverage.present / v.coverage.observed) * 100 : 0 };
    }),
  };
}
