# 🚀 Быстрый гайд по публикации в Google Play

## 📝 Краткая инструкция (5 шагов)

### 1️⃣ Подготовка (5 минут)

```bash
cd mobile
```

Обновите `app.json`:
- Укажите уникальный `package` (например: `com.yourcompany.medicalassistant`)
- Установите `version: "1.0.0"` и `versionCode: 1`

### 2️⃣ Установка EAS CLI (2 минуты)

```bash
npm install -g eas-cli
eas login
```

### 3️⃣ Создание конфигурации (1 минута)

Скопируйте `eas.json.example` в `eas.json` и настройте под себя.

### 4️⃣ Сборка приложения (10-30 минут)

```bash
eas build --platform android --profile production
```

Дождитесь завершения сборки (ссылка будет в консоли).

### 5️⃣ Публикация в Google Play (30 минут)

1. Зарегистрируйтесь на https://play.google.com/console ($25)
2. Создайте приложение
3. Загрузите `.aab` файл из шага 4
4. Заполните описание, загрузите скриншоты
5. Отправьте на проверку

---

## ⚡ Еще быстрее (EAS Submit)

Если настроен `eas.json` с `submit`:

```bash
eas submit --platform android --profile production
```

Это автоматически загрузит приложение в Google Play Console.

---

## 📋 Минимальные требования

- ✅ Иконка 512x512 px
- ✅ 2 скриншота приложения
- ✅ Описание (минимум 80 символов)
- ✅ Политика конфиденциальности (URL)

---

Подробная инструкция: см. `PUBLISH_GOOGLE_PLAY.md`
