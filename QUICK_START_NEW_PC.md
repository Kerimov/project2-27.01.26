# ⚡ Быстрый старт на новом ПК (5 минут)

## 🎯 Минимальная установка

### 1. Клонирование и установка

```bash
git clone https://github.com/Kerimov/project2-27.01.26.git
cd project2-27.01.26
npm install
cd mobile && npm install && cd ..
```

### 2. Настройка окружения

```bash
# Создать .env.local
cp env.example .env.local

# Минимальные настройки в .env.local:
# JWT_SECRET=любая-случайная-строка
# DATABASE_URL="file:./prisma/dev.db"
```

### 3. Инициализация базы данных

```bash
npx prisma generate
npx prisma db push
node prisma/seed.js
```

### 4. Запуск

```bash
# Веб-приложение
npm run dev

# Мобильное приложение (в другом терминале)
cd mobile
npm start
```

### 5. Вход

- **URL**: http://localhost:3000
- **Email**: `seed@example.com`
- **Пароль**: `seed1234`

---

## 📱 Для мобильного приложения

### Настройка API URL

Откройте `mobile/.env`:

```env
# Для Android эмулятора
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:3000

# Для физического устройства (замените на IP вашего ПК)
# EXPO_PUBLIC_API_BASE_URL=http://192.168.1.100:3000
```

---

## 🔑 API ключи (опционально)

Добавьте в `.env.local` для полной функциональности:

```env
OPENAI_API_KEY=sk-proj-ваш-ключ
OCR_SPACE_API_KEY=ваш-ключ
```

Без ключей приложение работает в демо-режиме.

---

## ✅ Проверка

1. Откройте http://localhost:3000
2. Войдите: `seed@example.com` / `seed1234`
3. Проверьте загрузку документов и AI чат

---

**Подробная инструкция:** см. `README_NEW_PC.md`
