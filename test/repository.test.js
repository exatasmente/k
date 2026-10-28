import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { openRepository, ValidationError } from '../src/data/repository.js';
import { entryId } from '../src/data/schema.js';

const entry = (date, code) => ({ id: entryId(date, code), date, code, source: 'user' });

test('grava cifrado e lê de volta ao reabrir', async () => {
  const indexedDB = new IDBFactory();
  const repo = await openRepository({ indexedDB });
  await repo.put('entries', entry('2026-10-28', 'cramps'));
  await repo.put('profile', { id: 'me', birthDate: '1996-05-12' });

  const again = await openRepository({ indexedDB });
  assert.equal(again.all('entries').length, 1);
  assert.equal(again.get('profile', 'me').birthDate, '1996-05-12');
});

test('nada legível no banco além do id', async () => {
  const indexedDB = new IDBFactory();
  const repo = await openRepository({ indexedDB });
  await repo.put('entries', entry('2026-10-28', 'emergency_contraception'));
  const raw = await new Promise((resolve) => {
    const open = indexedDB.open('ciclo');
    open.onsuccess = () => {
      const r = open.result.transaction('entries').objectStore('entries').getAll();
      r.onsuccess = () => { resolve(r.result); open.result.close(); };
    };
  });
  assert.equal(raw.length, 1);
  assert.deepEqual(Object.keys(raw[0]).sort(), ['data', 'id', 'iv']);
  const bytes = new Uint8Array(raw[0].data);
  assert.ok(!new TextDecoder().decode(bytes).includes('emergency'), 'conteúdo cifrado');
});

test('valida antes de gravar', async () => {
  const repo = await openRepository({ indexedDB: new IDBFactory() });
  await assert.rejects(repo.put('profile', { id: 'me', email: 'a@b.c' }), ValidationError);
  await assert.rejects(repo.put('entries', entry('2026-10-28', 'inventado')), ValidationError);
  assert.equal(repo.all('entries').length, 0);
});

test('remover deixa lápide e some das leituras', async () => {
  const indexedDB = new IDBFactory();
  const repo = await openRepository({ indexedDB });
  const e = entry('2026-10-28', 'cramps');
  await repo.put('entries', e);
  await repo.remove('entries', e.id);
  assert.equal(repo.all('entries').length, 0);
  assert.equal(repo.get('entries', e.id), undefined);
  const again = await openRepository({ indexedDB });
  assert.equal(again.all('entries').length, 0, 'lápide persiste');
});

test('backup em JSON e restauração', async () => {
  const repo = await openRepository({ indexedDB: new IDBFactory() });
  await repo.put('entries', entry('2026-10-28', 'cramps'), entry('2026-10-28', 'headache'));
  const backup = repo.exportJSON();
  assert.equal(backup.stores.entries.length, 2);

  const other = await openRepository({ indexedDB: new IDBFactory() });
  await other.importJSON(JSON.parse(JSON.stringify(backup)));
  assert.equal(other.all('entries').length, 2);
  await assert.rejects(other.importJSON({ format: 'outro' }));
});

test('apagar tudo remove dados e chave', async () => {
  const indexedDB = new IDBFactory();
  const repo = await openRepository({ indexedDB });
  await repo.put('entries', entry('2026-10-28', 'cramps'));
  await repo.wipe();
  const fresh = await openRepository({ indexedDB });
  assert.equal(fresh.all('entries').length, 0);
});
