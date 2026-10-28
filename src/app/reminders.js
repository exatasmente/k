import { addDays } from '../domain/dates.js';
import { irregularity } from '../domain/rules.js';
import { fmt, fmtShort } from './views.js';

// Lembretes, sem servidor. O app aberto calcula o plano (o que avisar e em que dia)
// e grava cifrado no aparelho; o service worker só lê o plano e mostra o que venceu.
// Remédio na hora certa (pílula) fica de fora de propósito: sem servidor, o navegador
// não garante horário, e um lembrete de pílula que falha é pior que nenhum.

/** Tag da sincronização periódica e das mensagens app ↔ service worker. */
export const SYNC_TAG = 'lembretes';

export const REMINDER_DEFAULTS = Object.freeze({ enabled: false, details: false, daysBefore: 2 });

/** Lembrete vencido há mais que isto não aparece mais (ex.: celular desligado por dias). */
export const STALE_DAYS = 3;

// Aparece na tela de bloqueio: por padrão não diz do que se trata.
const DISCREET = { title: 'Ciclo', body: 'Você tem um lembrete. Toque para abrir.' };

export const reminderPrefs = (model) => ({ ...REMINDER_DEFAULTS, ...model.profile?.reminders });

const lastCycleStart = (ctx) => ctx.cycles.at(-1)?.start;

/**
 * Próximos lembretes a partir do modelo. Puro.
 * @returns {{key: string, kind: string, date: string, title: string, body: string}[]}
 */
export function planReminders(model) {
  const prefs = reminderPrefs(model);
  if (!prefs.enabled || !model.ctx) return [];
  const { today, ctx, prediction } = model;
  const items = [];
  const add = (kind, context, date, title, body) => {
    const text = prefs.details ? { title, body } : DISCREET;
    items.push({ key: `${kind}|${context}`, kind, date: date < today ? today : date, ...text });
  };

  if (model.pregnancy) {
    if (model.consult && model.consult >= today) {
      add('prenatal', model.consult, addDays(model.consult, -1), 'Consulta do pré-natal amanhã', `Marcada para ${fmt(model.consult)}.`);
    }
    return items;
  }

  // Um aviso por ciclo, mesmo que a previsão mude depois de novos registros.
  const lastStart = [...ctx.periods].reverse().find((p) => p.start <= today)?.start;
  if (prediction?.mode === 'cycle' && prediction.status === 'before' && lastStart && !model.openPeriod) {
    const from = prediction.window.from;
    add('period_soon', lastStart, addDays(from, -prefs.daysBefore), 'Menstruação chegando',
      `Pela previsão, pode começar a partir de ${fmtShort(from)}.`);
  }

  // RF01.4: começou e não terminou em 10 dias.
  const open = model.openPeriod ?? ctx.pendingConfirmation.at(-1);
  if (open) {
    add('confirm_end', open.start, addDays(open.start, 10), 'Sua menstruação terminou?',
      `Ela está marcada desde ${fmt(open.start)}. Toque para confirmar o último dia.`);
  }

  // RN03: avisa uma vez por ciclo completo enquanto a classificação for irregular.
  const cycleStart = lastCycleStart(ctx);
  if (irregularity(ctx).kind === 'irregular' && !model.dismissed.has(`irregular|${cycleStart}`)) {
    add('irregular', cycleStart, today, 'Seus ciclos variaram bastante',
      'Vale mostrar o histórico à sua ginecologista. Toque para ver o resumo.');
  }
  return items;
}

/** O que mostrar agora: venceu, não é velho demais e ainda não foi mostrado. */
export function dueReminders(items, shownKeys, today) {
  const oldest = addDays(today, -STALE_DAYS);
  return items.filter((i) => i.date <= today && i.date >= oldest && !shownKeys.has(i.key));
}

// ---------------------------------------------------------------- Agenda (.ics)

/**
 * Previsões que valem ir para a agenda. Com atraso ou muito tempo sem menstruação
 * a previsão é só "a partir de amanhã": não vale gravar datas que vão mudar.
 */
export function calendarPredictions(model) {
  const p = model.prediction;
  if (model.pregnancy || p?.mode !== 'cycle' || !['before', 'expected'].includes(p.status)) return [];
  return p.upcoming.filter((u) => u.end >= model.today);
}

const icsDate = (iso) => iso.replaceAll('-', '');
const icsText = (s) => s.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');

/**
 * Previsões das próximas menstruações como eventos de dia inteiro com alarme.
 * Sem janela fértil: na agenda ela pareceria um método contraceptivo.
 * @param {{details?: boolean, daysBefore?: number, stamp?: string}} [opts] stamp: data-hora UTC (testes)
 */
export function buildICS(model, { details = false, daysBefore = 2, stamp = new Date().toISOString() } = {}) {
  const upcoming = calendarPredictions(model);
  const dtstamp = stamp.replace(/[-:]/g, '').replace(/\.\d+/, '');
  // Dia inteiro começa à meia-noite; o alarme fica às 9h de `daysBefore` dias antes.
  const trigger = daysBefore > 1 ? `-P${daysBefore - 1}DT15H` : '-PT15H';
  const title = details ? 'Menstruação prevista' : 'Ciclo';
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Ciclo//Previsoes//PT-BR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  upcoming.forEach((u, i) => {
    lines.push(
      'BEGIN:VEVENT',
      `UID:ciclo-previsao-${i + 1}@local`, // o mesmo id ao baixar de novo: a agenda atualiza em vez de duplicar
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${icsDate(u.start)}`,
      `DTEND;VALUE=DATE:${icsDate(addDays(u.end, 1))}`,
      `SUMMARY:${icsText(title)}`,
      ...(details ? [`DESCRIPTION:${icsText('Estimativa do app Ciclo. Não serve como método contraceptivo.')}`] : []),
      'TRANSP:TRANSPARENT',
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsText(title)}`, `TRIGGER;RELATED=START:${trigger}`, 'END:VALARM',
      'END:VEVENT',
    );
  });
  lines.push('END:VCALENDAR');
  return `${lines.join('\r\n')}\r\n`;
}
