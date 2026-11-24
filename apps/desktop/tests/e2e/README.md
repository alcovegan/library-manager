# E2E Tests (Playwright + Electron)

End-to-end тесты для приложения Library Manager с использованием Playwright.

**⚠️ STRICT MODE:** Все E2E тесты написаны в строгом режиме:
- Никаких условных `if` проверок
- Все элементы ДОЛЖНЫ существовать
- Тесты падают при любой проблеме
- Используется `test.skip()` только для опциональных сценариев

## Структура

```
tests/e2e/
├── README.md                      # Эта документация
├── helpers/
│   └── electron-launcher.js       # Вспомогательные функции для запуска Electron
├── vocabulary.e2e.js              # Тесты управления словарями (STRICT MODE)
├── book-edit.e2e.js               # Тесты редактирования книг и Goodreads (STRICT MODE)
└── screenshots/                   # Скриншоты при ошибках (gitignored)
```

## Установка

Зависимости уже должны быть установлены через `npm install`. Если нет:

```bash
npm install --save-dev playwright @playwright/test
```

## Запуск тестов

### Headless режим (по умолчанию)
```bash
npm run test:e2e
```

### С видимым браузером (headed)
```bash
npm run test:e2e:headed
```

### Debug режим (с пошаговым выполнением)
```bash
npm run test:e2e:debug
```

## Принципы написания E2E тестов

### ✅ ПРАВИЛЬНО (STRICT MODE)

```javascript
// 1. Строгие проверки - элемент ДОЛЖЕН существовать
const button = window.locator('#createBtn');
await expect(button).toBeVisible();
await button.click();

// 2. Проверяем результат - модал ДОЛЖЕН открыться
const modal = window.locator('#modal');
await expect(modal).toBeVisible({ timeout: 3000 });

// 3. Проверяем контент - значение ДОЛЖНО совпасть
const input = window.locator('#titleInput');
await input.fill('Test');
expect(await input.inputValue()).toBe('Test');
```

### ❌ НЕПРАВИЛЬНО (плохие практики)

```javascript
// 1. НЕ используйте условные if - тест не упадёт
if (await button.isVisible()) {
  await button.click(); // ❌ Если кнопки нет, тест пройдёт
}

// 2. НЕ ловите ошибки - скрывает проблемы
const isVisible = await modal.isVisible().catch(() => false); // ❌

// 3. НЕ делайте always-passing проверки
expect(isVisible || true).toBeTruthy(); // ❌ Всегда проходит

// 4. НЕ используйте только not.toThrow
expect(() => someAction()).not.toThrow(); // ❌ Проверяет мало
```

### 🟡 Опциональные сценарии (зависят от данных)

```javascript
// Используйте test.skip() если данные могут отсутствовать
test('should interact with entry if data exists', async () => {
  const entries = window.locator('.vocab-entry');
  const count = await entries.count();

  if (count === 0) {
    test.skip(); // ✅ Пропускаем если нет данных
    return;
  }

  // Если данные есть - строгие проверки
  await expect(entries.first()).toBeVisible();
  await entries.first().click();
  // ...
});
```

## Сценарии тестов

### 1. Vocabulary Management (`vocabulary.e2e.js`) - 10 тестов
**Strict checks:**
- ✅ Загрузка приложения и основного интерфейса
- ✅ Открытие менеджера словарей
- ✅ Наличие всех вкладок (genres, tags, publisher, series, authors)
- ✅ Переключение между доменами
- ✅ Отображение контента (записи или empty state)

**Optional checks (if data exists):**
- 🟡 Клик по записи словаря (skip if no entries)
- 🟡 Отображение книг по значению (skip if no entries)

### 2. Book Editing & Goodreads (`book-edit.e2e.js`) - 16 тестов
**Strict checks:**
- ✅ Загрузка списка книг
- ✅ Наличие кнопки создания книги
- ✅ Открытие модала создания
- ✅ Наличие всех полей (title, authors, Goodreads fields)
- ✅ Ввод данных в поля
- ✅ Заполнение английских метаданных
- ✅ Наличие кнопки поиска Goodreads
- ✅ Выполнение поиска Goodreads
- ✅ Отображение статуса поиска
- ✅ Наличие кнопки сохранения
- ✅ Закрытие модала после сохранения
- ✅ Обновление списка книг

## Важные замечания

### Тестовое окружение
- Реальная библиотека не используется: launcher создаёт временный каталог данных и задаёт
  `LIBRARY_MANAGER_USER_DATA_DIR`. После запуска он проверяет `app.getPath('userData')` и падает,
  если изоляции нет. При выходе каталог удаляется.
- Каталог заполняется демо-библиотекой из `scripts/seed-demo-library.js`: 20 книг из общественного
  достояния, коллекции, места хранения, статусы чтения.
- Окно скрыто, иконки в Dock нет (`LIBRARY_MANAGER_HEADLESS=1`), размер окна 1280×800.
- `.env` не загружается (`LIBRARY_MANAGER_NO_DOTENV=1`), а переменные с ключами и токенами
  вырезаются из окружения, поэтому реальные ключи в приложение не попадают.
- Между файлами тестов интерфейс перезагружается. Тесты внутри одного файла идут как
  последовательный сценарий.
- Тесты запускаются **последовательно** (workers: 1), так как Electron не может быть запущен параллельно

### Скриншоты и видео
- Скриншоты создаются только при ошибках
- Видео записываются только при ошибках
- Файлы сохраняются в `test-results/` и `playwright-report/`

### Таймауты
- Тест: 60 секунд
- Ассерты: 10 секунд
- Можно настроить в `playwright.config.js`

## Troubleshooting

### Electron не запускается
Убедитесь, что:
1. `npm install` выполнен успешно
2. Electron установлен: `npx electron --version`
3. Путь к `main.js` корректен в `electron-launcher.js`

### Тесты падают с таймаутом
Увеличьте таймауты в `playwright.config.js`:
```javascript
timeout: 120000, // 2 минуты
```

### Селекторы не найдены
Проверьте актуальность селекторов в тестах. UI приложения мог измениться.
Используйте Playwright Inspector для отладки:
```bash
npm run test:e2e:debug
```

## Добавление новых тестов

1. Создайте файл `<feature>.e2e.js` в `tests/e2e/`
2. Импортируйте хелперы из `./helpers/electron-launcher.js`
3. Используйте `beforeAll` для запуска приложения
4. Используйте `afterAll` для закрытия приложения
5. Пишите тесты с использованием Playwright API

Пример:
```javascript
import { test, expect } from '@playwright/test';
import { launchElectronApp, closeElectronApp } from './helpers/electron-launcher.js';

let app, window;

test.beforeAll(async () => {
  const result = await launchElectronApp();
  app = result.app;
  window = result.window;
});

test.afterAll(async () => {
  await closeElectronApp(app);
});

test('should do something', async () => {
  await window.locator('#myButton').click();
  await expect(window.locator('#result')).toBeVisible();
});
```

## CI/CD интеграция

Для запуска в CI (например, GitHub Actions):

```yaml
- name: Run E2E tests
  run: npm run test:e2e
  env:
    CI: true
```

В CI тесты автоматически:
- Запускаются в headless режиме
- Делают 2 retry при падении
- Сохраняют артефакты (скриншоты, видео) при ошибках

## Полезные ссылки

- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Electron Testing with Playwright](https://playwright.dev/docs/api/class-electron)
- [Playwright Config Reference](https://playwright.dev/docs/test-configuration)

