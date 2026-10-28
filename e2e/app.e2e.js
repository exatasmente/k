import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { contrastOf, expectPressed, expectText, logToday, longPress, onboard, openApp, pickDate } from './harness.js';

// Cenários de ponta a ponta no app construído (dist/). Data fixa: 28/10/2026.

const ringText = (page) => page.locator('.ring-text').innerText();

test('onboarding: escolhe a última menstruação em um mês anterior', async () => {
  const { page, errors } = await openApp();
  const picker = page.getByRole('group', { name: 'Primeiro dia da última menstruação' });
  assert.equal(await picker.getByRole('button', { name: 'Próximo mês' }).isDisabled(), true, 'não avança além do mês atual');
  assert.equal(await picker.getByRole('button', { name: '29 de outubro' }).isDisabled(), true, 'dia futuro bloqueado');
  await pickDate(page, '2026-09-20');
  assert.match(await page.getByText(/^Começou há/).innerText(), /38 dias/);
  await onboard(page, { cycle: 30 });
  assert.match(await ringText(page), /Dia 39 do ciclo/);
  assert.match(await ringText(page), /Atrasada/);
  assert.deepEqual(errors, []);
});

test('onboarding: volta no máximo 12 meses', async () => {
  const { page } = await openApp();
  const picker = page.getByRole('group', { name: 'Primeiro dia da última menstruação' });
  for (let i = 0; i < 12; i++) await picker.getByRole('button', { name: 'Mês anterior' }).click();
  assert.equal(await picker.getByRole('button', { name: 'Mês anterior' }).isDisabled(), true);
  assert.equal(await picker.getByRole('button', { name: '27 de outubro' }).isDisabled(), true, 'antes do limite fica bloqueado');
  assert.equal(await picker.getByRole('button', { name: '28 de outubro' }).isDisabled(), false);
});

test('menstruação: começa hoje, termina e responde a pergunta da cólica', async () => {
  const { page, errors } = await openApp();
  await pickDate(page, '2026-10-28');
  await onboard(page);
  const period = page.locator('.quick.period');
  assert.match(await period.innerText(), /Menstruando/, 'onboarding com início hoje deixa a menstruação aberta');
  await period.click();
  await page.getByText('Teve cólica nesta menstruação?').waitFor();
  await page.getByRole('button', { name: 'Sim', exact: true }).click();
  await expectText(page, 'Teve cólica nesta menstruação?', { gone: true });
  assert.match(await period.innerText(), /Menstruei/);
  assert.deepEqual(errors, []);
});

test('RF01.4: menstruação aberta há 10+ dias pede confirmação do fim', async () => {
  const { page, setToday, errors } = await openApp();
  await pickDate(page, '2026-09-30');
  await onboard(page);
  await page.locator('.quick.period').click(); // Menstruei em 28/10
  await setToday('2026-11-09');
  const card = page.getByRole('region', { name: 'Confirmar fim da menstruação' });
  await card.waitFor();
  assert.match(await card.innerText(), /começou em 28 de outubro/);
  await card.getByLabel('Último dia de sangramento').fill('2026-11-02');
  await card.getByRole('button', { name: 'Confirmar' }).click();
  await card.waitFor({ state: 'detached' });
  assert.deepEqual(errors, []);
});

test('relação em 1 toque, sem preservativo e PDS duas vezes no ciclo dispara alerta', async () => {
  const { page, setToday, errors } = await openApp({ today: '2026-10-20' });
  await pickDate(page, '2026-10-17');
  await onboard(page);
  await page.locator('.quick.sex').click();
  await page.getByRole('button', { name: 'Sem preservativo' }).click();
  await page.locator('.alert.warn', { hasText: 'sem preservativo' }).waitFor(); // sem proteção destaca a faixa
  await page.getByRole('button', { name: 'Tomei a pílula do dia seguinte' }).click();
  await page.getByRole('button', { name: 'Pílula do dia seguinte registrada' }).waitFor();
  assert.equal(await page.getByText(/vez neste ciclo/).count(), 0, 'uma vez não dispara');
  await setToday('2026-10-28');
  await page.locator('.quick.sex').click();
  await page.getByRole('button', { name: 'Tomei a pílula do dia seguinte' }).click();
  await page.getByText('Esta é a 2ª vez neste ciclo').waitFor();
  await page.getByRole('button', { name: 'Entender melhor' }).click();
  await page.locator('.bubble.ai').nth(1).waitFor();
  assert.match(await page.locator('.bubble.ai').last().innerText(), /2 vezes em 2026/);
  assert.deepEqual(errors, []);
});

