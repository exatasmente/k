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
  return req(open);
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
 * @param {{indexedDB?: IDBFactory, crypto?: Crypto, now?: () => string, name?: string}} [opts]
 */
export async function openRepository(opts = {}) {
  const idb = opts.indexedDB ?? globalThis.indexedDB;
  const cryptoImpl = opts.crypto ?? globalThis.crypto;
  const now = opts.now ?? (() => new Date().toISOString());
  const name = opts.name ?? DB_NAME;

  let db = await openDb(idb, name);
  const key = await loadOrCreateKey(db, cryptoImpl);

  /** @type {Record<string, Map<string, object>>} memória decifrada, inclui lápides */
  const memory = {};
  for (const store of Object.keys(STORES)) {
    memory[store] = new Map();
    const rows = await req(db.transaction(store).objectStore(store).getAll());
    for (const row of rows) memory[store].set(row.id, await decryptJSON(key, row, cryptoImpl.subtle));
  }

  async function write(store, records) {
    const rows = [];
    for (const r of records) rows.push({ id: r.id, ...(await encryptJSON(key, r, cryptoImpl)) });
    const tx = db.transaction(store, 'readwrite');
    for (const row of rows) tx.objectStore(store).put(row);
    await done(tx);
    for (const r of records) memory[store].set(r.id, r);
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
      const stamped = records.map((r) => ({ deletedAt: null, ...r, updatedAt: now() }));
      for (const r of stamped) {
        const problems = validate[store](r);
        if (problems.length) throw new ValidationError(store, problems);
      }
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

    async importJSON(backup) {
      if (backup?.format !== EXPORT_FORMAT) throw new Error('Arquivo não é um backup deste app.');
      for (const store of Object.keys(STORES)) {
        const records = backup.stores?.[store] ?? [];
        if (records.length) await this.put(store, ...records);
      }
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
