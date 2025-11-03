# План рефакторинга renderer.js и сопутствующего кода

Документ описывает пошаговый подход «сначала тесты → проверка → рефакторинг → проверка» для безопасного расщепления крупного файла `src/renderer.js` и связанных модулей. План разбит на фазы; каждая фаза завершается прогонами автоматических тестов.

---

## Фаза 0 — Подготовка инфраструктуры тестирования

0. **Обновление окружения**
   - Все команды выполняются в Node.js версии 20.0.0 или выше (рекомендуем 24.x).
   - После смены версии выполнить `rm -rf node_modules package-lock.json` и `npm install`, чтобы пересобрать дерево зависимостей.

1. **Выбор инструментов**
   - Юнит/интеграционные тесты: `Vitest` 4.x (Node ≥20).
   - UI/E2E на будущее: `Playwright` (современная альтернатива Spectron).

2. **Подключение зависимостей и конфигурации**
   - Добавить в `package.json` скрипты `test:unit`, `test:watch`, `test:e2e` (пока заглушки).
   - Создать `vitest.config.js` (CommonJS, указать корень, алиасы путей при необходимости).
   - Создать каталоги `tests/unit` и `tests/integration`.

3. **Хелперы для тестов**
   - `tests/helpers/mockDb.js`: обёртка вокруг in-memory SQLite на базе `sql.js` (инициализация, миграции, очистка).
   - `tests/helpers/ipcMock.js`: заглушки `ipcMain.handle`, чтобы проверять, какие методы вызываются.
   - (Позже) `tests/helpers/dom.js`: создание JSDOM и базовых элементов для тестов рендерера.

После Фазы 0 прогоняем `npm run test:unit` (пока тестов нет, но убедиться, что раннер стартует без ошибок).

---

## Фаза 1 — Тестируем критичный код базы данных и main‑процесса

### 1.1 Юнит-тесты для `src/main/db.js`

Создать набор тестов в `tests/unit/db.spec.js`, покрывающий ключевые функции:

1. `createBook(ctx, payload)` и `updateBook(ctx, payload)`
   - Проверить сериализацию массивов (authors, tags, genres) в JSON.
   - Убедиться, что авторы попадают в таблицы `authors` / `book_authors`, дубликаты не плодятся.
   - Проверить обновление поля `updatedAt`.

2. `renameVocabularyValue(ctx, domain, from, to)`
   - Сценарий для `series` и `publisher` (простая замена значения).
   - Сценарий для `authors` (создание нового автора, переназначение `book_authors`, обновление `books.updatedAt`).
   - Сценарий для `tags` и `genres` (обновление JSON-массивов, удаление дубликатов).

3. `listVocabulary(ctx)`
   - Возвращает массивы по доменам с корректным `count`, флагами `sources.books` / `sources.custom`.
   - Добавленные вручную значения присутствуют даже при `count = 0`.

4. `addCustomVocabularyEntry`, `deleteCustomVocabularyEntry`, `listVocabularyBooks`
   - Добавление: значения триммятся, уникальность по паре (domain, value) соблюдается.
   - Удаление: запись исчезает, `persist` вызывается.
   - `listVocabularyBooks`: режет по `limit`, возвращает минимальный набор полей (`id`, `title`, `authors`, `series`, `publisher`).

Каждый тест создаёт in-memory БД, накатывает `migrate`, выполняет операции и проверяет SQL-результаты.

### 1.2 Интеграционные тесты IPC в `src/main.js`

В `tests/integration/ipc-main.spec.js`:

- `ipcMain.handle('books:add')` / `'books:update'`
  - Подставить мок `dbLayer`, проверить нормализацию payload и вызов `logActivity` с диффами.
- `ipcMain.handle('goodreads:lookup')`
  - Смоделировать `preferExistingUrl: true`, убедиться в корректной передаче параметров в провайдер.
- `ipcMain.handle('vocab:list')`, `vocab:addCustom`, `vocab:deleteCustom`, `vocab:rename`, `vocab:listBooks`
  - Проверить, что хэндлеры возвращают `{ ok: true }`, пробрасывают ошибки и формируют полезные payload.

Тесты используют `vi.spyOn` (Vitest) для подмены методов `dbLayer`.

**После Фазы 1** — прогон `npm run test:unit`.

---

## Фаза 2 — Юнит-тесты чистых функций рендерера (без DOM-дерева приложения)

### 2.1 Утилитарные функции (временно остаются в `renderer.js` или выносятся в `renderer/utils.js`)

В `tests/unit/renderer-utils.spec.js` покрыть:

- `escapeHtml`, `parseCommaSeparatedList`, `sanitizeUrl`, `parseFloatFromInput`.
- `renderGoodreadsResult(info)` — проверить, что HTML содержит нужные блоки (использовать JSDOM).
- `applyGoodreadsInfo(info)` — обновление `state.modal` (рейтинг, ссылки, отметка времени).

