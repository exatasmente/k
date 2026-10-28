import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { contrastOf, expectPressed, expectText, item, logToday, longPress, onboard, openApp, pickDate } from './harness.js';

// Cenários de ponta a ponta no app construído (dist/). Data fixa: 28/10/2026.

const ringText = (page) => page.locator('.ring-text').innerText();

/** Baixa o backup pelos Ajustes e devolve o JSON (o banco decifrado). Fecha os Ajustes. */
async function downloadBackup(page) {
  await page.getByRole('button', { name: 'Ajustes e privacidade' }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Baixar backup' }).click()]);
  const backup = JSON.parse(await readFile(await download.path(), 'utf8'));
  await page.keyboard.press('Escape');
  return backup;
}

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
  // A resposta fica gravada no ciclo (confere pelo backup, que é o banco decifrado).
  const backup = await downloadBackup(page);
  assert.deepEqual(backup.stores.cycleAnswers.map((a) => [a.cycleStart, a.code, a.answer]), [['2026-10-28', 'cramps', 'yes']]);
  assert.deepEqual(errors, []);
});

test('RF01.4: menstruação aberta há 10+ dias pede confirmação do fim', async () => {
  const { page, setToday, errors } = await openApp();
  await pickDate(page, '2026-09-30');
  await onboard(page);
  await page.locator('.quick.period').click(); // Menstruei em 28/10
  await page.locator('.quick.period.on').waitFor(); // gravado antes de recarregar
  await setToday('2026-11-09');
  const card = page.getByRole('region', { name: 'Confirmar fim da menstruação' });
  await card.waitFor();
  assert.match(await card.innerText(), /começou em 28 de outubro/);
  await card.getByLabel('Último dia de sangramento').fill('2026-11-02');
  await card.getByRole('button', { name: 'Confirmar' }).click();
  await card.waitFor({ state: 'detached' });
  // O fim escolhido (02/11) vale no calendário, não o da média.
  await page.getByRole('button', { name: 'Calendário', exact: true }).click();
  await page.getByRole('button', { name: /^2, menstruação/ }).waitFor();
  assert.equal(await page.getByRole('button', { name: /^3, menstruação/ }).count(), 0);
  assert.deepEqual(errors, []);
});

test('relação em 1 toque, sem preservativo e PDS duas vezes no ciclo mostra informação com fonte', async () => {
  const { page, setToday, errors } = await openApp({ today: '2026-10-20' });
  await pickDate(page, '2026-10-17');
  await onboard(page);
  await page.locator('.quick.sex').click();
  await page.getByRole('button', { name: 'Sem preservativo' }).click();
  await page.locator('.alert.warn', { hasText: 'sem preservativo' }).waitFor(); // sem proteção destaca a faixa
  await page.getByRole('button', { name: 'Tomei a pílula do dia seguinte' }).click();
  await page.getByRole('button', { name: 'Pílula do dia seguinte registrada' }).waitFor();
  const pdsCard = page.getByRole('region', { name: 'Sobre a pílula do dia seguinte' });
  assert.equal(await pdsCard.count(), 0, 'uma vez não aparece');
  await setToday('2026-10-28');
  await page.locator('.quick.sex').click();
  await page.getByRole('button', { name: 'Tomei a pílula do dia seguinte' }).click();
  await pdsCard.waitFor();
  assert.match(await pdsCard.innerText(), /2ª vez neste ciclo/);
  assert.match(await pdsCard.innerText(), /Pode tomar de novo quando precisar/, 'informa, sem tratar como perigo');
  await pdsCard.getByRole('link', { name: 'ICEC 2015 (uso repetido)' }).waitFor();
  await page.getByRole('button', { name: 'Entender melhor' }).click();
  await page.locator('.bubble.ai').nth(1).waitFor();
  assert.match(await page.locator('.bubble.ai').last().innerText(), /2 vezes em 2026/);
  // "Entender melhor" conta como visto: o alerta não volta ao recarregar.
  await page.keyboard.press('Escape');
  await page.reload();
  await page.getByRole('button', { name: 'Pílula do dia seguinte registrada' }).waitFor();
  assert.equal(await pdsCard.count(), 0);
  assert.deepEqual(errors, []);
});

