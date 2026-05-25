import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { parse as parseCookies } from 'cookie'
import {
  discoverMarketplaceCompanies,
  parseMarketplaceIntent,
  summarizeMarketplaceResults,
} from '@/lib/marketplace-discover'

export const dynamic = 'force-dynamic'

function getToken(request: NextRequest) {
  const auth = request.headers.get('authorization') || ''
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7)
  const cookieHeader = request.headers.get('cookie')
  const cookies = cookieHeader ? parseCookies(cookieHeader) : {}
  return cookies.token || null
}

export async function POST(request: NextRequest) {
  try {
    const token = getToken(request)
    if (token) {
      const payload = verifyToken(token)
      if (!payload?.userId) {
        return NextResponse.json({ error: 'Неверный токен' }, { status: 401 })
      }
    }

    const body = await request.json().catch(() => ({}))
    const message = typeof body?.message === 'string' ? body.message.trim() : ''
    if (!message) {
      return NextResponse.json({ error: 'Сообщение обязательно' }, { status: 400 })
    }

    const cityHint = typeof body?.city === 'string' ? body.city : null
    const includeWeb = body?.includeWeb !== false
    const intent = parseMarketplaceIntent(message, cityHint)

    const discovery = await discoverMarketplaceCompanies(intent, { includeWeb })
    const response = await summarizeMarketplaceResults(message, intent, discovery.companies)

    const sources = discovery.companies
      .filter((c) => c.sourceUrl || c.website)
      .slice(0, 8)
      .map((c) => ({
        title: c.name,
        url: c.sourceUrl || c.website,
        snippet: c.snippet || c.description,
        sourceType: c.source,
      }))

    return NextResponse.json({
      response,
      companies: discovery.companies,
      intent: discovery.intent,
      catalogCount: discovery.catalogCount,
      osmCount: discovery.osmCount,
      webCount: discovery.webCount,
      sources,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[marketplace][ai-search] error:', error)
    return NextResponse.json(
      { error: 'Ошибка поиска клиник через AI' },
      { status: 500 }
    )
  }
}
