# HANDOFF — состояние работы и как продолжить

Снимок: 2026-10-17 ≈15:58 UTC. Ветка `hoplite/andros-913cf564`, репозиторий <https://github.com/Juncker38/wefeer>.
Полный текст ТЗ (мастер-промт) лежит **только на сервере**: `D:\server-projects\promts.vibecods.xyz\handoff\MASTER_PROMPT.md` (в git не включён намеренно, каталог `handoff/` в `.gitignore`). Перед любой работой прочитайте его целиком: краткие пересказы ТЗ теряют требования.

## 1. Что строим

RealPhoto Prompt Studio — русскоязычное офлайн-SPA (React 19 + TypeScript strict + Vite) для генерации связных **английских** фотореалистичных промптов о **вымышленных взрослых женщинах 20–45 лет**. Без внешних API, ключей, аккаунтов, аналитики; изображения не генерируются. Настройки — localStorage, история — IndexedDB (запасной вариант — память).

Цель: сайт <https://promts.vibecods.xyz> с production-сборкой, документами и проверенными тестами.

## 2. Инфраструктура на сервере (уже работает)

- Папка проекта: `D:\server-projects\promts.vibecods.xyz`. Docker Desktop, контейнер `promts-web` (nginx:1.27-alpine) раздаёт `./dist` (только чтение) с конфигом `deploy/nginx.conf` (строгий CSP: `script-src 'self'`), healthcheck `/healthz`; сеть `reverse-proxy_default`, портов наружу нет. Описание — `docker-compose.yml`.
- Общий Caddy (контейнер `server-caddy`): в `D:\server-projects\reverse-proxy\Caddyfile` есть блок `promts.vibecods.xyz { … reverse_proxy promts-web:80 }` (эталон — `deploy/Caddyfile.snippet`). Сертификат Let's Encrypt выпущен автоматически; HTTPS → 200, HTTP → HTTPS 308. Применение изменений: `docker exec server-caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile`, затем `docker exec server-caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile`.
- Резервная копия Caddyfile до добавления маршрута: `Caddyfile.backup-promts-20261017`. **Не пересоздавайте Caddy и общую сеть**, не трогайте соседние проекты (`virtual`, `imou`, … — они отвечали 200 до и после).
- Сейчас по домену опубликована **временная заглушка** `dist/index.html`, а не готовое приложение.
- На сервере есть git 2.54, Node 24.16, Docker 29.4, curl, bsdtar, Chrome (`C:\Program Files\Google\Chrome\Application\chrome.exe`). В PowerShell `npm`/`npx` блокируются политикой выполнения — используйте `npm.cmd` / `npx.cmd`.

## 3. Статус по разделам ТЗ

| Раздел ТЗ | Статус |
|---|---|
| 1–2. Граница MVP, физическая согласованность, реализм | Код готов; согласованность проверяют `src/engine/validate.ts` и тесты |
| 3. Панель управления (быстрые/расширенные, авто/вручную/исключить, locks, возраст, внешность, съёмка, ракурс, эмоции, поза, сезон/погода/время/цвет, формат, стиль) | Реализовано в `src/core`, `src/engine`, `src/ui`; **в браузере ещё не проверялось** |
| 4. ≥200 микросцен | В данных 281 сцена, все 7 категорий; `tests/scenes.test.ts` + `tests/pools.test.ts` зелёные (299 тестов) на 15:50. Агенты ещё дописывают файлы `*.scenes.ts` |
| 5. Антидубликаты, режимы, правка и смена аспекта | Реализовано. Тест «окно истории» (>90 уникальных сцен из 120) падал при 151 сцене (89) — перепроверить на 281 |
| 6. Рендер: main/negative/metadata/JSON, профили, экспорт, пакет | Реализовано; добавлены `tests/render-export.test.ts`, `tests/storage.test.ts` (23 теста зелёные) |
| 7. UI/UX: адаптивность, темы, пресеты, импорт/экспорт | Реализовано; мобильный вид и клавиатуру нужно проверить (e2e + скриншоты) |
| 8. Тесты, smoke-тест сборки, доступность | Тесты есть. `scripts/smoke-build.mjs` и `scripts/e2e.mjs` (Chrome + axe-core) **написаны, но ни разу не запускались** — сборки ещё нет |
| 9. Передача: README, ARCHITECTURE, EXAMPLES, TEST_REPORT, dist, ZIP | `EXAMPLES.md` создан на промежуточной библиотеке (перегенерировать). README, ARCHITECTURE, TEST_REPORT **не написаны**; `dist` — заглушка; ZIP нет |

Последние известные результаты: `npx tsc --noEmit` — без ошибок (15:50). `tests/engine.test.ts` + `tests/settings-rng.test.ts` на 15:40 — 94 пройдено, 1 упало (антидубликаты, см. выше). Полный прогон на 281 сцене к моменту снимка не завершился — выполните `npm.cmd test` и ориентируйтесь на него, а не на эти цифры.

