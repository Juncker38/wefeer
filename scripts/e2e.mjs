// Браузерная проверка собранного приложения (dist/ или любой URL): генерация, копирование,
// скачивание, история, пакет, тема, офлайн-режим, отсутствие внешних запросов, CSP и доступность (axe-core).
//
//   npm run build && npm run e2e                      # проверка локальной сборки
//   E2E_URL=https://promts.vibecods.xyz npm run e2e   # проверка опубликованного сайта
//   CHROME_PATH=/путь/к/chrome npm run e2e            # если Chrome не найден автоматически
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import axe from 'axe-core';
import { chromium } from 'playwright-core';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const artifacts = join(root, 'e2e-artifacts');
mkdirSync(artifacts, { recursive: true });

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/usr/local/bin/google-chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);
const executablePath = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!executablePath) {
  console.error('FAIL Chrome не найден: задайте CHROME_PATH');
  process.exit(2);
}

// ───────── статический сервер с теми же заголовками безопасности, что у nginx ─────────
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json', '.ico': 'image/x-icon' };
function cspFromNginx() {
  const conf = join(root, 'deploy', 'nginx.conf');
  if (!existsSync(conf)) return null;
  return /add_header Content-Security-Policy "([^"]+)"/.exec(readFileSync(conf, 'utf8'))?.[1] ?? null;
}
function startServer() {
  const csp = cspFromNginx();
  const server = createServer((req, res) => {
    const path = decodeURIComponent((req.url ?? '/').split('?')[0]);
    const rel = normalize(path === '/' ? '/index.html' : path).replace(/^([/\\])+/, '');
    const file = join(dist, rel);
    if (!file.startsWith(dist) || !existsSync(file)) {
      res.writeHead(404).end('not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream', ...(csp ? { 'Content-Security-Policy': csp } : {}) });
    res.end(readFileSync(file));
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok({ server, url: `http://127.0.0.1:${server.address().port}/` })));
}

// ───────── учёт проверок ─────────
const results = [];
const failures = [];
async function step(name, fn) {
  const t0 = Date.now();
  try {
    await fn();
    results.push(`ok   ${name} (${Date.now() - t0} мс)`);
  } catch (e) {
    failures.push(`${name}: ${e instanceof Error ? e.message.split('\n')[0] : String(e)}`);
    results.push(`FAIL ${name}`);
  }
}
const assert = (cond, message) => {
  if (!cond) throw new Error(message);
};

let started = null;
let baseUrl = process.env.E2E_URL;
if (!baseUrl) {
  if (!existsSync(join(dist, 'index.html'))) {
    console.error('FAIL dist/index.html не найден — сначала выполните npm run build');
    process.exit(2);
  }
  started = await startServer();
  baseUrl = started.url;
}
const appOrigin = new URL(baseUrl).origin;

const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'ru-RU', acceptDownloads: true });
await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: appOrigin });
await context.addInitScript(() => {
  window.__csp = [];
  document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
});

const page = await context.newPage();
const pageErrors = [];
const foreignRequests = new Set();
page.on('pageerror', (e) => pageErrors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error') pageErrors.push(`console.error: ${m.text()}`);
});
page.on('request', (r) => {
  const u = r.url();
  if (u.startsWith('data:') || u.startsWith('blob:') || u.startsWith('about:')) return;
  if (new URL(u).origin !== appOrigin) foreignRequests.add(u);
});

const button = (name) => page.getByRole('button', { name, exact: true });
const promptLocator = () => page.getByLabel('Основной промпт');
const promptText = async () => (await promptLocator().innerText()).trim();
const generate = async () => {
  await button('Сгенерировать').click();
  await promptLocator().waitFor({ state: 'visible' });
};
const goTo = async (label) => {
  await page.getByRole('navigation', { name: 'Разделы' }).getByRole('button', { name: label }).click();
};

await page.goto(baseUrl, { waitUntil: 'networkidle' });

await step('страница загружается, заголовок и язык', async () => {
  assert((await page.title()).includes('RealPhoto Prompt Studio'), 'заголовок страницы');
  assert((await page.locator('html').getAttribute('lang')) === 'ru', 'lang="ru"');
  await page.getByRole('heading', { level: 1, name: 'RealPhoto Prompt Studio' }).waitFor();
});

