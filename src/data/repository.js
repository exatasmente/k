import { DB_NAME, DB_VERSION, STORES, upgrade, validate } from './schema.js';
import { decryptJSON, encryptJSON, generateKey } from './crypto.js';

// Repositório local: abre o IndexedDB, decifra tudo em memória e grava cada
// mudança cifrada. As telas leem da memória (síncrono); só escrita é assíncrona.

const KEY_STORE = 'keys';
const DEVICE_KEY_ID = 'device';
export const EXPORT_FORMAT = 'ciclo-backup';
export const EXPORT_VERSION = 1;

const req = (r) => new Promise((resolve, reject) => {
  r.onsuccess = () => resolve(r.result);
  r.onerror = () => reject(r.error);
});

const done = (tx) => new Promise((resolve, reject) => {
  tx.oncomplete = () => resolve();
  tx.onerror = () => reject(tx.error);
  tx.onabort = () => reject(tx.error);
});

export function openDb(idb = globalThis.indexedDB, name = DB_NAME) {
  const open = idb.open(name, DB_VERSION);
  open.onupgradeneeded = () => {
    const db = open.result;
    upgrade(db);
    if (!db.objectStoreNames.contains(KEY_STORE)) db.createObjectStore(KEY_STORE, { keyPath: 'id' });
  };
  return req(open).then((db) => {
    // Uma versão nova do app (em outra aba ou no service worker) precisa migrar o banco:
    // esta conexão sai da frente em vez de travar a migração.
    db.onversionchange = () => db.close();
    return db;
  });
}

async function loadOrCreateKey(db, cryptoImpl) {
  const existing = await req(db.transaction(KEY_STORE).objectStore(KEY_STORE).get(DEVICE_KEY_ID));
  if (existing) return existing.key;
  const key = await generateKey(cryptoImpl.subtle);
  const tx = db.transaction(KEY_STORE, 'readwrite');
  tx.objectStore(KEY_STORE).put({ id: DEVICE_KEY_ID, key });
  await done(tx);
  return key;
}

export class ValidationError extends Error {
  constructor(store, problems) {
    super(`Registro inválido em ${store}: ${problems.join('; ')}`);
    this.problems = problems;
  }
}

/**
 * @param {{indexedDB?: IDBFactory, crypto?: Crypto, now?: () => string, name?: string, onVersionChange?: () => void}} [opts]
 *   onVersionChange: o banco foi apagado ou migrado por outra aba; esta conexão fechou.
 */
export async function openRepository(opts = {}) {
  const idb = opts.indexedDB ?? globalThis.indexedDB;
  const cryptoImpl = opts.crypto ?? globalThis.crypto;
  const now = opts.now ?? (() => new Date().toISOString());
  const name = opts.name ?? DB_NAME;

  let db = await openDb(idb, name);
  db.onversionchange = () => { db.close(); opts.onVersionChange?.(); };
  const key = await loadOrCreateKey(db, cryptoImpl);

  /** @type {Record<string, Map<string, object>>} memória decifrada, inclui lápides */
  const memory = {};
  for (const store of Object.keys(STORES)) {
    memory[store] = new Map();
    const rows = await req(db.transaction(store).objectStore(store).getAll());
    for (const row of rows) memory[store].set(row.id, await decryptJSON(key, row, cryptoImpl.subtle));
  }

  /** Grava em uma transação só: ou tudo, ou nada. @param {Record<string, object[]>} changes */
  async function writeAll(changes) {
    const names = Object.keys(changes).filter((s) => changes[s].length);
    if (!names.length) return;
    const rows = {};
    for (const s of names) {
      rows[s] = [];
      for (const r of changes[s]) rows[s].push({ id: r.id, ...(await encryptJSON(key, r, cryptoImpl)) });
    }
    const tx = db.transaction(names, 'readwrite');
    for (const s of names) for (const row of rows[s]) tx.objectStore(s).put(row);
    await done(tx);
    for (const s of names) for (const r of changes[s]) memory[s].set(r.id, r);
  }

  const write = (store, records) => writeAll({ [store]: records });

  function stampAndCheck(store, records) {
    const stamped = records.map((r) => ({ deletedAt: null, ...r, updatedAt: now() }));
    for (const r of stamped) {
      const problems = validate[store]?.(r);
      if (!problems) throw new Error(`Store desconhecido: ${store}`);
      if (problems.length) throw new ValidationError(store, problems);
    }
    return stamped;
  }

  return {
    /** Registros ativos (sem lápide) de um store. */
    all(store) {
      return [...memory[store].values()].filter((r) => r.deletedAt == null);
    },

    get(store, id) {
      const r = memory[store].get(id);
      return r && r.deletedAt == null ? r : undefined;
    },

    /** Grava (cria ou substitui) registros já validados. */
    async put(store, ...records) {
      const stamped = stampAndCheck(store, records);
      await write(store, stamped);
      return stamped;
    },

    /** Exclusão lógica (lápide), para uma futura sincronização não ressuscitar o registro. */
    async remove(store, ...ids) {
      const stamp = now();
      const records = ids.map((id) => memory[store].get(id)).filter(Boolean).map((r) => ({ ...r, deletedAt: stamp, updatedAt: stamp }));
      if (records.length) await write(store, records);
    },

    /** Backup em JSON, decifrado, para ela guardar onde quiser. */
    exportJSON() {
      const stores = {};
      for (const store of Object.keys(STORES)) stores[store] = this.all(store);
      return { format: EXPORT_FORMAT, version: EXPORT_VERSION, exportedAt: now(), stores };
    },

    /**
     * Restaura um backup no lugar dos dados atuais (não soma: dois métodos vigentes ou
     * menstruações em dobro mudariam as previsões). Valida tudo antes e grava numa
     * transação só: um registro inválido não deixa o banco pela metade.
     */
    async importJSON(backup) {
      if (backup?.format !== EXPORT_FORMAT) throw new Error('Arquivo não é um backup deste app.');
      const changes = {};
      for (const store of Object.keys(STORES)) {
        const incoming = stampAndCheck(store, backup.stores?.[store] ?? []);
        const keep = new Set(incoming.map((r) => r.id));
        const stamp = now();
        const gone = this.all(store).filter((r) => !keep.has(r.id)).map((r) => ({ ...r, deletedAt: stamp, updatedAt: stamp }));
        changes[store] = [...gone, ...incoming];
      }
      await writeAll(changes);
    },

    /** Fecha a conexão (o service worker abre, lê e fecha). */
    close() {
      db?.close();
    },

    /** Apaga o banco inteiro, inclusive a chave. Sem volta. */
    async wipe() {
      db.close();
      await req(idb.deleteDatabase(name));
      for (const store of Object.keys(memory)) memory[store].clear();
      db = null;
    },
  };
}
