---
title: Выкладка в TestFlight
description: Пошаговая инструкция, как собрать iOS-приложение и выложить его в TestFlight — через EAS или через Xcode.
---

TestFlight — сервис Apple для установки бета-версий на свои устройства без публикации в App Store.
Сборку для себя и до 100 человек из команды Apple не проверяет.

## Что уже есть в проекте

| Параметр | Значение |
|---|---|
| Bundle ID | `com.alcovegan.librarymanager` |
| Название | Library Manager |
| Версия | `1.0.0` (`apps/mobile/app.json`) |
| Expo SDK | 58, React Native 0.88, New Architecture включена |
| `eas.json` | **нет** — создаётся на шаге EAS |
| iOS-проект | генерируется `expo prebuild` в `apps/mobile/ios` (в git не хранится) |

## Шаг 0. Аккаунты

1. **Apple Developer Program** — платная подписка, $99 в год: https://developer.apple.com/programs/
2. Для пути через EAS — бесплатный аккаунт **Expo**: https://expo.dev/signup

## Шаг 1. Приложение в App Store Connect

1. https://developer.apple.com/account/resources/identifiers/list → **+** → **App IDs** → **App**.
   Bundle ID — `com.alcovegan.librarymanager` (Explicit).
2. https://appstoreconnect.apple.com → **Apps** → **+** → **New App**: платформа iOS, имя
   Library Manager, основной язык — русский, Bundle ID — созданный выше, SKU — например
   `library-manager-ios`.

Название в App Store должно быть уникальным. Если «Library Manager» занято, задайте другое имя в
App Store Connect — на устройстве останется прежнее название.

## Шаг 2. Подготовка проекта

В `apps/mobile/app.json` в секцию `expo.ios` добавьте номер сборки и ответ про шифрование. Без него
каждая сборка будет висеть в статусе «Missing Compliance»:

```json
"ios": {
  "supportsTablet": true,
  "bundleIdentifier": "com.alcovegan.librarymanager",
  "buildNumber": "1",
  "config": { "usesNonExemptEncryption": false }
}
```

Приложение использует только HTTPS, поэтому ответ «не использует нестандартное шифрование» корректен.

## Путь А — EAS (рекомендуется)

Сборка идёт в облаке Expo, сертификаты и профили EAS создаёт сам.

```bash
npm install -g eas-cli
eas login
cd apps/mobile
eas build:configure          # создаст eas.json
eas build --platform ios --profile production
eas submit --platform ios --latest
```

При первом `eas build` EAS попросит войти в Apple ID и сам создаст Distribution Certificate и
Provisioning Profile. `eas submit` загрузит сборку в App Store Connect.

Для автоматического увеличения номера сборки в `eas.json` у профиля `production` поставьте
`"ios": { "autoIncrement": true }`.

## Путь Б — локально через Xcode

Нужен Xcode с установленной платформой iOS (**Xcode → Settings → Components**).

```bash
cd apps/mobile
npx expo prebuild --platform ios --clean
open ios/LibraryManager.xcworkspace
```

В Xcode:

1. Таргет **LibraryManager** → **Signing & Capabilities** → включить **Automatically manage
   signing** и выбрать свою команду (Team).
2. Схема **LibraryManager**, устройство — **Any iOS Device (arm64)**.
3. **Product → Archive**.
4. В окне **Organizer** → **Distribute App** → **App Store Connect** → **Upload**.

Вместо Organizer можно экспортировать `.ipa` и загрузить его приложением
[Transporter](https://apps.apple.com/app/transporter/id1450874784).

## Шаг 3. TestFlight

1. App Store Connect → приложение → **TestFlight**. Сборка обрабатывается от 5 до 30 минут.
2. Если сборка в статусе **Missing Compliance**, ответьте, что приложение не использует нестандартное
   шифрование. С настройкой из шага 2 вопрос не возникает.
3. **Internal Testing** → **+** → создайте группу и добавьте себя. Внутренним тестерам ревью не нужно.
4. На iPhone поставьте **TestFlight** из App Store и примите приглашение из письма.

**External Testing** (до 10 000 человек, публичная ссылка) требует ревью Apple для первой сборки
каждой версии — обычно 1–2 дня.

## Следующие версии

1. Поднимите `version` (видна пользователю) и/или `ios.buildNumber` в `app.json`. Номер сборки
   должен расти с каждой загрузкой.
2. Повторите `eas build` + `eas submit` или **Archive → Distribute**.

Сборка в TestFlight живёт 90 дней, потом её нужно обновить.

## Частые проблемы

| Проблема | Решение |
|---|---|
| `iOS … is not installed` при сборке в Xcode | Установите платформу iOS в **Xcode → Settings → Components** |
| «Bundle ID уже используется» | ID занят другим аккаунтом — смените `bundleIdentifier` |
| Сборка отклонена из-за номера | Увеличьте `ios.buildNumber` |
| Missing Compliance | `ios.config.usesNonExemptEncryption: false` |
| Вход через Яндекс / Google / Dropbox не возвращается в приложение | Проверьте, что в настройках OAuth-приложения разрешён redirect `librarymanager://auth/<провайдер>` |
