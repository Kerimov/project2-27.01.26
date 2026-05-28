const { execFileSync } = require('child_process')
const { rmSync } = require('fs')
const { join } = require('path')

const root = join(__dirname, '..')
const outDir = join(root, '.tmp-ai-router-test')

rmSync(outDir, { recursive: true, force: true })
execFileSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  [
    'tsc',
    '--target',
    'es2020',
    '--module',
    'commonjs',
    '--moduleResolution',
    'node',
    '--skipLibCheck',
    '--esModuleInterop',
    '--outDir',
    outDir,
    'lib/ai/assistant-analysis-intent.ts',
    'lib/ai/assistant-diary-intent.ts',
    'lib/ai/assistant-router.ts',
  ],
  { cwd: root, stdio: 'inherit' }
)

const { classifyAssistantIntent } = require(join(outDir, 'assistant-router.js'))

const cases = [
  ['Покажи мои записи на приемы', 'appointments'],
  ['Покажи свободные слоты для записи к врачу', 'booking'],
  ['запиши меня к кардиологу завтра', 'booking'],
  ['запиши в дневник: боль 3, сон 8', 'diary'],
  ['Сделай запись в дневник', 'diary'],
  ['добавь в дневник настроение 7', 'diary'],
  ['покажи список врачей', 'doctors'],
  ['мои лекарства', 'medications'],
  ['задачи плана', 'care_plan'],
  ['покажи мои напоминания', 'reminders'],
  ['покажи мои документы', 'documents'],
  ['покажи мои анализы', 'analyses'],
  ['что значит гемоглобин', 'medical_question'],
]

for (const [message, expected] of cases) {
  const actual = classifyAssistantIntent(message).intent
  if (actual !== expected) {
    throw new Error(`Expected "${message}" -> ${expected}, got ${actual}`)
  }
}

rmSync(outDir, { recursive: true, force: true })
console.log(`AI assistant router smoke tests passed (${cases.length})`)
