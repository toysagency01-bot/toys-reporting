# TOYS Agency Platform

Новый Cloudflare-фундамент для переноса дашбордов и CRM с Google Sheets и GitHub Pages.

## Статус

Этап 1 подготовлен изолированно. HOUSEVIP выбран первым параллельным пилотом; действующий HOUSEVIP и остальные дашборды, таблицы и Apps Script не переключены и продолжают работать как раньше.

Готово:

- схема единой многоклиентской базы D1;
- 15 активных проектов заведены как `draft`;
- рекламные метрики, лиды, история статусов, комментарии, продажи и недельные итоги;
- журнал синхронизаций и аудит изменений;
- публичный health-check без клиентских данных;
- закрытый внутренний API с отдельным серверным токеном;
- ежедневный Cron-каркас;
- автономные тесты миграций и API.
- обезличенный HOUSEVIP-пилот: типизированный project-scoped API и отдельный интерфейс;
- legacy `/api/public/projects/*` закрыт (`410`), персональные данные лидов намеренно исключены из Git, MVP API и preview.

## Локальная проверка без Cloudflare-аккаунта

```powershell
node --check src/index.js
node --test tests/*.test.mjs
```

## HOUSEVIP local MVP (ветка `codex/local-mvp-housevip`)

MVP работает только локально и не использует production D1. Отдельный
`wrangler.mvp.jsonc` содержит фиктивный database ID и `ENVIRONMENT=local`;
v2 API отвергает dev-токены при `ENVIRONMENT=production`.

Безопасный snapshot не хранится в Git. Перед запуском материализуйте
`HOUSEVIP-pilot-snapshot-2026-10-09.json` из Library в приватный путь и укажите
его абсолютное имя в `HOUSEVIP_SNAPSHOT_PATH`.

```bash
cd /workspace/toys-reporting/platform

pnpm install --frozen-lockfile
cp .dev.vars.example .dev.vars
# Замените MVP_VIEW_TOKEN и MVP_EDITOR_TOKEN локальными значениями длиной >= 24.

pnpm mvp:db:migrate
HOUSEVIP_SNAPSHOT_PATH=/absolute/path/HOUSEVIP-pilot-snapshot-2026-10-09.json \
  pnpm mvp:db:import:housevip
pnpm mvp:db:import:demo
pnpm mvp:dev
```

Локально доступны:

- `/housevip-cxp7/` — реальная обезличенная копия HOUSEVIP;
- `/demo-commerce-mvp/` — синтетический e-commerce;
- `/demo-commerce-mvp/instashop.html` — синтетический Instashop.

Введите локальный project-scoped view или editor token. Editor token нужен для
атомарного сохранения и публикации HOUSEVIP-ревизий. Эти localhost-маршруты —
только команды разработчика, не ссылка для пользовательского preview.

Если sandbox не разрешает pnpm писать в домашний каталог, используйте
workspace-safe каталоги:

```bash
XDG_DATA_HOME=/tmp/toys-pnpm pnpm install --frozen-lockfile \
  --store-dir /tmp/toys-pnpm-store
XDG_CONFIG_HOME=/tmp/toys-xdg ./node_modules/.bin/wrangler d1 migrations apply \
  TOYS_DB --config wrangler.mvp.jsonc --local --persist-to .wrangler/mvp-state
```

### Реализованный срез

- source snapshot валидируется по схеме, privacy-флагам и control totals;
- импорт создаёт immutable generation с campaign-day observations и typed
  metric values, затем публикует один release pointer;
- повтор того же импорта идемпотентен и не создаёт вторую release; runner
  проверяет CAS pointer после записи и завершает процесс ошибкой, если уже
  импортированный release не является текущим;
- `GET /api/v2/projects/housevip-cxp7/dashboard` возвращает строковые decimal,
  lineage, grain, timezone, release/config revisions и partial coverage;
- `GET /api/v2/projects/housevip-cxp7/content?logicalKey=weekly-main` читает
  опубликованную редакцию;
- `POST .../content/weekly-main/save-and-publish` одной D1 batch создаёт
  immutable revision, CAS-обновляет published pointer и возвращает readback;
  повтор того же payload использует тот же idempotency key;
- существующий HOUSEVIP экран и стили сохранены; первый экран подключён к v2,
  а «Еженедельная сводка» получила редактор/историю без отдельного редизайна;
- все старые публичные project endpoints возвращают `410`; PII не входит в
  snapshot, локальную БД, fixtures, MVP API или screenshots.

Синтетические ecom/Instashop контракты и подключаемые экраны используют
отдельный project `demo-commerce-mvp`. Они фиксируют alternative
account/campaign views (не сумму), fractional conversions, BS override с нулём,
project-daily Instashop sales и раздельные UAH/raw USD. В HOUSEVIP эти строки не
подмешиваются.

### Проверенное покрытие и ограничения

Фактические контрольные суммы, даты покрытия и клиентские метрики намеренно не
хранятся в Git. Их предоставляет отдельный приватный snapshot, который импортёр
проверяет до записи. Отсутствующие даты помечаются `missing`, а не нулём;
неизвестные account и campaign identifiers не восстанавливаются догадкой.

Реальные CRM-контакты, тексты project tabs и production D1 export в MVP-ветку
не входят. Поэтому MVP не утверждает полную миграцию контента/CRM или свежесть
за пределами coverage, возвращённого конкретным приватным snapshot.

## Тестовый Cloudflare-контур

Создан 28 сентября 2026 года без платного тарифа и без изменения DNS:

- Worker: `toys-agency-platform.denys-shpodaris.workers.dev`;
- D1: `toys-agency` (`d4a52154-5b79-49fb-af07-37e9228c7172`);
- базовые миграции применены, 15 проектов добавлены; HOUSEVIP активируется отдельной пилотной миграцией;
- `/api/health` проверен с ответом `200` и рабочим соединением с D1;
- `/api/internal/projects` закрыт и без токена возвращает `401`.

Не настроены: служебный токен, авторизация пользователей, защищённый импорт лидов,
Cron-синхронизация, GitHub CI и собственный домен. Действующие отчеты остаются на
GitHub Pages и Google Sheets до отдельного контролируемого переключения.

## Следующие этапы

См. [docs/MIGRATION_PLAN.md](docs/MIGRATION_PLAN.md).

