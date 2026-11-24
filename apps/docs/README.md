# Library Manager — документация

Пользовательская документация на [Astro Starlight](https://starlight.astro.build). Язык — русский
(локаль `root`, структура готова к добавлению английской).

```bash
npm run dev -w docs          # http://localhost:23170
npm run build -w docs        # статический сайт в apps/docs/dist
npm run screenshots -w docs  # переснять скриншоты desktop на демо-данных
```

- Страницы: `src/content/docs/**` (Markdown/MDX), навигация — `sidebar` в `astro.config.mjs`.
- Скриншоты: `src/assets/screenshots/desktop/*.png`. Их снимает
  `apps/desktop/scripts/capture-docs-screenshots.mjs` в скрытом окне на демо-библиотеке, без
  реальных данных и ключей. Не заменяйте их скриншотами с вашей библиотеки.
- Мобильное приложение пока описано без скриншотов: для них нужен iOS-симулятор.