test('registro: negação, escolha única, long-press e pergunta à assistente', async () => {
  const { page, errors } = await openApp();
  await onboard(page);
  await page.getByRole('button', { name: /Registrar sintomas/ }).click();
  // Toques rápidos, sem esperar a gravação entre eles.
  await page.locator('.item', { hasText: 'Cólica' }).first().click();
  await page.getByRole('button', { name: /Dia tranquilo/ }).click();
  await page.getByRole('button', { name: /Dia tranquilo/, pressed: true }).waitFor();
  await expectPressed(page, 'Cólica', false); // "Sem sintomas" desmarca os sintomas
  await page.locator('.item', { hasText: 'Leve' }).first().click();
  await page.locator('.item', { hasText: 'Intenso' }).first().click();
  await expectPressed(page, 'Intenso', true);
  await expectPressed(page, 'Leve', false); // fluxo é escolha única
  await longPress(page, page.locator('.item', { hasText: 'Dor de cabeça' }).first());
  await page.getByRole('dialog', { name: 'Dor de cabeça' }).waitFor();
  await page.getByRole('button', { name: 'Voltar ao registro' }).click();
  await expectPressed(page, 'Dor de cabeça', false); // long-press não marca o item
  await longPress(page, page.locator('.item', { hasText: 'Dor de cabeça' }).first());
  await page.getByRole('button', { name: 'Perguntar à assistente' }).click();
  assert.match(await page.locator('.bubble.me').last().innerText(), /Tive dor de cabeça em todos os ciclos\?/);
  assert.deepEqual(errors, []);
});

test('calendário: registrar um dia passado cria a menstruação', async () => {
  const { page, errors } = await openApp();
  await onboard(page);
  await page.getByRole('button', { name: 'Calendário' }).click();
  await page.getByRole('button', { name: /^10(,|$)/ }).click();
  await page.getByRole('button', { name: 'Registrar neste dia' }).click();
  await page.locator('.item', { hasText: 'Médio' }).first().click();
  await page.getByRole('button', { name: 'Pronto' }).click();
  await page.getByRole('button', { name: /^10, menstruação/ }).waitFor();
  assert.match(await page.getByText(/· dia \d+ do ciclo/).innerText(), /Menstruação · dia 1 do ciclo/);
  assert.deepEqual(errors, []);
});

test('editar categorias: esconder Relação tira o atalho da Home', async () => {
  const { page } = await openApp();
  await onboard(page);
  await page.getByRole('button', { name: /Registrar sintomas/ }).click();
  await page.getByRole('button', { name: 'Editar' }).click();
  await page.getByRole('button', { name: 'Esconder Relação & proteção' }).click();
  await page.getByRole('button', { name: 'Mostrar Relação & proteção' }).waitFor();
  await page.getByRole('button', { name: 'Concluir' }).click();
  await page.locator('.jump').waitFor();
  assert.equal(await page.locator('.jump button', { hasText: 'Relação' }).count(), 0);
  await page.getByRole('button', { name: 'Pronto' }).click();
  assert.equal(await page.locator('.quick.sex').count(), 0);
});

test('ajustes: pílula contínua esconde a janela fértil', async () => {
  const { page } = await openApp();
  await onboard(page);
  assert.match(await page.locator('.legend').first().innerText(), /Janela fértil/);
  await page.getByRole('button', { name: 'Ajustes e privacidade' }).click();
  await page.getByRole('button', { name: 'Pílula contínua' }).click();
  await page.getByRole('button', { name: 'Pílula contínua', pressed: true }).waitFor();
  await page.getByRole('button', { name: 'Fechar' }).last().click();
  assert.match(await ringText(page), /Pílula contínua/);
  assert.equal(await page.getByText('Janela fértil', { exact: true }).count(), 0);
});

