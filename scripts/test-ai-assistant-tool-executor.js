const { execFileSync } = require('child_process')
const { rmSync } = require('fs')
const { join } = require('path')

const root = join(__dirname, '..')
const outDir = join(root, '.tmp-ai-executor-test')

const sources = [
  'lib/ai/assistant-tools.ts',
  'lib/ai/assistant-diary-intent.ts',
  'lib/ai/assistant-router.ts',
  'lib/ai/assistant-tool-routing.ts',
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

const {
  getIntentForTool,
  shouldRunSuggestedTool,
  canAutoRunSuggestedTool,
} = require(join(outDir, 'assistant-tool-routing.js'))

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

assert(getIntentForTool('get_diary_entries', 'unknown') === 'diary', 'get_diary_entries intent')
assert(getIntentForTool('get_doctors', 'unknown') === 'doctors', 'get_doctors intent')
assert(
  shouldRunSuggestedTool({ suggestedTool: 'get_reminders', routerSource: 'llm', bypassShortcut: false }),
  'llm suggested tool'
)
assert(
  !shouldRunSuggestedTool({ suggestedTool: 'get_reminders', routerSource: 'rule', bypassShortcut: false }),
  'rule source skips suggested tool path'
)
assert(
  !shouldRunSuggestedTool({ suggestedTool: 'get_reminders', routerSource: 'llm', bypassShortcut: true }),
  'bypass skips suggested tool'
)
assert(
  canAutoRunSuggestedTool('get_appointments', 'покажи записи', false),
  'read tool auto'
)
assert(
  !canAutoRunSuggestedTool('book_appointment', 'хочу к врачу', false),
  'book needs explicit write'
)
assert(
  canAutoRunSuggestedTool('add_diary_entry', 'запиши в дневник: боль 3', false),
  'diary write auto'
)

rmSync(outDir, { recursive: true, force: true })
console.log('AI assistant tool executor smoke tests passed')
