import { after, afterEach, before } from 'node:test';
import { preview } from 'vite';
import { chromium } from 'playwright';
import { addDays } from '../src/domain/dates.js';

// Sobe o build (dist/) com `vite preview` e abre um navegador por suíte.
// Cada cenário usa um contexto novo: banco vazio, celular, fuso de São Paulo
// e relógio controlado (a data passa normalmente a partir de `today`).

export const TODAY = '2026-10-28';

let server;
let browser;
let baseUrl;
const contexts = [];

before(async () => {
  server = await preview({ logLevel: 'silent', preview: { port: 0, strictPort: false } });
  baseUrl = server.resolvedUrls.local[0];
  // Chromium completo (não o headless simplificado): notificações funcionam como no celular.
  browser = await chromium.launch({ channel: 'chromium' });
});

// Um cenário não herda abas abertas do anterior.
afterEach(async () => {
  await Promise.all(contexts.splice(0).map((c) => c.close().catch(() => {})));
});

after(async () => {
  await browser?.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
});

/** Abre o app num contexto limpo. Devolve {page, context, errors, setToday}. */
export async function openApp({ today = TODAY, width = 390, height = 844, colorScheme = 'light' } = {}) {
  const context = await browser.newContext({
    viewport: { width, height }, deviceScaleFactor: 2, hasTouch: true,
    locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', acceptDownloads: true, colorScheme,
  });
  contexts.push(context);
  const page = await context.newPage();
  await page.clock.install({ time: new Date(`${today}T10:00:00-03:00`) });
  await page.clock.resume();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(baseUrl);
  const setToday = async (date) => {
    await page.clock.setSystemTime(new Date(`${date}T10:00:00-03:00`));
    await page.reload();
  };
  return { page, context, errors, setToday };
}

/** Onboarding completo. `lastPeriodStart` pode estar em meses anteriores. */
export async function onboard(page, { lastPeriodStart, cycle = 28, periodLength = 5, birth = '1996-05-12', method = 'Preservativo' } = {}) {
  if (lastPeriodStart) await pickDate(page, lastPeriodStart);
  // O cadastro não pré-marca dia: sem escolha feita antes, usa uma semana antes de TODAY.
  else if (await page.getByRole('button', { name: 'Continuar' }).isDisabled()) await pickDate(page, addDays(TODAY, -7));
  await page.getByRole('button', { name: 'Continuar' }).click();
  const steppers = [[0, cycle, 'duração do ciclo'], [1, periodLength, 'duração da menstruação']];
  for (const [i, target, name] of steppers) {
    const out = page.locator('output').nth(i);
    const value = async () => Number((await out.innerText()).split(' ')[0]);
    while ((await value()) !== target) {
      await page.getByRole('button', { name: `${(await value()) < target ? 'Aumentar' : 'Diminuir'} ${name}` }).click();
    }
  }
  await page.fill('#birth', birth);
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: method, exact: true }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: 'Começar' }).click();
  // A barra de navegação só existe depois do cadastro gravado.
  await page.getByRole('navigation', { name: 'Navegação principal' }).waitFor();
}

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** Navega o calendário do onboarding até o mês e toca no dia. */
export async function pickDate(page, iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const title = `${MONTHS[m - 1][0].toUpperCase()}${MONTHS[m - 1].slice(1)} ${y}`;
  const picker = page.getByRole('group', { name: 'Primeiro dia da última menstruação' });
  await picker.waitFor(); // o app abre o banco antes de mostrar o onboarding
  for (let i = 0; i < 14 && !(await picker.getByText(title, { exact: true }).isVisible()); i++) {
    await picker.getByRole('button', { name: 'Mês anterior' }).click();
  }
  await picker.getByRole('button', { name: new RegExp(`^${d} de ${MONTHS[m - 1]}`) }).click();
}

/** Toque longo (segurar) num elemento. */
export async function longPress(page, locator, ms = 700) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Item do registro pelo nome exato ("Leve" não casa com "Treino leve"). */
export function item(page, label, opts = {}) {
  return page.getByRole('button', { name: new RegExp(`^${escape(label)}(, marcado)?\\. Segure`), ...opts }).first();
}

/** Abre o registro de hoje e toca nos itens pelo nome. */
export async function logToday(page, ...labels) {
  await page.getByRole('button', { name: /Registrar sintomas/ }).click();
  for (const label of labels) await item(page, label).click();
  await page.getByRole('button', { name: 'Pronto' }).click();
}

/** Espera um item do registro ficar marcado (true) ou desmarcado (false). */
export function expectPressed(page, label, pressed) {
  return item(page, label, { pressed }).waitFor({ timeout: 3000 });
}

/** Espera um texto aparecer (ou sumir, com `gone: true`). */
export function expectText(page, text, { gone = false } = {}) {
  return page.getByText(text).first().waitFor({ state: gone ? 'detached' : 'visible', timeout: 3000 });
}

/** Contraste WCAG entre a cor do texto e a do fundo de um elemento. */
export function contrastOf(locator) {
  return locator.evaluate((el) => {
    const rgb = (c) => c.match(/[\d.]+/g).slice(0, 3).map(Number);
    const lum = ([r, g, b]) => {
      const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const s = getComputedStyle(el);
    const [a, b] = [lum(rgb(s.color)), lum(rgb(s.backgroundColor))].sort((x, y) => y - x);
    return (a + 0.05) / (b + 0.05);
  });
}