test('registro: negação, escolha única, long-press e pergunta à assistente', async () => {
  const { page, errors } = await openApp();
  await onboard(page);
  await page.getByRole('button', { name: /Registrar sintomas/ }).click();
  // Toques rápidos, sem esperar a gravação entre eles.
  await item(page, 'Cólica').click();
  await page.getByRole('button', { name: /Dia tranquilo/ }).click();
  await page.getByRole('button', { name: /Dia tranquilo/, pressed: true }).waitFor();
  await expectPressed(page, 'Cólica', false); // "Sem sintomas" desmarca os sintomas
  await item(page, 'Leve').click();
  await item(page, 'Intenso').click();
  await expectPressed(page, 'Intenso', true);
  await expectPressed(page, 'Leve', false); // fluxo é escolha única
  await longPress(page, item(page, 'Dor de cabeça'));
  await page.getByRole('dialog', { name: 'Dor de cabeça' }).waitFor();
  await page.getByRole('button', { name: 'Voltar ao registro' }).click();
  await expectPressed(page, 'Dor de cabeça', false); // long-press não marca o item
  await longPress(page, item(page, 'Dor de cabeça'));
  await page.getByRole('button', { name: 'Perguntar à assistente' }).click();
  assert.match(await page.locator('.bubble.me').last().innerText(), /Tive dor de cabeça em todos os ciclos\?/);
  assert.match(await page.locator('.bubble.ai').last().innerText(), /Ainda não há ciclos completos com registro de sintomas/);
  assert.deepEqual(errors, []);
});

test('calendário: registrar um dia passado cria a menstruação', async () => {
  const { page, errors } = await openApp();
  await onboard(page);
  await page.getByRole('button', { name: 'Calendário' }).click();
  await page.getByRole('button', { name: /^10(,|$)/ }).click();
  await page.getByRole('button', { name: 'Registrar neste dia' }).click();
  await item(page, 'Médio').click();
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
  await page.getByRole('button', { name: 'Pílula combinada contínua' }).click();
  await page.getByRole('button', { name: 'Pílula combinada contínua', pressed: true }).waitFor();
  await page.getByRole('button', { name: 'Fechar' }).last().click();
  assert.match(await ringText(page), /Pílula combinada contínua/);
  assert.equal(await page.getByText('Janela fértil', { exact: true }).count(), 0);
  await page.getByRole('button', { name: 'Calendário', exact: true }).click();
  await page.getByRole('button', { name: /^28, hoje/ }).waitFor();
  assert.equal(await page.getByRole('button', { name: /janela fértil/ }).count(), 0, 'nem no calendário');
});

test('backup: restaurar em outro aparelho já cadastrado substitui os dados (método inclusive)', async () => {
  const first = await openApp();
  await onboard(first.page, { method: 'Pílula combinada contínua' });
  await logToday(first.page, 'Cólica');
  await first.page.locator('.tags', { hasText: 'Cólica' }).waitFor();
  await first.page.getByRole('button', { name: 'Ajustes e privacidade' }).click();
  const [download] = await Promise.all([first.page.waitForEvent('download'), first.page.getByRole('button', { name: 'Baixar backup' }).click()]);
  const backup = JSON.parse(await readFile(await download.path(), 'utf8'));
  assert.equal(backup.format, 'ciclo-backup');
  assert.ok(backup.stores.entries.some((e) => e.code === 'cramps'));

  // "Outro aparelho": cadastro com preservativo e um registro próprio, depois restaura.
  const { page, errors } = await openApp();
  await onboard(page);
  await logToday(page, 'Dor de cabeça');
  await page.getByRole('button', { name: 'Ajustes e privacidade' }).click();
  await page.getByLabel('Arquivo de backup').setInputFiles(await download.path());
  await page.getByText('Backup restaurado. Ele substituiu os dados que estavam neste aparelho.').waitFor();
  await page.keyboard.press('Escape');
  const tags = await page.locator('.tags').innerText();
  assert.match(tags, /Cólica/);
  assert.doesNotMatch(tags, /Dor de cabeça/);
  assert.match(await ringText(page), /Pílula combinada contínua/, 'antes ficavam os dois métodos e valia o do aparelho');
  assert.equal(await page.getByText('Janela fértil', { exact: true }).count(), 0);
  assert.deepEqual(errors, []);
});

