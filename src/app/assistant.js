import { addDays, diffDays } from '../domain/dates.js';
import { CATALOG, getItem, isVisible } from '../domain/catalog.js';
import { METHODS, tracksOvulation } from '../domain/contraception.js';
import { phaseOn } from '../domain/cycles.js';
import { emergencyContraceptionAlert, COPY } from '../domain/rules.js';
import { fmt, fmtShort, fmtYear, symptomView } from './views.js';

// Assistente local: responde as perguntas sugeridas com os números do próprio app,
// calculados no aparelho. Nada sai daqui. Perguntas livres ficam para a IA, que
// vai chamar estas mesmas funções (ver ADR 0001).

export const DISCLAIMER = 'Informativo. Não substitui o diagnóstico ou a orientação de um profissional de saúde.';
export const GREETING = 'Oi! Respondo sobre o seu histórico com os dados que estão neste aparelho. Escolha uma pergunta abaixo.';

const MED_WORDS = ['remédio', 'remedio', 'medicamento', 'posso tomar', 'posso usar', 'dipirona', 'paracetamol', 'ibuprofeno', 'chá', 'suplemento'];
const ALERT_WORDS = ['sangr', 'líquido', 'liquido', 'febre', 'dor forte', 'contraç', 'mexendo menos', 'visão'];

export function suggestedQuestions(model) {
  if (model.pregnancy) {
    return ['Com quantas semanas estou?', 'Quando é a data provável do parto?', 'O que registrei nesta semana?', 'Posso tomar remédio para dor de cabeça?'];
  }
  const list = ['Quando foi minha última menstruação?', 'Quando vem a próxima menstruação?', 'Senti cólica em todos os ciclos?'];
  if (tracksOvulation(model.method)) list.push('Estou na janela fértil?');
  list.push('Quando foi minha última relação?', 'Quantas vezes tomei a pílula do dia seguinte neste ano?');
  return list;
}

/** Pergunta sobre um sintoma vinda da ficha (long-press → "Perguntar à assistente"). */
export function symptomQuestion(model, code) {
  const item = getItem(code);
  const label = item.label.toLowerCase();
  if (model.pregnancy) return `Quantas vezes registrei ${label} na gestação?`;
  return item.cat === 'mood' ? `Me senti ${label} em todos os ciclos?` : `Tive ${label} em todos os ciclos?`;
}

const has = (q, words) => words.some((w) => q.includes(w));
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function lastWith(model, pred) {
  let last = null;
  for (const [date, codes] of model.byDate) if (date <= model.today && [...codes].some(pred) && (!last || date > last)) last = date;
  return last;
}

function mentionedSymptom(model, q) {
  const vis = { stage: model.stage, gestationalWeek: model.ga?.weeks ?? 0 };
  return CATALOG
    .filter((i) => (i.cat === 'symptom' || i.cat === 'mood') && !i.negates && isVisible(i, vis))
    .sort((a, b) => b.label.length - a.label.length) // "dor de cabeça" antes de "dor"
    .find((i) => q.includes(i.label.toLowerCase()));
}

function answerPregnancy(model, q) {
  if (has(q, MED_WORDS)) {
    return 'Na gestação eu não indico nem avalio remédios, chás ou suplementos, mesmo os mais comuns. Quem pode dizer o que é seguro para você é sua obstetra ou o farmacêutico.\n\nSe a dor for forte, não passar ou vier com visão turva ou inchaço no rosto e nas mãos, procure atendimento.';
  }
  if (has(q, ALERT_WORDS)) return COPY.pregnancyUrgent;
  const p = model.pregnancy;
  const ga = model.ga;
  const how = p.dating === 'ultrasound' ? 'pela ultrassonografia' : 'pela data da última menstruação';
  const sym = mentionedSymptom(model, q);
  if (sym) {
    const v = symptomView(model, sym.code);
    const total = v.windows[2].count;
    return total
      ? `Você registrou ${sym.label.toLowerCase()} em ${plural(total, 'dia', 'dias')} desde o início da gestação, ${plural(v.windows[0].count, 'dia', 'dias')} nesta semana.`
      : `Você ainda não registrou ${sym.label.toLowerCase()} na gestação.`;
  }
  if (q.includes('registrei')) {
    const counts = {};
    for (let i = 0; i < 7; i++) {
      for (const c of model.codesOn(addDays(model.today, -i))) if (!getItem(c).negates) counts[c] = (counts[c] ?? 0) + 1;
    }
    const keys = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    if (!keys.length) return 'Nos últimos 7 dias você não registrou nada. Dias sem registro não contam como "não teve".';
    return `Nos últimos 7 dias: ${keys.map((c) => `${getItem(c).label.toLowerCase()} (${plural(counts[c], 'dia', 'dias')})`).join(', ')}.`;
  }
  if (q.includes('parto')) {
    return `A data provável do parto é ${fmtYear(p.dueDate)}, calculada ${how}. É uma estimativa: poucos bebês nascem exatamente nesse dia, e o pré-natal pode ajustá-la.`;
  }
  if (q.includes('semana')) {
    return `Você está com ${plural(ga.weeks, 'semana', 'semanas')} e ${plural(ga.extraDays, 'dia', 'dias')} (${ga.label}), no ${ga.trimester}º trimestre, contando ${how}.`;
  }
  return null;
}

