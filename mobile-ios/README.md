# Медицинский ассистент — iOS (App Store)

Отдельная копия Expo-приложения для **публикации и обслуживания только в App Store**. Код и функциональность совпадают с `mobile-android/` (Google Play).

| Папка | Назначение |
|-------|------------|
| `mobile-ios/` | iOS, TestFlight, App Store |
| `mobile-android/` | Android, Google Play |

Backend — общий Next.js в корне репозитория (`npm run dev` на порту 3000).

## Быстрый старт

```bash
cd mobile-ios
npm install
cp .env.example .env   # при необходимости задайте EXPO_PUBLIC_API_BASE_URL
npm run start:lan      # Metro на 8082, чтобы не конфликтовать с mobile-android (8081)
```

В другом терминале из корня проекта:

```bash
npm run dev
```

Откройте приложение в **симуляторе** (`i` в терминале Expo) или на **iPhone** через Expo Go / development build.

## Скрипты

| Команда | Описание |
|---------|----------|
| `npm run start` / `ios` | Expo, фокус на iOS |
| `npm run start:lan` | LAN + порт **8082** |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |

## API

- `EXPO_PUBLIC_API_BASE_URL` — production / staging.
- Без переменной: симулятор → `http://localhost:3000`, устройство → IP Mac из Metro (как в QR).

## Сборка и App Store

Подробно: [PUBLISH_APP_STORE.md](./PUBLISH_APP_STORE.md).

Кратко:

```bash
npm install -g eas-cli
eas login
cp eas.json.example eas.json
# Замените bundleIdentifier в app.json и projectId в extra.eas при необходимости
eas build:configure
eas build --platform ios --profile production
eas submit --platform ios --profile production
```

## Синхронизация с Android

При доработке фич копируйте изменения между `mobile-android/` и `mobile-ios/` (или вынесите общий пакет позже). Сейчас проекты **независимые копии** для разных магазинов.

Статус функций: [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md), паритет с вебом: [WEB_PARITY.md](./WEB_PARITY.md).