test('apagar meus dados: soltar antes não apaga; segurar apaga e volta ao cadastro', async () => {
  const { page, errors } = await openApp();
  await onboard(page);
  await page.getByRole('button', { name: 'Ajustes e privacidade' }).click();
  const hold = page.getByRole('button', { name: 'Segure para apagar meus dados' });
  await longPress(page, hold, 700); // menos da metade do tempo
  await page.waitForTimeout(1200);
  assert.equal(await page.getByText('Pronto. Seus dados foram apagados deste aparelho.').count(), 0, 'toque curto não apaga');
  await longPress(page, hold, 1900);
  await page.getByText('Pronto. Seus dados foram apagados deste aparelho.').waitFor();
  await page.getByRole('button', { name: 'Recomeçar' }).click();
  await page.getByText('Quando começou sua última menstruação?').waitFor();
  assert.deepEqual(errors, []);
});

test('apagar com o app aberto em outra aba: termina, e a outra aba volta ao cadastro', async () => {
  const { page, context } = await openApp();
  await onboard(page);
  const other = await context.newPage();
  await other.goto(page.url());
  await other.getByRole('navigation', { name: 'Navegação principal' }).waitFor();
  await page.bringToFront();
  await page.getByRole('button', { name: 'Ajustes e privacidade' }).click();
  await longPress(page, page.getByRole('button', { name: 'Segure para apagar meus dados' }), 1900);
  await page.getByText('Pronto. Seus dados foram apagados deste aparelho.').waitFor({ timeout: 5000 });
  await other.getByText('Quando começou sua última menstruação?').waitFor({ timeout: 5000 });
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

  await logToday(page, 'Sangramento pela vagina');
  const red = page.getByRole('alert').filter({ hasText: 'Procure atendimento' });
  await red.waitFor();
  assert.equal(await page.getByRole('alert').filter({ hasText: 'sangramento pela vagina' }).count(), 1);
  assert.match(await red.innerText(), /Busque atendimento imediatamente[\s\S]*SAMU \(192\)/);
  assert.match(await red.getByRole('link', { name: 'Caderneta da Gestante (MS, 2026)' }).getAttribute('href'), /caderneta-brasileira-da-gestante/);

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
  // Antes de 6 semanas pode ser lóquio (Caderneta, MS 2026): o app confirma.
  const lochia = page.getByRole('region', { name: 'Menstruação ou lóquio' });
  await lochia.getByRole('button', { name: 'É menstruação' }).click();
  await page.locator('.ring').waitFor();
  assert.match(await ringText(page), /Menstruação/);
  assert.deepEqual(errors, []);
});

test('dados persistem ao recarregar; o app abre e registra offline', async () => {
  const { page, context, errors } = await openApp();
  await onboard(page);
  await page.locator('.quick.period').click(); // Menstruei
  await page.locator('.quick.period.on').waitFor();
  await logToday(page, 'Cólica');
  await page.getByRole('button', { name: /Registrar sintomas/ }).click();
  await page.getByRole('button', { name: 'Editar' }).click();
  await page.getByRole('button', { name: 'Esconder Relação & proteção' }).click();
  await page.getByRole('button', { name: 'Concluir' }).click();
  await page.getByRole('button', { name: 'Pronto' }).click();
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, { timeout: 10000 }).catch(() => {});
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, { timeout: 10000 });
  assert.match(await ringText(page), /Dia 1 da menstruação/);
  assert.match(await page.locator('.tags').innerText(), /Cólica/);
  assert.equal(await page.locator('.quick.sex').count(), 0, 'categoria escondida continua escondida');

  await context.setOffline(true);
  await page.reload();
  await logToday(page, 'Dor de cabeça');
  await page.locator('.tags', { hasText: 'Dor de cabeça' }).waitFor();
  await page.reload();
  const tags = await page.locator('.tags').innerText();
  assert.match(tags, /Cólica/);
  assert.match(tags, /Dor de cabeça/, 'registrado sem internet');
  await context.setOffline(false);
  assert.deepEqual(errors, []);
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
  await page.getByRole('dialog').waitFor();
  await page.evaluate(() => document.activeElement?.blur()); // foco fora da folha: o Esc vale mesmo assim
  await page.keyboard.press('Escape');
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

