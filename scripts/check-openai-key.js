/**
 * Скрипт для проверки настройки OpenAI API ключа
 */

require('dotenv').config({ path: '.env.local' });

const apiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY;
const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

console.log('🔍 Проверка настройки OpenAI API...\n');

if (!apiKey) {
  console.error('❌ ОШИБКА: OPENAI_API_KEY не найден в .env.local');
  console.log('\n📝 Добавьте в .env.local:');
  console.log('   OPENAI_API_KEY=sk-...');
  process.exit(1);
}

if (apiKey === 'your-openai-api-key' || apiKey.startsWith('your-')) {
  console.error('❌ ОШИБКА: OPENAI_API_KEY содержит значение-заглушку');
  console.log('\n📝 Замените значение на реальный ключ в .env.local');
  process.exit(1);
}

if (!apiKey.startsWith('sk-')) {
  console.warn('⚠️  ПРЕДУПРЕЖДЕНИЕ: Ключ не начинается с "sk-"');
  console.log('   Убедитесь, что это правильный OpenAI API ключ\n');
}

console.log('✅ OPENAI_API_KEY найден');
console.log(`   Длина ключа: ${apiKey.length} символов`);
console.log(`   Модель: ${model}`);
console.log('\n🎉 OpenAI API настроен правильно!');
console.log('\n💡 Не забудьте перезапустить сервер Next.js:');
console.log('   npm run dev');
