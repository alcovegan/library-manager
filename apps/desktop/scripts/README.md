# Скрипты desktop-приложения

| Скрипт | Статус | Назначение | Можно перезапускать | Dry-run | Resume | Последняя проверка |
|---|---|---|---:|---:|---:|---|
| `scripts/patch-electron-name.js` | active | В dev-режиме переименовывает Electron.app в «Library Manager» (Info.plist), запускается из `postinstall` | да | нет | — | 2026-11-24 |
| `scripts/capture-docs-screenshots.mjs` | active | Снимает скриншоты desktop для документации (`apps/docs`) на демо-данных, в скрытом окне | да | нет | `--only` | 2026-11-24 |
| `scripts/seed-demo-library.js` | active | Создаёт демо-библиотеку (20 книг из общественного достояния, коллекции, места хранения) для e2e и скриншотов документации | да, с `--force` | да | не нужен | 2026-11-24 |

## Изолированный запуск приложения

Эти переменные окружения нужны для e2e, скриншотов и демонстраций. С ними реальная библиотека
в `~/Library/Application Support/Library Manager` не используется.

| Переменная | Что делает |
|---|---|
| `LIBRARY_MANAGER_USER_DATA_DIR=<path>` | Хранить базу, обложки и настройки в `<path>` |
| `LIBRARY_MANAGER_HEADLESS=1` | Скрытое окно, без иконки в Dock и без уведомлений |
| `LIBRARY_MANAGER_NO_DOTENV=1` | Не загружать ключи из `.env` |

```bash
node scripts/seed-demo-library.js --dir /tmp/lm-demo --force
LIBRARY_MANAGER_USER_DATA_DIR=/tmp/lm-demo LIBRARY_MANAGER_NO_DOTENV=1 npm run dev
```