test('cadastro: menstruação de 7 dias, nascimento e IA desligada ficam gravados', async () => {
  const { page, errors } = await openApp();
  await pickDate(page, '2026-10-20');
  await onboard(page, { periodLength: 7, birth: '1990-02-03' });
  const backup = await downloadBackup(page);
  const profile = backup.stores.profile[0];
  assert.deepEqual([profile.onboarding.periodLength, profile.birthDate, profile.aiEnabled], [7, '1990-02-03', false]);
  await page.getByRole('button', { name: 'Calendário', exact: true }).click();
  await page.getByRole('button', { name: /^26, menstruação/ }).waitFor();
  assert.equal(await page.getByRole('button', { name: /^27, menstruação/ }).count(), 0, '20 a 26: 7 dias');
  assert.deepEqual(errors, []);
});

test('esqueceu o "Terminou": 4 semanas depois o atalho volta a "Menstruei" e abre um ciclo novo', async () => {
  const { page, setToday, errors } = await openApp({ today: '2026-09-01' });
  await pickDate(page, '2026-08-04');
  await onboard(page);
  await page.locator('.quick.period').click();
  await page.locator('.quick.period.on').waitFor();
  await setToday('2026-09-29');
  assert.match(await page.locator('.quick.period').innerText(), /Menstruei/, 'não fica "Menstruando" há 29 dias');
  await page.getByRole('region', { name: 'Confirmar fim da menstruação' }).waitFor();
  await page.locator('.quick.period').click();
  await page.locator('.quick.period.on').waitFor();
  assert.match(await ringText(page), /Dia 1 da menstruação/);
  await page.getByRole('button', { name: 'Calendário', exact: true }).click();
  await page.getByRole('button', { name: /^5, menstruação/ }).waitFor();
  assert.equal(await page.getByRole('button', { name: /^6, menstruação/ }).count(), 0, 'setembro não fica todo vermelho');
  assert.deepEqual(errors, []);
});

test('assistente: aviso de que não substitui profissional fica visível, antes e depois da resposta', async () => {
  const { page } = await openApp();
  await onboard(page);
  await page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('button', { name: 'Assistente' }).click();
  const disclaimer = page.getByRole('dialog').getByText('Informativo. Não substitui o diagnóstico ou a orientação de um profissional de saúde.');
  await disclaimer.waitFor();
  await page.getByRole('button', { name: 'Senti cólica em todos os ciclos?' }).click();
  await page.locator('.bubble.ai').nth(1).waitFor();
  assert.equal(await disclaimer.isVisible(), true);
});

