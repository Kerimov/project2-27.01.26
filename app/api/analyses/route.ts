import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { parse as parseCookies } from 'cookie'

// Использует cookies/headers, помечаем маршрут как динамический
export const dynamic = 'force-dynamic'

function getToken(request: NextRequest) {
  const auth = request.headers.get('authorization') || ''
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7)
  const cookieHeader = request.headers.get('cookie')
  const cookies = cookieHeader ? parseCookies(cookieHeader) : {}
  return cookies.token || null
}

export async function GET(request: NextRequest) {
  try {
    const token = getToken(request)
    if (!token) {
      return NextResponse.json({ error: 'Токен не найден' }, { status: 401 })
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Недействительный токен' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const documentId = searchParams.get('documentId')

    const where: any = { userId: payload.userId }
    if (documentId) {
      where.documentId = documentId
    }

    const analyses = await prisma.analysis.findMany({
      where,
      orderBy: { date: 'desc' },
      select: {
        id: true,
        userId: true,
        documentId: true,
        title: true,
        type: true,
        date: true,
        laboratory: true,
        doctor: true,
        results: true,
        normalRange: true,
        status: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
      }
    })

    return NextResponse.json({ analyses })
  } catch (error) {
    console.error('Error fetching analyses:', error)
    return NextResponse.json(
      { error: 'Ошибка при получении анализов' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = getToken(request)
    if (!token) {
      return NextResponse.json({ error: 'Токен не найден' }, { status: 401 })
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Недействительный токен' }, { status: 401 })
    }

    const { title, type, date, laboratory, doctor, results, normalRange, status, notes } = await request.json()

    // Валидация
    if (!title || !type || !date || !results) {
      return NextResponse.json(
        { error: 'Заполните все обязательные поля' },
        { status: 400 }
      )
    }

    const analysis = await prisma.analysis.create({
      data: {
        userId: payload.userId,
        title,
        type,
        date: new Date(date),
        laboratory,
        doctor,
        results: JSON.stringify(results),
        normalRange,
        status: status || 'normal',
        notes
      }
    })

    // Рекомендации будут генерироваться в новом разделе рекомендаций

    return NextResponse.json({
      message: 'Анализ успешно сохранен',
      analysis: {
        ...analysis,
        results: JSON.parse(analysis.results)
      }
    })
  } catch (error) {
    console.error('Error creating analysis:', error)
    return NextResponse.json(
      { error: 'Ошибка при сохранении анализа' },
      { status: 500 }
    )
  }
}
