/**
 * Проверка доступности Ollama
 */
const base =
  process.env.OLLAMA_BASE_URL ||
  process.env.LOCAL_LLM_ENDPOINT ||
  'http://127.0.0.1:11434'
const model = process.env.OLLAMA_MODEL || 'llama3.2'

console.log('🔍 Проверка Ollama...\n')
console.log(`   URL:   ${base}`)
console.log(`   Модель: ${model}\n`)

if (process.env.OLLAMA_DISABLED === 'true') {
  console.error('❌ OLLAMA_DISABLED=true — AI отключён в конфиге')
  process.exit(1)
}

fetch(`${base.replace(/\/$/, '')}/api/tags`)
  .then(async (r) => {
    if (!r.ok) {
      console.error(`❌ Ollama ответила ${r.status}`)
      process.exit(1)
    }
    const data = await r.json()
    const names = (data.models || []).map((m) => m.name)
    console.log('✅ Ollama доступна')
    console.log(`   Установленные модели: ${names.length ? names.join(', ') : '(нет — выполните: ollama pull ' + model + ')'}`)
    if (!names.some((n) => n.startsWith(model))) {
      console.warn(`\n⚠️  Модель "${model}" не найдена. Запустите: ollama pull ${model}`)
    }
    console.log('\n🎉 Готово к работе с AI через Ollama')
  })
  .catch((e) => {
    console.error('❌ Не удалось подключиться к Ollama')
    console.error('   Запустите: ollama serve')
    console.error('   Или установите: https://ollama.com')
    console.error(`   (${e.message})`)
    process.exit(1)
  })