## 4. Что осталось (по порядку)

1. `npm.cmd test` целиком; починить красное, не ослабляя тесты.
2. Сверить библиотеку с категорией ТЗ «Еда и досуг»: караоке, бильярд, боулинг, кинотеатр, музей, галерея, концерт, фестиваль, ярмарка, настольные игры, библиотека (`rg -i "karaoke|bowling|museum|library" src/data/scenes`). Чего нет — добавить сценами (формат — `src/data/scenes/AUTHORING.md`, образцы — `_examples.ts`).
3. Проверить качество данных: например, фраза «for street dance» попадает в обычные сцены из `src/data/outfits.ts` (пример: `generateScenario(defaultSettings(), seed 'DEMO-1')`) — убедиться, что подпись одежды не противоречит месту.
4. `npm.cmd run build` → `npm.cmd run smoke` → `npm.cmd run e2e` (`$env:CHROME_PATH` — путь к Chrome). Добавить в e2e проверку клавиатуры (Tab/Enter/Ctrl+Enter), скриншоты десктопа и мобильного вида.
5. Документы: README (установка, запуск, сборка, тесты, развёртывание на обычном хостинге, обоснование выбора библиотек), ARCHITECTURE (структура, алгоритм антидубликатов, правила совместимости, **документированная** точка расширения `ImageProvider`/`GenerationProvider` — только текст, без кода и полей в UI), TEST_REPORT (только реально выполненные команды и ограничения), EXAMPLES (`npm.cmd run examples`; ≥20 промптов с разными возрастами, ракурсами, сезонами, местами и форматами), примеры экспорта в `examples/export/`.
6. Положить сборку в `dist` (nginx читает её без перезапуска), проверить `https://promts.vibecods.xyz` и соседние сайты, затем `E2E_URL=https://promts.vibecods.xyz npm run e2e`.
7. ZIP проекта без `node_modules` и секретов (п. 9.2 ТЗ), лежит рядом с исходниками.

## 5. Как продолжить на сервере

```powershell
cd D:\server-projects\promts.vibecods.xyz
git fetch origin hoplite/andros-913cf564
git reset --hard FETCH_HEAD     # перезапишет отслеживаемые файлы; dist\, handoff\, *.log не затронет
npm.cmd ci
npm.cmd run verify              # typecheck + test + build + smoke
$env:CHROME_PATH = 'C:\Program Files\Google\Chrome\Application\chrome.exe'; npm.cmd run e2e
docker compose up -d            # контейнер уже раздаёт ./dist; пересборка образа не требуется
```

Проверка снаружи: `curl.exe -sI https://promts.vibecods.xyz` (ожидается 200 и заголовки CSP), `curl.exe -sI http://promts.vibecods.xyz` (308 → https).

## 6. Фоновые агенты и риск конфликтов

На момент снимка в песочнице ещё работали агенты, пишущие `src/data/scenes/{home,city,food,nature}.scenes.ts`; в очереди стояли ещё два (food, nature), способные перезаписать `food.scenes.ts` и `nature.scenes.ts`. После их завершения обязателен прогон `tests/scenes.test.ts`: дубли `id`, нарушения правил из `AUTHORING.md` и нехватка сцен в категории ловятся там. Если продолжаете без песочницы, считайте файлы в репозитории итоговыми и проверяйте только тестами.

## 7. Что изменено в движке в этой сессии (и зачем)

- `ratioFromId`: метка пресета равна его id (раньше `21:9` сокращалось до `7:3`).
- Сцены без видимой погоды (`weatherMode: 'irrelevant'`) не выбираются, если погода задана вручную или закреплена.
- `pickAccessories`: сохранённые аксессуары проверяются по числу свободных рук (после смены позы рук могло не хватать).
- Солнцезащитные очки: при сохранённом лице они сами не появляются, а сохранённые остаются только в уместном контексте (компоновщик сужает выбор локации, времени и погоды).
- `editScenario`: правка не подменяет молча локацию или позу — вместо этого отклоняется с понятным сообщением (для автоподбора есть «Сменить …»).
- `generateScenario`: контроль повторов локаций в недавнем окне (без нарушения воспроизводимости по seed + номер попытки).
- `renderScenario().problems`: negative-список проверяется с `allowTextTerms` (слова «logos», «watermarks» там уместны).
- `createMemoryRepo().list()` возвращает копии (как IndexedDB).
- Тексты профилей экспорта без обещаний совместимости. Тест «купальник и лыжи»: купальник зимой допустим только в помещении (бассейн) — это физически правдоподобно.

## 8. Предостережения

- Не коммитьте `node_modules`, `dist`, `handoff`, секреты. Репозиторий публичный.
- Не заявляйте в TEST_REPORT о проверках, которые не запускались; зафиксируйте и ограничения (например, нет реального мобильного устройства — только эмуляция в Chrome).
- Вывод инструментов с длинным текстом может приходить в сжатом пересказе: точные правки делайте, читая файлы небольшими кусками.
