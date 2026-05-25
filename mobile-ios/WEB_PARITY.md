# Паритет мобильного приложения с веб

## Пациент — реализовано

| Раздел веб | Мобильное |
|------------|-----------|
| Вход / регистрация | `/`, `/register` |
| Главная + AI-чат | `/(tabs)/` + FAB |
| Анализы список/детали/создание + AI | `analyses`, `analysis/[id]`, `analyses/create` |
| Документы загрузка (фото/PDF)/детали/OCR review/удаление/AI | `documents`, `document/[id]` |
| План задач CRUD + согласования врача | `care-plan`, `care-plan/create` |
| Записи + перенос + pre-visit | `appointments`, `appointment/[id]`, `appointment/create`, `pre-visit/[id]` |
| Лекарства CRUD + AI-план | `medications`, `medication/*` |
| Дневник CRUD + AI обзор/связь | `diary`, `diary/*` |
| Напоминания | `reminders`, `reminder/create` |
| Профиль + сервисы | `profile` → analytics, knowledge, marketplace, help |
| Куратор | `caretaker`, `PatientSwitcher` |
| Аналитика | `analytics` + блок на главной |
| База знаний | `knowledge` |
| Маркетплейс | `marketplace`, `marketplace/[id]` |
| Справка | `help` |

## Врач — базовый кабинет

| Раздел веб | Мобильное |
|------------|-----------|
| Дашборд, записи, пациенты | `/doctor`, `/doctor/appointments`, `/doctor/patients` |

Полный функционал врача (протоколы, рецепты, печать) — веб-only.

## Намеренно веб-only

- Админ-панель (`/admin/*`) — при входе admin показывается подсказка открыть веб
- Расширенные doctor-фичи (протоколы, назначения, печать)

## Отличия платформы

- AI-чат на документе: FAB-чат с предвыбранным документом (не отдельная страница)
- 9 вкладок — плотный tab-bar на маленьких экранах
- Для iOS Expo Go: API через HTTPS-туннель (`EXPO_PUBLIC_API_BASE_URL`)