### 2.2 Функции работы со словарями

- `rebuildSuggestStore(state)` — объединение значений из книг и пользовательских словарей.
- `syncCustomVocabularyFromVocabState()` — перенос кастомных значений в `state.customVocabulary`.
- `getVocabBookState`, `renderVocabBooksContent`, `updateVocabBooksUI` — корректное состояние (idle/loading/error/loaded).

Тесты располагаем в `tests/unit/renderer-vocab.spec.js`.

**После Фазы 2** — прогон `npm run test:unit`.

---

## Фаза 3 — Интеграционные тесты рендерера (без полноценного окна)

Цель — проверить связку `window.api` ↔ функции рендерера на примере словарей:

- В `tests/integration/renderer-vocab.spec.js` инициализировать минимальный DOM (вставить контейнер `#vocabList`), смонтировать функции словарей, подставить мок `window.api`.
- Проверить сценарий:
  1. Открытие словаря (установка состояния, выбор необходимых кнопок).
  2. Клик по «Показать книги» → мок `window.api.listVocabularyBooks` возвращает данные → DOM обновляется.
  3. Клик по «Открыть» → вызов `openDetails(book)` (подменить на шпион).

Тест — интеграционный, но без запуска Electron. Используем JSDOM и ферзину `document.body.innerHTML`.

**После Фазы 3** — прогон `npm run test:unit` (интеграции входят туда же или отдельным `test:integration`).

---

## Фаза 4 — Модульный рефакторинг рендерера (после подготовки тестов)

1. **Вынос утилит**
   - Создать `src/renderer/utils.js`, перенести туда чистые функции.
   - Обновить импорты в `renderer.js` и тестах.
   - Прогон тестов.

2. **Выделение словарей**
   - Создать `src/renderer/vocab_manager.js`, экспортирующий `initVocabularyManager(state, uiRefs)`.
   - Перенести код работы со словарями (состояние, обработчики, рендеринг).
   - Тесты указывают на новый модуль (обновить импорты).
   - Прогон тестов.

3. **Разделение больших блоков**
   - Аналогично вынести CSV-импорт (`renderer/csv_import.js`), менеджер мест хранения (`renderer/storage_manager.js`), историю (`renderer/history_view.js`).
   - Перед каждым переносом при необходимости дописать тесты на соответствующие функции (например, `prepareBooksForImport`).
   - После каждого переноса — прогон тестов.

4. **Перестройка состояния**
   - Создать `src/renderer/state.js` с фабрикой `createState()`, которая группирует `libraryState`, `modalState`, `vocabState`, `activityState`.
   - Обновить места, где состояние используется, в соответствии со структурой.
   - Прогон тестов.

---

## Фаза 5 — Расширение тестового покрытия

1. **Снэпшоты и дополнительные тесты**
   - Добавить снапшот-тесты для рендера словарей и карточек книг.
   - Дополнить тесты CSV-импортера, логики коллекций и синхронизации.

2. **Playwright (UI smoke)**
   - Сценарий 1: запуск приложения, открытие словаря, добавление значения, показ книг, открытие карточки.
   - Сценарий 2: редактирование книги, поиск по Goodreads, проверка сохранения полей.
   - Настроить отдельный npm-скрипт и документировать процесс.

**После Фазы 5** — прогон `npm run test:unit` и (по готовности) `npm run test:e2e`.

---

## Фаза 6 — Интеграция в CI и документация

1. **CI**
   - Добавить шаг `npm run test:unit` в GitHub Actions (до сборки релиза).
   - По готовности добавить smoke-тесты Playwright (например, на Linux runner).

2. **Документация**
   - Обновить `RELEASE.md`/`README` описанием новых тестовых команд.
   - Внутри репозитория хранить `REFACTORING.md` (этот документ) и актуализировать его по мере выполнения фазы.

---

## Краткое резюме выполнения

1. ✅ Настроить Vitest и инфраструктуру (Фаза 0) → прогнать тесты.
2. ✅ Покрыть функции `db.js` и IPC main-процесса (Фаза 1) → прогнать тесты.
3. ✅ Покрыть чистые функции рендерера (Фаза 2) → прогнать тесты.
4. ✅ Сделать лёгкие интеграционные тесты DOM в JSDOM (Фаза 3) → прогнать тесты.
5. ✅ Рефакторить по модулям, после каждого шага — `npm run test:unit`.
6. ✅ Добавить UI smoke-тесты, интегрировать в CI и обновить документацию.

---

## Статус выполнения (2025-11-03)

### ✅ Фаза 0 — Инфраструктура тестирования (ВЫПОЛНЕНО)
- ✅ Установлен Vitest, настроен `vitest.config.mjs`
- ✅ Создан `tests/setup/global.mjs`
- ✅ Добавлен smoke-тест для проверки работы Vitest
- ✅ Скрипты `test:unit` и `test:watch` в package.json