function answerCycle(model, q) {
  const { ctx, prediction, today } = model;
  const last = [...ctx.periods].reverse().find((p) => p.start <= today);

  if (q.includes('pílula do dia') || q.includes('pilula do dia')) {
    const dates = [...model.byDate].filter(([, c]) => c.has('emergency_contraception')).map(([d]) => d).sort();
    const year = dates.filter((d) => d.slice(0, 4) === today.slice(0, 4));
    let a = year.length
      ? `Você registrou ${plural(year.length, 'vez', 'vezes')} em ${today.slice(0, 4)}: ${year.map(fmt).join(', ')}.`
      : `Você não registrou a pílula do dia seguinte em ${today.slice(0, 4)}.`;
    if (dates.length && emergencyContraceptionAlert(ctx, dates, today).triggered) a += `\n\n${COPY.emergencyContraception}`;
    return a;
  }
  if (q.includes('relação') || q.includes('relacao')) {
    const d = lastWith(model, (c) => c.startsWith('sex_'));
    return d ? `A última relação registrada foi em ${fmt(d)}, há ${plural(diffDays(d, today), 'dia', 'dias')}.` : 'Você ainda não registrou nenhuma relação.';
  }
  const sym = mentionedSymptom(model, q);
  if (sym) {
    const v = symptomView(model, sym.code);
    const cov = v.coverage;
    if (!cov?.observed) return `Ainda não há ciclos completos com registro de ${getItem(sym.code).cat === 'mood' ? 'humor' : 'sintomas'} para responder.`;
    let a = `Você registrou ${sym.label.toLowerCase()} em ${cov.present} de ${plural(cov.observed, 'ciclo', 'ciclos')} com registro`;
    a += cov.skipped ? ` (${plural(cov.skipped, 'ciclo', 'ciclos')} sem registro ${cov.skipped === 1 ? 'ficou' : 'ficaram'} de fora).` : '.';
    if (v.topPrep) a += ` Aparece mais ${v.topPrep}.`;
    if (['cramps', 'back_pain', 'headache', 'abdominal_pain'].includes(sym.code) && cov.present > 0) {
      a += '\n\nSe a dor atrapalha sua rotina, vale conversar com sua ginecologista.';
    }
    return a;
  }
  if (q.includes('fértil') || q.includes('fertil')) {
    if (!tracksOvulation(model.method)) {
      return `Com ${METHODS[model.method].label.toLowerCase()}, a ovulação costuma ficar suprimida, então o app não mostra janela fértil.`;
    }
    if (prediction.status === 'late' || prediction.status === 'long_absence') {
      return 'Com a menstruação atrasada não dá para estimar a janela fértil agora. A estimativa volta depois da próxima menstruação.';
    }
    const ph = phaseOn(ctx, today);
    const fw = ph.phase === 'ovulatory' ? ph.fertileWindow
      : [ph.fertileWindow, ...prediction.upcoming.map((u) => u.fertileWindow)].find((w) => w && w.start > today);
    if (!fw) return 'Ainda não consigo estimar a janela fértil com os dados registrados.';
    const range = `de ${fmtShort(fw.start)} a ${fmtShort(fw.end)}`;
    return `${ph.phase === 'ovulatory' ? `Sim. Pela estimativa, sua janela fértil vai ${range}.` : `Hoje não. A próxima janela fértil estimada vai ${range}.`}\n\nÉ uma estimativa e não funciona como método contraceptivo.`;
  }
  if (q.includes('última menstrua') || q.includes('ultima menstrua')) {
    if (!last) return 'Ainda não há menstruação registrada.';
    const dur = last.end ? ` e durou ${plural(diffDays(last.start, last.end) + 1, 'dia', 'dias')}` : ', e ainda está em andamento';
    return `Sua última menstruação começou em ${fmt(last.start)} (há ${plural(diffDays(last.start, today), 'dia', 'dias')})${dur}.`;
  }
  if (q.includes('grávida') || q.includes('gravida')) {
    return 'O app não consegue saber se você está grávida. Se a menstruação atrasou, um teste de gravidez (de farmácia ou de sangue) responde. Se der positivo, registre em "Teste de gravidez" para ativar o modo gestação.';
  }
  if (q.includes('próxima') || q.includes('proxima')) {
    if (prediction.mode === 'awaiting_period') return 'Depois da gestação, as previsões voltam a partir da próxima menstruação.';
    if (!prediction.window) return 'Ainda não há dados para prever.';
    if (prediction.status === 'long_absence') return `Faz ${prediction.daysSinceStart} dias desde a última menstruação registrada, então não dá para prever a próxima. ${COPY.longAbsence}`;
    const w = `entre ${fmtShort(prediction.window.from)} e ${fmtShort(prediction.window.to)}`;
    if (prediction.status === 'late') return `A janela prevista (${w}) já passou há ${plural(prediction.daysLate, 'dia', 'dias')}. Fatores como estresse, doença ou viagem podem atrasar o ciclo.`;
    if (prediction.status === 'expected') return `Pode começar a qualquer dia: a previsão vai ${w}.`;
    return `A próxima menstruação está prevista ${w}, pela média de ${ctx.avgCycleLength} dias dos seus ciclos.`;
  }
  return null;
}

/** Responde uma pergunta; sempre devolve um texto. */
export function answer(model, question) {
  const q = question.toLowerCase();
  const a = model.pregnancy ? answerPregnancy(model, q) : model.ctx ? answerCycle(model, q) : null;
  return a ?? 'Por enquanto respondo só as perguntas sugeridas, com os dados deste aparelho. Perguntas livres chegam com a assistente de IA.';
}
