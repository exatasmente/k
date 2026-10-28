import { addMonths } from './dates.js';
import { getItem, isKnownCode } from './catalog.js';
import { classifyRegularity, normalRangeForAge } from './regularity.js';
import { bleedingFromMethod } from './contraception.js';

// Regras determinísticas de alerta. Rodam localmente, sem IA: a IA pode
// explicar um alerta, mas nunca é ela quem decide se ele existe.

export const EC_MAX_PER_CYCLE = 1;
export const EC_MAX_PER_12_MONTHS = 3;

/**
 * RN03 em dois tons (ver regularity.js). Depois de uma gestação os primeiros
 * ciclos costumam ser irregulares: o aviso fica pausado até haver 3 ciclos novos.
 * Com método hormonal o padrão de sangramento é do método, não do ciclo: não avalia.
 * @param {{cycles: {start: string, length: number}[], stages: {end: string|null}[]}} ctx
 * @param {{age?: number|null, method?: string}} [who]
 */
export function irregularity(ctx, { age = null, method } = {}) {
  if (method && bleedingFromMethod(method)) return { kind: 'method', last: [] };
  const lastStageEnd = ctx.stages.reduce((max, s) => (s.end && s.end > max ? s.end : max), '');
  const ongoingStage = ctx.stages.some((s) => s.end == null);
  const cycles = lastStageEnd ? ctx.cycles.filter((c) => c.start >= lastStageEnd) : ctx.cycles;
  if (ongoingStage || (lastStageEnd && cycles.length < 3)) return { kind: 'paused', last: [] };
  return classifyRegularity(cycles.map((c) => c.length), normalRangeForAge(age));
}

/**
 * RN04: pílula do dia seguinte 2+ vezes no mesmo ciclo ou mais de 3 vezes em 12 meses.
 * Avaliada no ciclo de `onDate` (o dia do registro que acabou de ser feito).
 * @param {string[]} ecDates datas com `emergency_contraception`
 */
export function emergencyContraceptionAlert(ctx, ecDates, onDate = ctx.today) {
  const cycleStart = [...ctx.periods].reverse().find((p) => p.start <= onDate)?.start;
  const nextStart = ctx.periods.find((p) => p.start > onDate)?.start;
  const yearAgo = addMonths(onDate, -12);
  const unique = [...new Set(ecDates)];

  const inCycle = cycleStart
    ? unique.filter((d) => d >= cycleStart && (nextStart == null || d < nextStart) && d <= onDate).length
    : 0;
  const in12Months = unique.filter((d) => d > yearAgo && d <= onDate).length;

  const reasons = [];
  if (inCycle > EC_MAX_PER_CYCLE) reasons.push('same_cycle');
  if (in12Months > EC_MAX_PER_12_MONTHS) reasons.push('twelve_months');
  return { triggered: reasons.length > 0, priority: 'high', reasons, inCycle, in12Months };
}

/**
 * Sinais de alerta da gestação marcados num dia: viram "Procure atendimento"
 * na Home e no registro. Fora da gestação nunca dispara.
 * @param {Iterable<string>} dayCodes
 * @param {'cycle'|'pregnancy'} stage
 */
export function pregnancyAlert(dayCodes, stage) {
  if (stage !== 'pregnancy') return { triggered: false, codes: [] };
  const codes = [...dayCodes].filter((c) => isKnownCode(c) && getItem(c).alert);
  return { triggered: codes.length > 0, priority: 'urgent', codes };
}