let first = '';
await step('генерация: английский промпт, возраст 20–45, один персонаж', async () => {
  await generate();
  first = await promptText();
  assert(first.length > 400, `промпт слишком короткий (${first.length})`);
  const age = /(\d{2}) years old/.exec(first);
  assert(age, 'в промпте нет явного возраста');
  assert(Number(age[1]) >= 20 && Number(age[1]) <= 45, `возраст вне диапазона: ${age[1]}`);
  assert(/fictional adult woman/i.test(first), 'нет «fictional adult woman»');
  assert(!/[а-яё]/i.test(first), 'в английском промпте есть кириллица');
});

await step('копирование в буфер обмена', async () => {
  await button('Копировать').click();
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  assert(clip.trim() === first, 'буфер обмена не совпадает с промптом');
});

await step('повторная генерация даёт другой кадр, «повторить» — тот же', async () => {
  await generate();
  const second = await promptText();
  assert(second !== first, 'второй кадр совпал с первым');
  await page.getByRole('button', { name: /Повторить с теми же настройками/ }).click();
  assert((await promptText()) === second, '«повторить» изменил кадр');
});

await step('вкладки результата: negative, JSON, метаданные', async () => {
  await page.getByRole('tab', { name: 'Negative' }).click();
  assert((await page.getByLabel('Negative prompt').innerText()).length > 40, 'пустой negative');
  await page.getByRole('tab', { name: 'JSON' }).click();
  const json = JSON.parse(await page.getByLabel('JSON сценария').innerText());
  const age = json.subject?.age ?? json.scenario?.subject?.age;
  assert(Number.isInteger(age) && age >= 20 && age <= 45, `JSON: возраст ${age}`);
  await page.getByRole('tab', { name: 'Метаданные' }).click();
  assert((await page.locator('dl.meta .meta-row').count()) > 5, 'мало метаданных');
  await page.getByRole('tab', { name: 'Промпт' }).click();
});

await step('скачивание TXT и JSON', async () => {
  const [txt] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Скачать TXT' }).click()]);
  assert(txt.suggestedFilename().endsWith('.txt'), `имя файла ${txt.suggestedFilename()}`);
  assert(readFileSync(await txt.path(), 'utf8').includes('photorealistic'), 'в TXT нет промпта');
  await page.getByRole('tab', { name: 'JSON' }).click();
  const [js] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Скачать JSON' }).click()]);
  assert(JSON.parse(readFileSync(await js.path(), 'utf8')), 'JSON не разбирается');
  await page.getByRole('tab', { name: 'Промпт' }).click();
});

await step('избранное и история с поиском', async () => {
  await button('Сохранить в избранное').click();
  await generate();
  await goTo('История');
  await page.getByRole('heading', { name: 'История и избранное' }).waitFor();
  const total = await page.locator('ol.entries > li, ul.entries > li').count();
  assert(total >= 2, `в истории ${total} записей`);
  await page.getByRole('searchbox').first().fill('zzzz-нет-такого');
  await page.waitForTimeout(150);
  assert((await page.locator('ol.entries > li, ul.entries > li').count()) === 0, 'поиск не отфильтровал записи');
  await page.getByRole('button', { name: 'Сбросить фильтры' }).click().catch(() => {});
  await goTo('Студия');
});

await step('тема сохраняется после перезагрузки', async () => {
  await page.getByRole('button', { name: 'Тема: тёмная' }).click();
  assert((await page.locator('html').getAttribute('data-theme')) === 'dark', 'тёмная тема не применилась');
  await page.screenshot({ path: join(artifacts, 'desktop-dark.png') });
  await page.reload({ waitUntil: 'networkidle' });
  assert((await page.locator('html').getAttribute('data-theme')) === 'dark', 'тема не сохранилась');
  await page.getByRole('button', { name: 'Тема: светлая' }).click();
  assert((await page.locator('html').getAttribute('data-theme')) === 'light', 'светлая тема не применилась');
  await page.screenshot({ path: join(artifacts, 'desktop-light.png') });
});

