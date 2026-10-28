import { assertDate } from '../domain/dates.js';
import { isKnownCode } from '../domain/catalog.js';
import { METHODS } from '../domain/contraception.js';

// Esquema do banco local (IndexedDB) do PWA. O aparelho é a fonte da verdade;
// não há conta nem servidor no MVP (ver docs/adr/0001-arquitetura-mvp.md).
//
// Criptografia em repouso (RNF02): cada registro é gravado como envelope
// {id, iv, data}, com `data` cifrado em AES-GCM 256 por uma chave do aparelho.
// Por isso nenhum store tem índice além do `id`: índices por data ou código
// vazariam o conteúdo. O app carrega e decifra tudo em memória ao abrir
// (alguns anos de uso cabem em poucos MB) e grava de volta a cada mudança.
//
// Todo registro tem `updatedAt` (ISO 8601) e `deletedAt` (lápide, null se ativo),
// para uma sincronização futura por "última escrita vence" sem perder exclusões.

export const DB_NAME = 'ciclo';
export const DB_VERSION = 1;

/**
 * Formato decifrado de cada store. `id` é estável e determinístico quando o
 * registro tem chave natural, para dois toques no mesmo ícone serem o mesmo registro.
 */
export const STORES = Object.freeze({
  // Um único registro, id 'me'. Sem nome, e-mail, telefone ou foto.
  profile: { id: 'me', fields: ['birthDate', 'onboarding', 'defaultMethod', 'aiEnabled', 'hiddenCategories'] },
  // Um registro por (dia, código): o toque liga/desliga via deletedAt.
  entries: { id: 'date|code', fields: ['date', 'code', 'source'] },
  // Menstruações. Fonte da verdade do ciclo; fluxo diário é anotação em `entries`.
  periods: { id: 'uuid', fields: ['start', 'end', 'source', 'confirmed'] },
  // Histórico do método contraceptivo com vigência (RN01, consultas históricas).
  methods: { id: 'uuid', fields: ['method', 'from', 'to'] },
  // Gestação e pós-parto. Só datas e método de datação; nunca o desfecho.
  stages: { id: 'uuid', fields: ['stage', 'start', 'end', 'dating', 'dueDate'] },
  // "Teve X neste ciclo?" respondido ao fim da menstruação. "Não lembro" não é gravado.
  cycleAnswers: { id: 'cycleStart|code', fields: ['cycleStart', 'code', 'answer'] },
  // Consultas do pré-natal (e, no futuro, outras).
  appointments: { id: 'uuid', fields: ['date', 'kind'] },
  // Alertas que ela já viu ("Ok" no alerta da PDS), para não repetir no mesmo contexto.
  dismissals: { id: 'rule|context', fields: ['rule', 'context'] },
});

export const entryId = (date, code) => `${date}|${code}`;
export const cycleAnswerId = (cycleStart, code) => `${cycleStart}|${code}`;
export const dismissalId = (rule, context) => `${rule}|${context}`;

const ENTRY_SOURCES = ['user', 'period_answer', 'import'];
const PERIOD_SOURCES = ['onboarding', 'user', 'auto', 'import'];
const STAGES = ['pregnancy', 'postpartum'];

function isDate(v) {
  try { assertDate(v); return true; } catch { return false; }
}

function check(errors, cond, msg) { if (!cond) errors.push(msg); }

function common(errors, r) {
  check(errors, typeof r.id === 'string' && r.id.length > 0, 'id obrigatório');
  check(errors, typeof r.updatedAt === 'string', 'updatedAt obrigatório');
  check(errors, r.deletedAt == null || typeof r.deletedAt === 'string', 'deletedAt deve ser null ou data-hora');
}

/** Validadores por store: devolvem a lista de problemas (vazia = válido). */
export const validate = Object.freeze({
  profile(r) {
    const e = [];
    common(e, r);
    check(e, r.id === 'me', "profile tem um único registro, id 'me'");
    check(e, r.birthDate == null || isDate(r.birthDate), 'birthDate inválida');
    check(e, r.defaultMethod == null || r.defaultMethod in METHODS, 'defaultMethod desconhecido');
    for (const banned of ['name', 'email', 'phone', 'photo']) check(e, !(banned in r), `profile não guarda ${banned}`);
    return e;
  },
  entries(r) {
    const e = [];
    common(e, r);
    check(e, isDate(r.date), 'date inválida');
    check(e, isKnownCode(r.code), `código desconhecido: ${r.code}`);
    check(e, r.id === entryId(r.date, r.code), 'id deve ser date|code');
    check(e, ENTRY_SOURCES.includes(r.source), 'source inválido');
    return e;
  },
  periods(r) {
    const e = [];
    common(e, r);
    check(e, isDate(r.start), 'start inválida');
    check(e, r.end == null || (isDate(r.end) && r.end >= r.start), 'end inválida ou antes do start');
    check(e, PERIOD_SOURCES.includes(r.source), 'source inválido');
    return e;
  },
  methods(r) {
    const e = [];
    common(e, r);
    check(e, r.method in METHODS, 'método desconhecido');
    check(e, isDate(r.from), 'from inválida');
    check(e, r.to == null || (isDate(r.to) && r.to >= r.from), 'to inválida ou antes do from');
    return e;
  },
  stages(r) {
    const e = [];
    common(e, r);
    check(e, STAGES.includes(r.stage), 'stage inválido');
    check(e, isDate(r.start), 'start inválida');
    check(e, r.end == null || (isDate(r.end) && r.end >= r.start), 'end inválida ou antes do start');
    if (r.stage === 'pregnancy') {
      check(e, r.dating === 'lmp' || r.dating === 'ultrasound', 'dating deve ser lmp ou ultrasound');
      check(e, isDate(r.dueDate), 'dueDate inválida');
    }
    check(e, !('outcome' in r), 'o desfecho da gestação não é armazenado');
    return e;
  },
  cycleAnswers(r) {
    const e = [];
    common(e, r);
    check(e, isDate(r.cycleStart), 'cycleStart inválida');
    check(e, isKnownCode(r.code), `código desconhecido: ${r.code}`);
    check(e, r.answer === 'yes' || r.answer === 'no', "answer deve ser 'yes' ou 'no'");
    check(e, r.id === cycleAnswerId(r.cycleStart, r.code), 'id deve ser cycleStart|code');
    return e;
  },
  appointments(r) {
    const e = [];
    common(e, r);
    check(e, isDate(r.date), 'date inválida');
    check(e, r.kind === 'prenatal', 'kind desconhecido');
    return e;
  },
  dismissals(r) {
    const e = [];
    common(e, r);
    check(e, typeof r.rule === 'string' && typeof r.context === 'string', 'rule e context obrigatórios');
    check(e, r.id === dismissalId(r.rule, r.context), 'id deve ser rule|context');
    return e;
  },
});

/** Cria os stores (onupgradeneeded). Só `id` como chave, sem índices: ver topo do arquivo. */
export function upgrade(db) {
  for (const name of Object.keys(STORES)) {
    if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
  }
}
