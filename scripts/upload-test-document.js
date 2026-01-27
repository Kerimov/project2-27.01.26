/**
 * Скрипт для загрузки тестового документа через API
 * 
 * Использование:
 *   node scripts/upload-test-document.js <путь_к_файлу> [email] [password]
 * 
 * Пример:
 *   node scripts/upload-test-document.js C:\Users\Vadim\Documents\test-analysis.pdf
 * 
 * Требования: Node.js 18+ (встроенный fetch)
 */

const fs = require('fs');
const path = require('path');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

async function login(email, password) {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Ошибка входа: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.token;
}

async function uploadDocument(filePath, token) {
  const fileName = path.basename(filePath);
  const fileStats = fs.statSync(filePath);
  const fileSize = fileStats.size;
  const fileBuffer = fs.readFileSync(filePath);

  console.log(`📤 Загрузка файла: ${fileName} (${(fileSize / 1024 / 1024).toFixed(2)} МБ)`);

  // Создаем FormData вручную
  const boundary = `----formdata-${Date.now()}`;
  const formDataParts = [];
  
  formDataParts.push(`--${boundary}`);
  formDataParts.push(`Content-Disposition: form-data; name="file"; filename="${fileName}"`);
  formDataParts.push(`Content-Type: application/octet-stream`);
  formDataParts.push('');
  formDataParts.push(fileBuffer);
  formDataParts.push(`--${boundary}--`);

  const body = Buffer.concat(
    formDataParts.map(part => 
      Buffer.isBuffer(part) ? part : Buffer.from(part + '\r\n', 'utf-8')
    )
  );

  const response = await fetch(`${API_BASE_URL}/api/documents/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': body.length.toString()
    },
    body: body
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(`Ошибка загрузки: ${error.error || response.statusText}`);
  }

  const data = await response.json();
  return data.document;
}

async function main() {
  const filePath = process.argv[2];
  const email = process.argv[3] || 'seed@example.com';
  const password = process.argv[4] || 'seed1234';

  if (!filePath) {
    console.error('❌ Ошибка: Укажите путь к файлу');
    console.log('\n📝 Использование:');
    console.log('   node scripts/upload-test-document.js <путь_к_файлу> [email] [password]');
    console.log('\n📋 Пример:');
    console.log('   node scripts/upload-test-document.js C:\\Users\\Vadim\\Documents\\test.pdf');
    console.log('\n💡 Или используйте веб-интерфейс:');
    console.log('   http://localhost:3000/documents');
    process.exit(1);
  }

  if (!fs.existsSync(filePath)) {
    console.error(`❌ Ошибка: Файл не найден: ${filePath}`);
    process.exit(1);
  }

  // Проверка размера файла (10 МБ)
  const fileStats = fs.statSync(filePath);
  if (fileStats.size > 10 * 1024 * 1024) {
    console.error(`❌ Ошибка: Файл слишком большой (${(fileStats.size / 1024 / 1024).toFixed(2)} МБ). Максимум: 10 МБ`);
    process.exit(1);
  }

  try {
    console.log('🔐 Вход в систему...');
    const token = await login(email, password);
    console.log('✅ Вход выполнен успешно\n');

    console.log('📤 Загрузка документа...');
    const document = await uploadDocument(filePath, token);
    
    console.log('\n✅ Документ успешно загружен!');
    console.log(`   ID: ${document.id}`);
    console.log(`   Имя файла: ${document.fileName}`);
    console.log(`   Тип: ${document.fileType}`);
    console.log(`   Размер: ${(document.fileSize / 1024 / 1024).toFixed(2)} МБ`);
    console.log(`   Статус обработки: ${document.parsed ? '✅ Обработан' : '⏳ В обработке'}`);
    console.log(`\n🌐 Просмотр: http://localhost:3000/documents/${document.id}`);
    console.log('\n💡 Документ будет автоматически обработан (OCR + AI парсинг)');
    
  } catch (error) {
    console.error('\n❌ Ошибка:', error.message);
    process.exit(1);
  }
}

main();
