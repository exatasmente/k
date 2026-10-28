import { SYNC_TAG } from './reminders.js';

// Ponte com o navegador para os lembretes. Sem servidor, a notificação fora do app
// depende da sincronização periódica (Chrome/Android com o app instalado); no resto,
// os avisos aparecem dentro do app e a agenda (.ics) é o caminho confiável.

const DAY_MS = 24 * 60 * 60 * 1000;

const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

/**
 * O que este aparelho permite.
 * @returns {Promise<'unsupported'|'ios_install'|'denied'|'needs_permission'|'foreground'|'background'>}
 */
export async function notificationSupport() {
  if (!('serviceWorker' in navigator) || typeof Notification === 'undefined') return isIOS() && !isStandalone() ? 'ios_install' : 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission !== 'granted') return 'needs_permission';
  return (await backgroundAllowed()) ? 'background' : 'foreground';
}

async function backgroundAllowed() {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg || !('periodicSync' in reg)) return false;
    const status = await navigator.permissions.query({ name: 'periodic-background-sync' });
    return status.state === 'granted';
  } catch {
    return false;
  }
}

/** Pede permissão. Chame direto no toque, sem `await` antes. */
export async function requestNotifications() {
  return (await Notification.requestPermission()) === 'granted';
}

/** Liga (de novo) a sincronização periódica; o navegador decide o horário. */
export async function registerBackground() {
  if (!(await backgroundAllowed())) return false;
  const reg = await navigator.serviceWorker.ready;
  await reg.periodicSync.register(SYNC_TAG, { minInterval: DAY_MS / 2 });
  return true;
}

export async function disableBackground() {
  const reg = await navigator.serviceWorker?.getRegistration();
  await reg?.periodicSync?.unregister(SYNC_TAG).catch(() => {});
}

export const SUPPORT_TEXT = {
  unsupported: 'Este navegador não mostra notificações. Os avisos aparecem dentro do app; para ser lembrada fora dele, use a agenda abaixo.',
  ios_install: 'No iPhone, as notificações de sites só funcionam com o app na Tela de Início (Compartilhar → Adicionar à Tela de Início). Mesmo assim, sem servidor, elas não chegam com o app fechado: use a agenda abaixo.',
  denied: 'As notificações estão bloqueadas para este site nas configurações do navegador.',
  needs_permission: 'O navegador vai pedir permissão para mostrar notificações.',
  foreground: 'Neste aparelho o navegador só deixa avisar com o app aberto ou em segundo plano recente. Para não depender disso, adicione as previsões à agenda.',
  background: 'Ligado. O navegador escolhe o horário da verificação diária, então o aviso pode chegar com algumas horas de diferença.',
};