test('backup: exporta, restaura em outro aparelho e apaga tudo', async () => {
  const first = await openApp();
  await onboard(first.page);
  await logToday(first.page, 'Cólica');
  await first.page.locator('.tags', { hasText: 'Cólica' }).waitFor();
  await first.page.getByRole('button', { name: 'Ajustes e privacidade' }).click();
  const [download] = await Promise.all([first.page.waitForEvent('download'), first.page.getByRole('button', { name: 'Baixar backup' }).click()]);
  const backup = JSON.parse(await readFile(await download.path(), 'utf8'));
  assert.equal(backup.format, 'ciclo-backup');
  assert.ok(backup.stores.entries.some((e) => e.code === 'cramps'));

  // "Outro aparelho": banco vazio, faz o cadastro e restaura.
  const second = await openApp();
  await onboard(second.page);
  await second.page.getByRole('button', { name: 'Ajustes e privacidade' }).click();
  await second.page.getByLabel('Arquivo de backup').setInputFiles(await download.path());
  await second.page.getByText('Backup restaurado.').waitFor();
  await second.page.getByRole('button', { name: 'Fechar' }).last().click();
  assert.match(await second.page.locator('.tags').innerText(), /Cólica/);

  // Segurar para apagar.
  await second.page.getByRole('button', { name: 'Ajustes e privacidade' }).click();
  await longPress(second.page, second.page.getByRole('button', { name: 'Segure para apagar meus dados' }), 1900);
  await second.page.getByText('Pronto. Seus dados foram apagados deste aparelho.').waitFor();
  await second.page.getByRole('button', { name: 'Recomeçar' }).click();
  await second.page.getByText('Quando começou sua última menstruação?').waitFor();
});

test('gestação: datação com aviso, sinal de alerta, pós-parto e volta ao ciclo', async () => {
  const { page, errors, setToday } = await openApp();
  await onboard(page);
  await page.getByRole('button', { name: 'Ajustes e privacidade' }).click();
  await page.getByRole('button', { name: 'Modo gestação' }).click();
  await page.getByLabel('Primeiro dia da última menstruação').fill('2026-10-17');
  await page.getByText(/seriam só 1s 4d/).waitFor();
  await page.getByRole('button', { name: 'Pela ultrassonografia' }).click();
  assert.equal(await page.getByRole('button', { name: 'Começar o modo gestação' }).isDisabled(), true);
  await page.getByLabel(/Data provável do parto/).fill('2027-06-01');
  await page.getByRole('button', { name: 'Começar o modo gestação' }).click();
  await page.locator('.screen .display', { hasText: /^9s 1d$/ }).waitFor();
  assert.equal(await page.locator('.quick.period').count(), 0, 'sem "Menstruei" na gestação');

  await logToday(page, 'Sangramento ou escape');
  await page.getByRole('alert').filter({ hasText: 'Procure atendimento' }).waitFor();
  assert.equal(await page.getByRole('alert').filter({ hasText: 'sangramento ou escape' }).count(), 1);

  await page.getByRole('button', { name: 'Assistente', exact: true }).click();
  await page.getByRole('button', { name: 'Posso tomar remédio para dor de cabeça?' }).click();
  await page.locator('.bubble.ai').nth(1).waitFor();
  assert.match(await page.locator('.bubble.ai').last().innerText(), /não indico nem avalio remédios/);
  await page.getByRole('button', { name: 'Fechar' }).last().click();

  await page.getByRole('button', { name: 'Encerrar acompanhamento' }).click();
  await page.getByRole('button', { name: /Acompanhar o pós-parto/ }).click();
  await page.getByText('Pós-parto', { exact: true }).waitFor();
  await setToday('2026-12-07'); // a menstruação volta 40 dias depois
  await page.getByText(/Desde 28 de outubro · 5 semanas/).waitFor();
  await page.locator('.quick.period').click();
  await page.locator('.ring').waitFor();
  assert.match(await ringText(page), /Menstruação/);
  assert.deepEqual(errors, []);
});

test('dados persistem ao recarregar e o app abre offline', async () => {
  const { page, context } = await openApp();
  await onboard(page);
  await logToday(page, 'Cólica');
  await page.locator('.tags', { hasText: 'Cólica' }).waitFor();
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, { timeout: 10000 }).catch(() => {});
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, { timeout: 10000 });
  await context.setOffline(true);
  await page.reload();
  assert.match(await page.locator('.tags').innerText(), /Cólica/);
  await context.setOffline(false);
});

