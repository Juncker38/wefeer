// Статическая проверка production-сборки (dist/): запускать после `npm run build`.
// Не требует браузера; функциональная проверка в Chrome — scripts/e2e.mjs.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const failures = [];
const notes = [];
const check = (ok, message) => {
  if (!ok) failures.push(message);
};

// Допустимые «внешние» адреса в коде: пространства имён XML и тексты ошибок React (запросов не создают).
const ALLOWED_URL_HOSTS = new Set(['www.w3.org', 'react.dev', 'reactjs.org']);
const BUDGET = { jsGzipKb: 450, cssGzipKb: 40, totalFiles: 12 };

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
}

if (!existsSync(join(dist, 'index.html'))) {
  console.error('FAIL dist/index.html не найден — сначала выполните npm run build');
  process.exit(1);
}

const html = readFileSync(join(dist, 'index.html'), 'utf8');
check(/<html[^>]*\blang="ru"/.test(html), 'index.html: нет lang="ru"');
check(/<title>[^<]{5,}<\/title>/.test(html), 'index.html: нет заголовка страницы');
check(/<meta[^>]+name="viewport"/.test(html), 'index.html: нет meta viewport');
check(/<div id="root"><\/div>/.test(html), 'index.html: нет контейнера #root');
check(!/<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/.test(html), 'index.html: есть встроенный скрипт — это нарушит CSP script-src \'self\'');
check(!/\son[a-z]+\s*=/.test(html), 'index.html: есть встроенные обработчики событий');

const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
for (const ref of refs) {
  if (/^(https?:)?\/\//.test(ref)) {
    failures.push(`index.html: внешняя ссылка ${ref}`);
    continue;
  }
  if (ref.startsWith('#')) continue;
  const file = join(dist, ref.replace(/^\.?\//, ''));
  check(existsSync(file), `index.html: ссылка на отсутствующий файл ${ref}`);
}
check(refs.some((r) => /\.js$/.test(r)), 'index.html: нет подключённого скрипта');
check(refs.some((r) => /\.css$/.test(r)), 'index.html: нет подключённых стилей');

const files = walk(dist);
check(files.length <= BUDGET.totalFiles, `слишком много файлов в dist: ${files.length}`);

let jsGzip = 0;
let cssGzip = 0;
let appBundle = '';
for (const file of files) {
  const rel = file.slice(dist.length + 1);
  const size = statSync(file).size;
  if (/\.(js|css|html|svg)$/.test(file)) {
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)) {
      const host = m[1].toLowerCase();
      check(ALLOWED_URL_HOSTS.has(host), `${rel}: внешний адрес ${m[0]}`);
    }
    if (/\.js$/.test(file)) {
      jsGzip += gzipSync(text).length;
      if (text.includes('RealPhoto Prompt Studio')) appBundle = text;
      for (const bad of [/\bsendBeacon\b/, /\bXMLHttpRequest\b/, /new WebSocket\(/, /\bgoogle-analytics\b/, /\bgtag\(/, /\bmetrika\b/i]) {
        check(!bad.test(text), `${rel}: подозрительное обращение к сети (${bad})`);
      }
    }
    if (/\.css$/.test(file)) cssGzip += gzipSync(text).length;
  }
  notes.push(`${rel}  ${(size / 1024).toFixed(1)} КБ`);
}
check(appBundle !== '', 'в сборке не найден код приложения');
check(jsGzip / 1024 <= BUDGET.jsGzipKb, `JS (gzip) ${(jsGzip / 1024).toFixed(0)} КБ превышает бюджет ${BUDGET.jsGzipKb} КБ`);
check(cssGzip / 1024 <= BUDGET.cssGzipKb, `CSS (gzip) ${(cssGzip / 1024).toFixed(0)} КБ превышает бюджет ${BUDGET.cssGzipKb} КБ`);

// Библиотека сцен и ключевые тексты интерфейса должны попасть в бандл.
for (const needle of ['Студия', 'Пакет', 'История', 'Пресеты', 'home-kitchen', 'water-pool', 'travel-', 'nature-', 'food-', 'everyday-', 'city-']) {
  check(appBundle.includes(needle), `в бандле нет ожидаемой строки «${needle}»`);
}

console.log(notes.join('\n'));
console.log(`JS gzip: ${(jsGzip / 1024).toFixed(0)} КБ, CSS gzip: ${(cssGzip / 1024).toFixed(0)} КБ`);
if (failures.length) {
  console.error('\nFAIL smoke-тест сборки:\n - ' + failures.join('\n - '));
  process.exit(1);
}
console.log('OK smoke-тест сборки пройден');