// Textos ficam aqui para que app e IA mostrem exatamente a mesma mensagem.
// Cada texto tem fontes (COPY_SOURCES, ver sources.js e docs/fontes-clinicas.md).
// Ainda PENDENTE de revisão por profissional de saúde antes de abrir para terceiras.
export const COPY = Object.freeze({
  irregular:
    'Seus últimos ciclos variaram mais do que o esperado para a sua idade entre o mais curto e o mais longo. ' +
    'Isso pode acontecer, mas vale compartilhar este histórico com sua ginecologista.',
  outlier:
    'Um ciclo saiu do padrão, mas os outros ficaram próximos. Isso pode acontecer de vez em quando; ' +
    'se repetir, vale mostrar este histórico à sua ginecologista.',
  paused:
    'Depois do parto, principalmente se você amamenta, a menstruação pode demorar a voltar. ' +
    'Dá para engravidar antes da primeira menstruação. Voltamos a avaliar a regularidade quando houver 3 ciclos novos.',
  methodBleeding:
    'Com métodos hormonais a menstruação pode mudar, ficar irregular ou parar, e isso costuma ser efeito do método, ' +
    'não um problema. Por isso o app não avalia a regularidade.',
  emergencyContraception:
    'Você usou a pílula do dia seguinte algumas vezes em pouco tempo. Ela é segura e pode ser usada de novo quando precisar. ' +
    'Mas usar com frequência costuma bagunçar a menstruação, deixa as previsões menos precisas e protege menos do que ' +
    'um método de uso contínuo. Se quiser, uma consulta pode ajudar a escolher um método que combine com a sua rotina.',
  emergencyContraceptionTiming:
    'Quanto antes, melhor ela funciona. A bula indica até 72 horas; a OMS considera até 5 dias, com eficácia menor. ' +
    'Se a menstruação atrasar mais de 7 dias, faça um teste de gravidez.',
  pregnancyUrgent:
    'Busque atendimento imediatamente: a UBS, sua maternidade de referência ou um serviço de urgência. ' +
    'Se precisar, acione o SAMU (192).',
  postpartumWarning:
    'No pós-parto, procure atendimento imediatamente se tiver: sangramento que encharca o absorvente rapidamente ou com mau cheiro; ' +
    'febre (37,8 °C ou mais); dor forte que não passa na barriga, nos pontos ou na cicatriz; dor de cabeça forte ou alteração na visão; ' +
    'inchaço repentino; dor no peito, falta de ar ou desmaio; dor, calor ou inchaço em uma perna; convulsão; ' +
    'ou tristeza intensa e pensamentos de machucar a si mesma ou ao bebê. Se precisar, acione o SAMU (192).',
  lochia:
    'Nas primeiras 6 semanas depois do parto, o sangramento costuma ser o lóquio, o sangramento normal do pós-parto, ' +
    'e não menstruação. É menstruação mesmo?',
  postTerm:
    'Com 41 semanas, procure sua maternidade de referência para avaliação, mesmo sem sinais de parto.',
  longAbsence:
    'Faz mais de 3 meses sem menstruação registrada. Se não há chance de gravidez e você não está amamentando, ' +
    'vale conversar com sua ginecologista.',
  prolonged:
    'Sua menstruação passou de 8 dias. Menstruação mais longa que isso merece avaliação: vale conversar com sua ginecologista. ' +
    'Se ela já parou, toque em "Terminou".',
  prolongedPast:
    'Sua última menstruação durou mais de 8 dias. Menstruação mais longa que isso merece avaliação: vale conversar com sua ginecologista.',
  intermenstrual:
    'Sangramento fora da menstruação ou depois da relação merece avaliação. Vale marcar uma consulta com sua ginecologista.',
  heavyFlow:
    'Se o fluxo atrapalha seu dia a dia, ou se você encharca um absorvente por hora durante várias horas seguidas, procure avaliação. ' +
    'Se sentir tontura, fraqueza ou desmaio, procure atendimento logo.',
  pain:
    'Se a dor atrapalha sua rotina ou vem piorando, vale conversar com sua ginecologista.',
  discharge:
    'Se vier com coceira, ardor, cheiro forte, dor na barriga ou febre, vale procurar avaliação.',
  itch:
    'Se persistir ou vier com secreção diferente, vale procurar avaliação.',
  lateCauses:
    'Estresse, doenças, mudança grande de peso ou exercício muito intenso podem atrasar o ciclo.',
  pregnancyTest:
    'O teste de farmácia pode dar positivo a partir do dia em que a menstruação deveria vir, mas é mais confiável uma a duas semanas depois. ' +
    'O exame de sangue (beta-hCG) detecta um pouco antes. Se der negativo e a menstruação não vier, repita em alguns dias ou procure a UBS.',
  fertileEstimate:
    'É só uma estimativa e não serve para evitar gravidez: a ovulação pode vir antes ou depois, mesmo em ciclos regulares. ' +
    'Até métodos de calendário ensinados por profissionais falham para cerca de 15 a 20 em cada 100 mulheres por ano.',
  fertileUnreliable:
    'Seus ciclos variaram 10 dias ou mais: a estimativa da janela fértil fica pouco confiável.',
  ovulationUncertain:
    'Com esse método a ovulação pode ou não acontecer, e a proteção vem do método. Por isso o app não mostra janela fértil.',
  iudProtects:
    'Seu DIU protege em todos os dias do ciclo; a janela fértil aqui é só informativa.',
  dueDate:
    'É uma estimativa: só cerca de 5 em cada 100 bebês nascem nesse dia. O ultrassom do início da gestação costuma ser ' +
    'o jeito mais preciso de datar, e o pré-natal pode ajustar a data.',
  pregnancyMedicine:
    'Na gestação eu não indico nem avalio remédios, chás ou suplementos, mesmo os mais comuns. Quem pode dizer o que é seguro ' +
    'para você é sua equipe do pré-natal ou o farmacêutico. Também não pare por conta própria um remédio que você já usa: converse com a equipe.',
  // Aparece na tela de bloqueio: não pode revelar do que se trata.
  periodConfirmationNotification: 'Tem um registro esperando sua confirmação.',
});