test('tela pequena (320 px) sem rolagem horizontal e Esc fecha a folha', async () => {
  const { page } = await openApp({ width: 320, height: 640 });
  await onboard(page);
  for (const tab of ['Hoje', 'Calendário', 'Resumo']) {
    await page.getByRole('button', { name: tab, exact: true }).click();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.equal(overflow, 0, `sem rolagem horizontal em ${tab}`);
  }
  await page.getByRole('button', { name: 'Hoje', exact: true }).click();
  await page.getByRole('button', { name: /Registrar sintomas/ }).click();
  await page.keyboard.press('Escape'); // logo depois de abrir, com o foco ainda no botão
  await page.getByRole('dialog').waitFor({ state: 'detached', timeout: 3000 });
});

test('"Menstruei" logo depois da anterior começa um ciclo novo; no mesmo dia do "Terminou", reabre', async () => {
  const { page, errors } = await openApp();
  await pickDate(page, '2026-10-21'); // 5 dias: terminou em 25/10
  await onboard(page);
  const period = page.locator('.quick.period');
  await period.click();
  await page.locator('.quick.period.on').waitFor();
  assert.match(await ringText(page), /Menstruação/);
  assert.match(await ringText(page), /Dia 1 da menstruação/, 'antes emendava na anterior e virava "Dia 8"');
  await period.click(); // Terminou
  await page.getByRole('button', { name: 'Não lembro' }).click();
  await page.locator('.quick.period:not(.on)').waitFor();
  await period.click(); // engano: menstruei de novo hoje
  await page.locator('.quick.period.on').waitFor();
  assert.match(await ringText(page), /Dia 1 da menstruação/);
  assert.deepEqual(errors, []);
});

test('mais de 3 meses sem menstruação: anel e aviso próprios', async () => {
  const { page, errors } = await openApp();
  await pickDate(page, '2026-07-01');
  await onboard(page);
  assert.match(await ringText(page), /Sem menstruação/);
  assert.match(await ringText(page), /há 119 dias desde a última/);
  await expectText(page, 'Faz mais de 3 meses sem menstruação registrada');
  assert.equal(await page.getByText(/^Previsão: entre/).count(), 0, 'nada de previsão no passado');
  assert.deepEqual(errors, []);
});

test('assistente na barra de navegação, sem cobrir o botão de registro', async () => {
  const { page, errors } = await openApp();
  await pickDate(page, '2026-10-17');
  await onboard(page);
  const reg = page.getByRole('button', { name: /Registrar sintomas/ });
  await reg.scrollIntoViewIfNeeded();
  const onTop = await reg.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return [[r.left + 8, r.top + r.height / 2], [r.right - 8, r.top + r.height / 2]]
      .every(([x, y]) => el.contains(document.elementFromPoint(x, y)));
  });
  assert.equal(onTop, true, 'nada flutuando por cima do "Registrar sintomas"');
  const tab = page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('button', { name: 'Assistente' });
  await tab.click();
  assert.equal(await tab.getAttribute('aria-current'), 'page');
  assert.equal(await page.locator('.tabbar [aria-current="page"]').count(), 1, 'só uma aba ativa');
  await page.getByRole('button', { name: 'Quando vem a próxima menstruação?' }).click();
  await expectText(page, /prevista entre/);
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  assert.deepEqual(errors, []);
});

test('modo escuro: texto sobre cores de destaque continua legível', async () => {
  const { page, errors } = await openApp({ colorScheme: 'dark' });
  await pickDate(page, '2026-10-28');
  await onboard(page);
  const legible = async (name, loc) => {
    await loc.waitFor();
    const ratio = await contrastOf(loc);
    assert.ok(ratio >= 4.5, `${name}: contraste ${ratio.toFixed(2)} < 4.5`);
  };
  await legible('Menstruando (atalho)', page.locator('.quick.period.on'));
  await page.locator('.quick.sex').click();
  await legible('Relação (atalho)', page.locator('.quick.sex.on'));
  await page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('button', { name: 'Calendário' }).click();
  await legible('dia de menstruação no calendário', page.locator('.day.actual').first());
  assert.deepEqual(errors, []);
});