test('ciclos irregulares (RN03): aviso na Home leva ao Resumo e, visto, não volta neste ciclo', async () => {
  const { page, errors } = await openApp();
  await onboard(page);
  const backup = await downloadBackup(page);
  // Seis menstruações de 5 dias com ciclos de 22, 37, 24, 38 e 24 dias.
  const plus = (iso, n) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
  let start = '2026-04-01';
  backup.stores.periods = [];
  for (const len of [22, 37, 24, 38, 24, 0]) {
    backup.stores.periods.push({ id: `p${start}`, start, end: plus(start, 4), source: 'user', confirmed: true });
    start = plus(start, len);
  }
  const file = join(tmpdir(), `irregular-${Date.now()}.json`);
  await writeFile(file, JSON.stringify(backup));
  await page.getByRole('button', { name: 'Ajustes e privacidade' }).click();
  await page.getByLabel('Arquivo de backup').setInputFiles(file);
  await page.getByText(/^Backup restaurado/).waitFor();
  await page.keyboard.press('Escape');

  const card = page.getByRole('region', { name: 'Ciclos irregulares' });
  await card.waitFor();
  await card.getByRole('button', { name: 'Ver meus ciclos' }).click();
  await page.getByText('Ciclos irregulares', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Hoje', exact: true }).click();
  await page.reload();
  await page.getByRole('navigation', { name: 'Navegação principal' }).waitFor();
  assert.equal(await card.count(), 0, 'visto uma vez neste ciclo, não repete');
  assert.deepEqual(errors, []);
});

test('lembretes: liga com permissão, o service worker avisa uma vez e com texto discreto; agenda baixa as previsões', async () => {
  const { page, context, errors } = await openApp({ today: '2026-11-05' });
  await context.grantPermissions(['notifications']);
  await pickDate(page, '2026-10-17'); // janela prevista a partir de 11/11 (média ± 3): aviso em 09/11
  await onboard(page);
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, { timeout: 10000 });
  await page.getByRole('button', { name: 'Ajustes e privacidade' }).click();
  const section = page.getByRole('region', { name: 'Lembretes' });
  await section.getByRole('button', { name: 'Lembretes' }).click();
  await section.getByRole('button', { name: 'Lembretes', pressed: true }).waitFor();
  assert.match(await section.getByRole('status').first().innerText(), /navegador/);

  const check = (today) => page.evaluate(async (day) => {
    const reg = await navigator.serviceWorker.ready;
    const reply = new Promise((resolve, reject) => {
      navigator.serviceWorker.addEventListener('message', (e) => resolve(e.data), { once: true });
      setTimeout(() => reject(new Error('o service worker não respondeu')), 5000);
    });
    reg.active.postMessage({ type: 'lembretes', today: day });
    const { shown, error } = await reply;
    if (error) throw new Error(`service worker: ${error}`);
    const list = await reg.getNotifications();
    return { shown, notes: list.map((n) => [n.title, n.body]) };
  }, today);
  assert.equal((await check('2026-11-08')).shown, 0, 'ainda não venceu');
  const due = await check('2026-11-09');
  assert.equal(due.shown, 1);
  assert.deepEqual(due.notes, [['Ciclo', 'Você tem um lembrete. Toque para abrir.']], 'nada de "menstruação" na tela de bloqueio');
  assert.equal((await check('2026-11-10')).shown, 0, 'não repete');

  const [download] = await Promise.all([page.waitForEvent('download'), section.getByRole('button', { name: 'Adicionar previsões à agenda' }).click()]);
  const ics = await readFile(await download.path(), 'utf8');
  assert.equal(ics.match(/BEGIN:VEVENT/g).length, 6);
  assert.match(ics, /SUMMARY:Ciclo\r\n/);
  assert.match(ics, /DTSTART;VALUE=DATE:20261114/);
  assert.deepEqual(errors, []);
});

test('lembretes: sem permissão de notificação o interruptor não liga e explica o motivo', async () => {
  const { page, errors } = await openApp(); // sem permissão concedida: o navegador de teste recusa o pedido
  await onboard(page);
  await page.getByRole('button', { name: 'Ajustes e privacidade' }).click();
  const section = page.getByRole('region', { name: 'Lembretes' });
  await section.getByText('O navegador vai pedir permissão para mostrar notificações.').waitFor();
  await section.getByRole('button', { name: 'Lembretes' }).click();
  await section.getByText(/bloqueadas para este site/).waitFor();
  assert.equal(await section.getByRole('button', { name: 'Lembretes' }).getAttribute('aria-pressed'), 'false');
  assert.equal(await section.getByRole('button', { name: 'Lembretes' }).isDisabled(), true);
  assert.deepEqual(errors, []);
});

