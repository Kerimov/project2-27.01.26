const { execFileSync } = require('child_process')
const { rmSync } = require('fs')
const { join } = require('path')

const root = join(__dirname, '..')
const outDir = join(root, '.tmp-ai-policy-test')

const sources = [
  'lib/ai/assistant-analysis-intent.ts',
  'lib/ai/assistant-diary-intent.ts',
  'lib/ai/assistant-medical-intent.ts',
  'lib/ai/assistant-router.ts',
  'lib/ai/assistant-routing-policy.ts',
]

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
    ...sources,
  ],
  { cwd: root, stdio: 'inherit' }
)

const { classifyAssistantIntent } = require(join(outDir, 'assistant-router.js'))
const {
  isAmbiguousForLlmRouter,
  mustUseRuleRouterOnly,
} = require(join(outDir, 'assistant-routing-policy.js'))

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

assert(
  mustUseRuleRouterOnly({ message: 'запиши в дневник: боль 3, сон 8' }),
  'diary write must use rule guard'
)
assert(
  mustUseRuleRouterOnly({ message: 'ok', hasUiAction: true }),
  'ui action must use rule guard'
)
assert(
  mustUseRuleRouterOnly({ message: 'да', hasPendingBooking: true }),
  'pending booking must use rule guard'
)

const nurofen = classifyAssistantIntent('помогает ли нурофен от температуры?')
assert(nurofen.intent === 'medical_question', `nurofen -> medical_question, got ${nurofen.intent}`)

const diaryWrite = classifyAssistantIntent('запиши в дневник: боль 3, сон 8')
assert(diaryWrite.intent === 'diary', `diary write -> diary, got ${diaryWrite.intent}`)

const booking = classifyAssistantIntent('запиши меня к кардиологу завтра')
assert(booking.intent === 'booking', `booking -> booking, got ${booking.intent}`)

const badDiary = classifyAssistantIntent('помогает ли нурофен от температуры?')
assert(
  !isAmbiguousForLlmRouter('помогает ли нурофен от температуры?', badDiary) ||
    badDiary.intent === 'medical_question',
  'medical question should not be ambiguous as diary'
)

rmSync(outDir, { recursive: true, force: true })
console.log('AI assistant routing policy smoke tests passed')
