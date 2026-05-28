const { execFileSync } = require('child_process')
const { rmSync } = require('fs')
const { join } = require('path')

const root = join(__dirname, '..')
const outDir = join(root, '.tmp-ai-openai-tools-test')

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
    'lib/ai/assistant-tools.ts',
    'lib/ai/assistant-openai-tools.ts',
  ],
  { cwd: root, stdio: 'inherit' }
)

const { buildAssistantOpenAiTools } = require(join(outDir, 'assistant-openai-tools.js'))
const tools = buildAssistantOpenAiTools()
if (!tools.length) throw new Error('expected tools')
if (!tools.find((t) => t.function.name === 'get_diary_entries')) {
  throw new Error('missing get_diary_entries tool')
}

rmSync(outDir, { recursive: true, force: true })
console.log(`OpenAI tools catalog OK (${tools.length} tools)`)
