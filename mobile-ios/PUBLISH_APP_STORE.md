# Публикация в App Store

## Требования

- Apple Developer Program ($99/год)
- Mac с Xcode (для локальной отладки; production-сборка — через EAS)
- Иконка 1024×1024 PNG (без альфа-канала для App Store)
- Скриншоты для iPhone (и iPad, если `supportsTablet: true`)

## 1. Идентификаторы

В `app.json`:

- `ios.bundleIdentifier` — уникальный ID, например `com.yourcompany.medicalassistant`
- `ios.buildNumber` — целое, **увеличивать** при каждой загрузке в App Store Connect
- `version` — маркетинговая версия (1.0.0, 1.0.1…)

После смены `bundleIdentifier` выполните `eas init` и обновите `extra.eas.projectId`.

## 2. Права (Privacy)

Уже заданы в `infoPlist` и плагине `expo-image-picker`:

- Камера
- Фото / галерея

При добавлении микрофона, геолокации и т.д. — дополните `infoPlist` и App Store Connect → App Privacy.

## 3. Production API

В `eas.json` (профиль `production`):

```json
"env": {
  "EXPO_PUBLIC_API_BASE_URL": "https://your-production-api.com"
}
```

На бэкенде включите HTTPS и CORS для мобильного клиента.

## 4. EAS Build

```bash
cd mobile-ios
npm install -g eas-cli
eas login
cp eas.json.example eas.json
eas build:configure
eas build --platform ios --profile production
```

Артефакт: `.ipa` для TestFlight / App Store.

Профили:

- `development` — симулятор + dev client
- `preview` — внутреннее тестирование на устройстве
- `production` — релиз в Store

## 5. App Store Connect

1. Создайте приложение с тем же `bundleIdentifier`.
2. Заполните метаданные, возрастной рейтинг, политику конфиденциальности.
3. Загрузите сборку:

```bash
eas submit --platform ios --profile production
```

или через Transporter / Xcode Organizer.

## 4. TestFlight

После обработки сборки в Connect добавьте внутренних/внешних тестеров.

## 7. Чеклист перед релизом

- [ ] `EXPO_PUBLIC_API_BASE_URL` указывает на production
- [ ] Увеличены `version` и `buildNumber`
- [ ] Пройдены вход, анализы, документы, план, AI-чат на реальном iPhone
- [ ] Клавиатура не перекрывает поле ввода в чате
- [ ] Загрузка фото/документов с камеры и галереи
- [ ] Нет хардкода `localhost` в production-сборке

## 8. Обновления

Каждый релиз:

1. `version` + `buildNumber` в `app.json`
2. `eas build --platform ios --profile production`
3. `eas submit` или ручная загрузка в Connect