/** De onde vem cada texto (ids de sources.js). Todo texto de saúde precisa de fonte. */
export const COPY_SOURCES = Object.freeze({
  irregular: ['figo_2018', 'acog_aub'],
  outlier: ['figo_2018'],
  paused: ['nhs_after_birth', 'ms_caderneta_2026'],
  methodBleeding: ['cdc_spr_2024', 'who_fp_handbook_2022'],
  emergencyContraception: ['who_ec', 'who_fp_handbook_2022', 'ms_ae_2011'],
  emergencyContraceptionTiming: ['who_ec', 'ms_ae_2011', 'who_fp_handbook_2022'],
  pregnancyUrgent: ['ms_caderneta_2026', 'ms_cab32_2012', 'cdc_hear_her'],
  postpartumWarning: ['ms_caderneta_2026', 'cdc_hear_her'],
  postTerm: ['ms_cab32_2012'],
  lochia: ['ms_caderneta_2026'],
  longAbsence: ['aafp_amenorrhea_2019', 'nhs_missed_periods', 'ms_mulheres_2016'],
  prolonged: ['figo_2018', 'acog_hmb'],
  prolongedPast: ['figo_2018', 'acog_hmb'],
  intermenstrual: ['figo_2018', 'acog_aub', 'ms_mulheres_2016'],
  heavyFlow: ['acog_hmb', 'figo_2018', 'ms_mulheres_2016'],
  pain: ['nice_ng73', 'acog_dysmenorrhea'],
  discharge: ['acog_vaginitis', 'ms_mulheres_2016'],
  itch: ['acog_vaginitis'],
  lateCauses: ['nhs_missed_periods', 'ms_mulheres_2016'],
  pregnancyTest: ['nhs_pregnancy_test', 'ms_cab32_2012'],
  fertileEstimate: ['wilcox_2000', 'who_fp_handbook_2022', 'ms_cab26_2013'],
  fertileUnreliable: ['ms_cab26_2013'],
  ovulationUncertain: ['fsrh_iuc_2023', 'fsrh_pop_2022'],
  iudProtects: ['who_fp_handbook_2022'],
  dueDate: ['khambalia_2013', 'ms_cab32_2012'],
  pregnancyMedicine: ['ms_cab32_2012', 'ms_caderneta_2026', 'anvisa_rdc47_2009'],
});
