#!/usr/bin/env node

/**
 * Интерактивный помощник для развертывания на Vercel
 * Использование: node scripts/deploy-helper.js
 */

const readline = require('readline');
const { execSync } = require('child_process');
const crypto = require('crypto');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

function generateJWTSecret() {
  return crypto.randomBytes(32).toString('hex');
}

function runCommand(command, description) {
  console.log(`\n🔧 ${description}...`);
  try {
    execSync(command, { stdio: 'inherit' });
    console.log(`✅ ${description} завершено успешно!`);
  } catch (error) {
    console.error(`❌ Ошибка при ${description.toLowerCase()}:`, error.message);
    return false;
  }
  return true;
}

async function main() {
  console.log('🚀 Помощник развертывания на Vercel');
  console.log('=====================================\n');

  // Шаг 1: Генерация JWT секрета
  console.log('📋 Шаг 1: Генерация JWT секрета');
  const jwtSecret = generateJWTSecret();
  console.log(`Сгенерированный JWT_SECRET: ${jwtSecret}`);
  console.log('⚠️  Сохраните этот ключ! Он понадобится для настройки Vercel\n');

  // Шаг 2: Подготовка репозитория
  console.log('📋 Шаг 2: Подготовка репозитория');
  const proceed = await question('Выполнить git add, commit и push? (y/n): ');
  
  if (proceed.toLowerCase() === 'y') {
    if (!runCommand('git add .', 'Добавление файлов в git')) return;
    if (!runCommand('git commit -m "Ready for Vercel deployment"', 'Создание коммита')) return;
    if (!runCommand('git push origin main', 'Отправка в GitHub')) return;
  }

  // Шаг 3: Инструкции для Vercel
  console.log('\n📋 Шаг 3: Создание проекта на Vercel');
  console.log('1. Откройте: https://vercel.com/new');
  console.log('2. Импортируйте репозиторий: https://github.com/Kerimov/medical.git');
  console.log('3. Нажмите "Import" и следуйте инструкциям\n');

  // Шаг 4: Создание базы данных
  console.log('📋 Шаг 4: Создание PostgreSQL базы данных');
  console.log('1. В панели Vercel перейдите в "Storage"');
  console.log('2. Нажмите "Create Database" → "Postgres"');
  console.log('3. Выберите план "Hobby" (бесплатный)');
  console.log('4. Скопируйте DATABASE_URL из настроек базы данных\n');

  // Шаг 5: Переменные окружения
  console.log('📋 Шаг 5: Настройка переменных окружения');
  console.log('В Vercel → Settings → Environment Variables добавьте:');
  console.log('');
  console.log('JWT_SECRET =', jwtSecret);
  console.log('DATABASE_URL = [из шага 4]');
  console.log('NEXT_PUBLIC_ADMIN_EMAILS = admin@example.com');
  console.log('OLLAMA_BASE_URL = http://127.0.0.1:11434');
  console.log('OLLAMA_MODEL = llama3.2');
  console.log('OCR_SPACE_API_KEY = [ваш OCR ключ] (опционально)');
  console.log('NEXTAUTH_URL = https://medical-xxx.vercel.app');
  console.log('');

  // Шаг 6: Миграция базы данных
  console.log('📋 Шаг 6: Миграция базы данных');
  const migrate = await question('Выполнить миграцию базы данных? (y/n): ');
  
  if (migrate.toLowerCase() === 'y') {
    console.log('\n🔧 Установка Vercel CLI...');
    try {
      execSync('npm install -g vercel', { stdio: 'inherit' });
    } catch (error) {
      console.log('⚠️  Vercel CLI уже установлен или произошла ошибка');
    }

    console.log('\n🔧 Вход в Vercel...');
    console.log('Следуйте инструкциям в браузере для входа в аккаунт');
    try {
      execSync('vercel login', { stdio: 'inherit' });
    } catch (error) {
      console.log('⚠️  Ошибка входа в Vercel. Выполните: vercel login');
    }

    console.log('\n🔧 Выполнение миграции...');
    try {
      execSync('npx prisma migrate deploy', { stdio: 'inherit' });
      console.log('✅ Миграция выполнена успешно!');
    } catch (error) {
      console.log('❌ Ошибка миграции. Проверьте DATABASE_URL');
    }
  }

  // Финальные инструкции
  console.log('\n🎉 Развертывание завершено!');
  console.log('=====================================');
  console.log('1. Перейдите в панель Vercel');
  console.log('2. Найдите ваш проект и откройте его');
  console.log('3. Скопируйте URL приложения');
  console.log('4. Откройте приложение в браузере');
  console.log('5. Проверьте регистрацию и основные функции');
  console.log('');
  console.log('📚 Дополнительная документация:');
  console.log('- DEPLOY_SCRIPT.md - подробные инструкции');
  console.log('- VERCEL_DEPLOYMENT_GUIDE.md - полное руководство');
  console.log('- QUICK_DEPLOY_VERCEL.md - быстрый старт');

  rl.close();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { generateJWTSecret };
