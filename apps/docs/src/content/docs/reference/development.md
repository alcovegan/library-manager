---
title: Для разработчика
description: Как запустить проект из исходников, прогнать тесты, обновить скриншоты документации и выпустить релиз.
---

## Структура репозитория

Монорепозиторий на npm workspaces:

| Путь | Что |
|---|---|
| `apps/desktop` | Electron-приложение (JavaScript) |
| `apps/mobile` | Expo / React Native (TypeScript) |
| `apps/docs` | Эта документация (Astro Starlight) |
| `packages/shared` | Общий код: схема БД, палитры, слияние при синхронизации |

Требуется **Node.js 22.12+** (рекомендуется 24 LTS).

## Запуск

```bash
npm install
npm run dev              # desktop
npm run mobile           # mobile: Expo dev server
npm run dev -w docs      # документация: http://localhost:23170
```

## Изолированный запуск

По умолчанию desktop работает с вашей настоящей библиотекой. Для экспериментов запустите его на
демо-данных:

```bash
node apps/desktop/scripts/seed-demo-library.js --dir /tmp/lm-demo --force
LIBRARY_MANAGER_USER_DATA_DIR=/tmp/lm-demo LIBRARY_MANAGER_NO_DOTENV=1 npm run dev
```

| Переменная | Что делает |
|---|---|
| `LIBRARY_MANAGER_USER_DATA_DIR` | Хранить базу, обложки и настройки в указанной папке |
| `LIBRARY_MANAGER_HEADLESS=1` | Скрытое окно, без иконки в Dock и уведомлений |
| `LIBRARY_MANAGER_NO_DOTENV=1` | Не подгружать ключи из `.env` |

## Тесты

```bash
npm run test:unit        # vitest
npm run test:e2e         # Playwright + Electron
```

E2E-тесты сами создают временную демо-библиотеку, запускают окно скрытым и никогда не трогают
настоящую библиотеку: launcher проверяет путь к данным и падает, если изоляции нет.

## Скриншоты документации

Скриншоты desktop снимаются скриптом на демо-данных — без ваших книг и ключей:

```bash
npm run screenshots -w docs
# или выборочно:
node apps/desktop/scripts/capture-docs-screenshots.mjs --only main,settings
```

PNG сохраняются в `apps/docs/src/assets/screenshots/desktop/`.

## Релиз desktop

1. Поднимите версию в `package.json` и `apps/desktop/package.json`.
2. Закоммитьте, поставьте тег `vX.Y.Z` и запушьте тег.
3. GitHub Actions соберёт macOS и Windows и выложит файлы в **черновик** релиза.
4. Проверьте черновик и опубликуйте его: только опубликованный релиз увидят автообновления.

Подробности — в `RELEASE.md` в корне репозитория.