await step('«Случайно всё» и «Сбросить» работают', async () => {
  await page.getByRole('button', { name: /Случайно всё/ }).first().click();
  await promptLocator().waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'Сбросить', exact: true }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Сбросить' }).click();
  await generate();
  assert((await promptText()).length > 400, 'после сброса нет промпта');
});

await step('пакет из 5 кадров с прогрессом и экспортом', async () => {
  await goTo('Пакет');
  await page.getByRole('group', { name: 'Размер пакета' }).getByRole('button', { name: '5', exact: true }).click();
  await button('Запустить пакет').click();
  await page.getByText(/Готово\. Обработано 5 из 5/).waitFor({ timeout: 30_000 });
  assert((await page.locator('ol.entries > li').count()) === 5, 'в пакете не 5 кадров');
  const [csv] = await Promise.all([page.waitForEvent('download'), button('CSV').click()]);
  assert(csv.suggestedFilename().endsWith('.csv'), 'экспорт CSV');
});

await step('пакет из 100 кадров можно отменить', async () => {
  await page.getByRole('group', { name: 'Размер пакета' }).getByRole('button', { name: '100', exact: true }).click();
  await button('Запустить пакет').click();
  await button('Отмена').click({ timeout: 3000 });
  await page.getByText(/Остановлено\./).waitFor({ timeout: 15_000 });
});

await step('работает без сети после загрузки', async () => {
  await goTo('Студия');
  await context.setOffline(true);
  await generate();
  assert((await promptText()).length > 400, 'офлайн-генерация не сработала');
  await context.setOffline(false);
});

await step('разделы «Пресеты» и «О проекте» открываются', async () => {
  await goTo('Пресеты');
  await page.getByRole('heading', { level: 2 }).first().waitFor();
  await goTo('О проекте');
  await page.getByRole('heading', { level: 2 }).first().waitFor();
  await goTo('Студия');
});

await step('мобильная раскладка без горизонтальной прокрутки', async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'networkidle' });
  await generate();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert(overflow <= 1, `горизонтальная прокрутка: ${overflow}px`);
  await page.screenshot({ path: join(artifacts, 'mobile-light.png'), fullPage: false });
});

async function axeScan(label) {
  await page.evaluate(axe.source);
  const res = await page.evaluate(async () => {
    // eslint-disable-next-line no-undef
    const r = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) }));
  });
  const serious = res.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  assert(serious.length === 0, `${label}: ${serious.map((v) => `${v.id} [${v.impact}] ${v.nodes.join(' | ')}`).join('; ')}`);
  const minor = res.filter((v) => !serious.includes(v));
  if (minor.length) results.push(`note ${label}: замечания axe ниже серьёзных — ${minor.map((v) => `${v.id}(${v.impact})`).join(', ')}`);
}

await step('доступность (axe, WCAG 2.1 AA): все разделы, светлая и тёмная тема', async () => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.reload({ waitUntil: 'networkidle' });
  for (const theme of ['Тема: светлая', 'Тема: тёмная']) {
    await page.getByRole('button', { name: theme }).click();
    for (const view of ['Студия', 'Пакет', 'История', 'Пресеты', 'О проекте']) {
      await goTo(view);
      if (view === 'Студия') await generate();
      await axeScan(`${view} / ${theme}`);
    }
  }
});

await step('ни одного внешнего запроса, ошибок консоли и нарушений CSP', async () => {
  assert(foreignRequests.size === 0, `внешние запросы: ${[...foreignRequests].join(', ')}`);
  const csp = await page.evaluate(() => window.__csp);
  assert(csp.length === 0, `нарушения CSP: ${csp.join('; ')}`);
  assert(pageErrors.length === 0, `ошибки страницы: ${pageErrors.slice(0, 3).join(' | ')}`);
});

await browser.close();
started?.server.close();

console.log(`Chrome: ${executablePath}\nАдрес: ${baseUrl}\n`);
console.log(results.join('\n'));
if (failures.length) {
  console.error(`\nFAIL e2e (${failures.length}):\n - ${failures.join('\n - ')}`);
  process.exit(1);
}
console.log(`\nOK e2e: пройдено ${results.filter((r) => r.startsWith('ok')).length} проверок`);