test('alertas mostram a fonte: menstruação com mais de 8 dias (FIGO) e lista de fontes nos Ajustes', async () => {
  const { page, setToday, errors } = await openApp();
  await pickDate(page, '2026-10-28');
  await onboard(page); // menstruação aberta desde hoje
  await setToday('2026-11-05'); // 9º dia
  const card = page.getByRole('region', { name: 'Menstruação longa' });
  await card.waitFor();
  assert.match(await card.innerText(), /passou de 8 dias/);
  assert.equal(await card.getByRole('link', { name: 'FIGO 2018' }).getAttribute('href'), 'https://doi.org/10.1002/ijgo.12666');
  assert.equal(await card.getByRole('link', { name: 'FIGO 2018' }).getAttribute('target'), '_blank');
  await card.getByRole('button', { name: 'Ok' }).click();
  await card.waitFor({ state: 'detached' });

  await page.getByRole('button', { name: 'Ajustes e privacidade' }).click();
  await page.getByText('Fontes clínicas dos alertas').click();
  await page.getByRole('link', { name: /Caderneta Brasileira da Gestante/ }).waitFor();
  assert.ok(await page.getByRole('link', { name: /Family Planning: A Global Handbook/ }).count());
  assert.deepEqual(errors, []);
});

test('duração da menstruação: ela escolhe nos Ajustes e o Resumo mostra a informada', async () => {
  const { page, errors } = await openApp();
  await onboard(page);
  await page.getByRole('button', { name: 'Ajustes e privacidade' }).click();
  const setting = page.getByRole('region', { name: 'Duração da menstruação' });
  for (let i = 0; i < 4; i++) await setting.getByRole('button', { name: 'Aumentar duração da menstruação' }).click();
  await setting.getByText('9 dias').waitFor();
  await page.getByText('Menstruação com mais de 8 dias merece avaliação.', { exact: false }).waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Resumo', exact: true }).click();
  await page.getByText('a que você informou').waitFor();
  assert.match(await page.locator('.card', { hasText: 'Menstruação média' }).innerText(), /9 dias/);
  assert.deepEqual(errors, []);
});

test('cadastro: data de nascimento de hoje ("0 anos") é recusada, e o campo cabe no cartão em tela pequena', async () => {
  const { page, errors } = await openApp({ width: 320, height: 640 });
  await pickDate(page, '2026-10-20');
  await page.getByRole('button', { name: 'Continuar' }).click();
  const birth = page.locator('#birth');
  const fits = await birth.evaluate((el) => {
    const card = el.closest('.card').getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return r.left >= card.left && r.right <= card.right;
  });
  assert.equal(fits, true, 'o campo de data não passa da borda do cartão');
  await page.fill('#birth', '2026-10-28'); // o iPhone preenche hoje ao tocar
  await page.getByRole('alert').filter({ hasText: 'idade precisa estar entre 9 e 60 anos' }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Continuar' }).isDisabled(), true);
  await page.fill('#birth', '1996-05-12');
  await page.getByText('30 anos').waitFor();
  assert.equal(await page.getByRole('button', { name: 'Continuar' }).isDisabled(), false);
  assert.deepEqual(errors, []);
});

test('importar histórico de outro app acrescenta ciclos antigos sem apagar o cadastro', async () => {
  const { page, errors } = await openApp();
  await pickDate(page, '2026-10-17');
  await onboard(page);
  const file = join(tmpdir(), `historico-${Date.now()}.json`);
  await writeFile(file, JSON.stringify({
    format: 'ciclo-historico', version: 1,
    periods: [{ start: '2026-08-22', end: '2026-08-26' }, { start: '2026-09-19', end: '2026-09-23' }],
    entries: [{ date: '2026-09-19', code: 'cramps' }],
  }));
  await page.getByRole('button', { name: 'Ajustes e privacidade' }).click();
  await page.getByLabel('Arquivo de histórico').setInputFiles(file);
  await page.getByText('Histórico importado: 2 menstruações e 1 registro.').waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Calendário', exact: true }).click();
  await page.getByRole('button', { name: 'Mês anterior' }).click();
  await page.getByRole('button', { name: /^19, menstruação/ }).waitFor();
  await page.getByRole('button', { name: 'Resumo', exact: true }).click();
  assert.match(await page.locator('.card', { hasText: 'Ciclo médio' }).innerText(), /28 dias/);
  assert.deepEqual(errors, []);
});
