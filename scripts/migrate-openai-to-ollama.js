#!/usr/bin/env node
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const files = [
  'app/api/ai/analysis-trend/route.ts',
  'app/api/ai/assistant/route.ts',
  'app/api/ai/care-plan/route.ts',
  'app/api/ai/diary-weekly-review/route.ts',
  'app/api/ai/diary-indicator-link/route.ts',
  'app/api/ai/medications/plan/route.ts',
  'app/api/ai/risk-triage/route.ts',
  'app/api/reports/doctor-summary/route.ts',
  'app/api/doctor/prescriptions/interactions/route.ts',
  'app/api/doctor/ai/second-opinion/route.ts',
  'app/api/doctor/analyses/insights/route.ts',
  'app/api/doctor/analyses/compare/route.ts',
  'app/api/documents/upload/route.ts',
  'app/api/marketplace/companies/route.ts',
]

const helperBlockRe =
  /function getOpenAIApiKey\(\) \{[\s\S]*?\n\}\n\n(?:function getOpenAIModel\(\) \{[\s\S]*?\n\}\n\n)?async function callOpenAI(?:Chat|Json)\([\s\S]*?\n\}\n\n/g

const ollamaImport = "import { callOllamaChat, callOllamaJson, isOllamaConfigured } from '@/lib/ollama'\n"

for (const rel of files) {
  const fp = path.join(ROOT, rel)
  if (!fs.existsSync(fp)) {
    console.warn('skip', rel)
    continue
  }
  let s = fs.readFileSync(fp, 'utf8')
  if (s.includes('@/lib/ollama')) {
    console.log('already', rel)
    continue
  }

  s = s.replace(helperBlockRe, '')
  if (!s.includes("from '@/lib/ollama'")) {
    s = s.replace(
      /(import[\s\S]*?from ['"]@\/lib\/auth['"]\n)/,
      `$1${ollamaImport}`
    )
    if (!s.includes("from '@/lib/ollama'")) {
      s = s.replace(
        /(import[\s\S]*?from ['"]cookie['"]\n)/,
        `$1${ollamaImport}`
      )
    }
  }

  s = s
    .replace(/getOpenAIApiKey\(\)/g, 'isOllamaConfigured()')
    .replace(/callOpenAIChat/g, 'callOllamaChat')
    .replace(/callOpenAIJson/g, 'callOllamaJson')
    .replace(/OPENAI_API_KEY/g, 'Ollama')
    .replace(/https:\/\/api\.openai\.com\/v1\/chat\/completions/g, '')
    .replace(/OpenAI/g, 'Ollama')
    .replace(/provider === 'openai'/g, "provider === 'ollama'")
    .replace(/aiConfig\?\.provider === 'openai'/g, "aiConfig?.provider === 'ollama'")

  fs.writeFileSync(fp, s)
  console.log('patched', rel)
}
