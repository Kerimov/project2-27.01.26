import { NextRequest, NextResponse } from 'next/server'
import { parse as parseCookies } from 'cookie'

import { prisma } from '@/lib/db'
import { processDocumentOCR } from '@/lib/document-ocr'
import { verifyToken } from '@/lib/auth'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

function getToken(request: NextRequest) {
  const auth = request.headers.get('authorization') || ''
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7)
  const cookieHeader = request.headers.get('cookie')
  const cookies = cookieHeader ? parseCookies(cookieHeader) : {}
  return cookies.token || null
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = getToken(request)
    if (!token) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Неверный токен' }, { status: 401 })
    }

    const document = await prisma.document.findUnique({
      where: { id: params.id },
      select: { id: true, userId: true, parsed: true },
    })

    if (!document) {
      return NextResponse.json({ error: 'Документ не найден' }, { status: 404 })
    }

    if (document.userId !== payload.userId && payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
    }

    await processDocumentOCR(document.id)

    const updated = await prisma.document.findUnique({
      where: { id: document.id },
      select: {
        id: true,
        parsed: true,
        studyType: true,
        ocrConfidence: true,
      },
    })

    return NextResponse.json({ document: updated })
  } catch (error) {
    console.error('[OCR] Manual document processing failed:', error)
    return NextResponse.json(
      { error: 'Ошибка обработки документа' },
      { status: 500 }
    )
  }
}