### ✅ Фаза 1 — Тесты главного процесса (ВЫПОЛНЕНО)
- ✅ **Фаза 1.1**: Тесты для `src/main/db.js` (5 тестов)
  - createBook, updateBook, renameVocabularyValue
  - listVocabulary, listVocabularyBooks
- ✅ **Фаза 1.2**: Тесты IPC-хендлеров в `src/main.js` (8 тестов, 2 skipped)
  - books:add, books:delete, vocab:add, vocab:delete
  - vocab:rename, vocab:list, vocab:listBooks

### ✅ Фаза 2 — Unit-тесты рендерера (ВЫПОЛНЕНО)
- ✅ **Фаза 2.1**: Утилиты рендерера (31 тест)
  - escapeHtml, sanitizeUrl, parseCommaSeparatedList
  - parseFloatFromInput, renderGoodreadsResult, applyGoodreadsInfo
- ✅ **Фаза 2.2**: Vocabulary функции (18 тестов)
  - rebuildSuggestStore, syncCustomVocabularyFromVocabState
  - getVocabBookState, renderVocabBooksContent, updateVocabBooksUI

### ✅ Фаза 3 — Интеграционные тесты (ВЫПОЛНЕНО)
- ✅ Тесты взаимодействия vocabulary с DOM (10 тестов)
- ✅ Проверка state management, HTML rendering, XSS prevention
- ✅ Использование JSDOM для симуляции браузерного окружения

### ✅ Фаза 4 — Модульный рефакторинг (ВЫПОЛНЕНО)
- ✅ **4.1**: Создан `src/renderer/utils.js` — утилиты (4 функции)
- ✅ **4.2**: Создан `src/renderer/vocab_manager.js` — управление словарями
- ⏸️ **4.3**: CSV-импорт, места хранения (отложено)
- ✅ **4.4**: Создан `src/renderer/state.js` — централизованное состояние

### ✅ Фаза 5 — Расширение покрытия (ВЫПОЛНЕНО)
- ✅ **5.1**: Snapshot-тесты рендеринга (7 тестов)
- ✅ **5.1**: CSV-парсер и маппинг (21 тест)
- ✅ **5.1**: Collections и filter presets (16 тестов)
- ✅ **5.2**: Playwright E2E тесты (19 smoke тестов)
  - Vocabulary management workflow (8 тестов)
  - Book editing & Goodreads (11 тестов)
- ✅ **5.2**: Документация E2E тестов (`tests/e2e/README.md`)

### ✅ Фаза 6 — CI и документация (ВЫПОЛНЕНО)
- ✅ **6.1**: Интеграция тестов в `.github/workflows/release.yml`
- ✅ **6.1**: Создан `.github/workflows/ci.yml` для PR/push
- ✅ **6.2**: Обновлен `RELEASE.md` с секцией о тестировании
- ✅ **6.2**: Обновлен `REFACTORING.md` с финальным статусом

---

## Итоговая статистика

### Тесты
- **Unit-тесты**: 115 passing, 2 skipped (117 total)
- **E2E тесты**: 19 smoke tests
- **Snapshots**: 7 файлов
- **Общее покрытие**: ~134 тестовых случая

### Структура кода
- **Новые модули**: 3 (`utils.js`, `vocab_manager.js`, `state.js`)
- **Тестовые файлы**: 9 unit + 1 integration + 2 E2E
- **CI workflows**: 2 (ci.yml, release.yml)
- **Документация**: обновлены RELEASE.md, REFACTORING.md, создан tests/e2e/README.md

### Коммиты
- Фаза 0-3: ~3 коммита
- Фаза 4: 4 коммита (рефакторинг модулей)
- Фаза 5: 2 коммита (тесты и Playwright)
- Фаза 6: 2 коммита (CI и документация)
- **Всего**: ~11 коммитов

---

## Команды для запуска

```bash
# Unit-тесты
npm run test:unit

# Unit-тесты в watch режиме
npm run test:watch

# E2E тесты (headless)
npm run test:e2e

# E2E тесты с окном
npm run test:e2e:headed

# E2E тесты с отладчиком
npm run test:e2e:debug
```

---

## Следующие шаги (опционально)

1. **Расширение покрытия**:
   - Добавить тесты для CSV-импорта (UI workflow)
   - Тесты для sync manager и providers
   - Snapshot-тесты для карточек книг

2. **E2E тесты**:
   - Добавить сценарий для CSV-импорта
   - Тесты синхронизации
   - Тесты коллекций

3. **Performance**:
   - Добавить бенчмарки для критических функций
   - Профилирование рендеринга больших списков

4. **Дополнительная документация**:
   - Создать TESTING.md с подробными гайдами
   - Документировать best practices для тестов
   - Примеры написания тестов для новых функций

Придерживаясь такого цикла «(добавить тесты → прогнать → изменить код → прогнать)», можно безопасно уменьшать технический долг и раскладывать `renderer.js` на удобные для сопровождения модули.
