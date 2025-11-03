# E2E Tests (Playwright + Electron)

End-to-end тесты для приложения Library Manager с использованием Playwright.

## Структура

```
tests/e2e/
├── README.md                      # Эта документация
├── helpers/
│   └── electron-launcher.js       # Вспомогательные функции для запуска Electron
├── vocabulary.e2e.js              # Тесты управления словарями
├── book-edit.e2e.js               # Тесты редактирования книг и Goodreads
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

## Сценарии тестов

### 1. Vocabulary Management (`vocabulary.e2e.js`)
Проверяет работу с словарями:
- Открытие менеджера словарей
- Отображение вкладок словарей (жанры, авторы, и т.д.)
- Переключение между доменами словарей
- Отображение записей словаря
- Клик по записи и отображение книг
- Открытие книги из списка

### 2. Book Editing & Goodreads (`book-edit.e2e.js`)
Проверяет редактирование книг и поиск в Goodreads:
- Открытие списка книг
- Создание новой книги
- Заполнение полей книги
- Заполнение английских метаданных
- Поиск в Goodreads
- Отображение результатов Goodreads
- Сохранение книги

## Важные замечания

### Тестовое окружение
- Тесты запускаются с `NODE_ENV=test` и `ELECTRON_TEST=true`
- Рекомендуется использовать тестовую базу данных, чтобы не повредить реальные данные
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

