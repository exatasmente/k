// Service worker: deixa o app abrir offline (RNF06) e mostra os lembretes.
// Navegação: rede primeiro, cache se offline. Arquivos do build (com hash): cache primeiro.
// Nenhum dado de saúde passa pela rede: os dados ficam no IndexedDB, cifrados.
// Empacotado pelo vite.config.js (esbuild) em dist/sw.js.

import { openRepository } from './data/repository.js';
import { DB_NAME, dismissalId } from './data/schema.js';
import { today as localToday } from './domain/dates.js';
import { dueReminders, SYNC_TAG } from './app/reminders.js';

const CACHE = 'ciclo-v2';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './index.html', './manifest.webmanifest', './icon.svg'])));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          event.waitUntil(caches.open(CACHE).then((c) => c.put('./index.html', copy)));
          return res;
        })
        .catch(() => caches.match('./index.html')),
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        event.waitUntil(caches.open(CACHE).then((c) => c.put(req, copy)));
      }
      return res;
    })),
  );
});

// ---------------------------------------------------------------- Lembretes
// O app aberto grava o plano (store `reminders`); aqui só se lê o plano, mostra o que
// venceu e marca como mostrado. Sem servidor: quem acorda o service worker é a
// sincronização periódica do navegador (Android/Chrome com o app instalado).

async function showDue(today = localToday()) {
  // Banco apagado ("Apagar meus dados"): não recria um banco vazio só para olhar.
  const dbs = await indexedDB.databases?.();
  if (dbs && !dbs.some((d) => d.name === DB_NAME)) return 0;
  const repo = await openRepository();
  try {
    if (!repo.get('profile', 'me')?.reminders?.enabled) return 0;
    const shown = new Set(repo.all('dismissals').filter((d) => d.rule === 'notified').map((d) => d.context));
    const due = dueReminders(repo.get('reminders', 'plan')?.items ?? [], shown, today);
    for (const r of due) {
      await self.registration.showNotification(r.title, { body: r.body, tag: r.key, icon: 'icon.svg', lang: 'pt-BR' });
    }
    if (due.length) {
      await repo.put('dismissals', ...due.map((r) => ({ id: dismissalId('notified', r.key), rule: 'notified', context: r.key })));
    }
    return due.length;
  } finally {
    repo.close();
  }
}

self.addEventListener('periodicsync', (event) => {
  if (event.tag === SYNC_TAG) event.waitUntil(showDue().catch(() => 0));
});

// O app pode pedir uma verificação (usado nos testes, que controlam a data).
self.addEventListener('message', (event) => {
  if (event.data?.type !== SYNC_TAG) return;
  event.waitUntil(showDue(event.data.today).then(
    (shown) => event.source?.postMessage({ type: SYNC_TAG, shown }),
    (err) => event.source?.postMessage({ type: SYNC_TAG, error: String(err?.message ?? err) }),
  ));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((wins) => (wins[0] ? wins[0].focus() : self.clients.openWindow('./'))),
  );
});
