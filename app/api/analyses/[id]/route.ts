import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'

export const runtime = 'nodejs'
// Использует headers, помечаем маршрут как динамический
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Токен не найден' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Недействительный токен' }, { status: 401 })
    }

    const analysis = await prisma.analysis.findFirst({
      where: {
        id: params.id,
        userId: payload.userId
      }
    })

    if (!analysis) {
      return NextResponse.json({ error: 'Анализ не найден' }, { status: 404 })
    }

    return NextResponse.json({
      analysis: {
        ...analysis,
        results: JSON.parse(analysis.results)
      }
    })
  } catch (error) {
    console.error('Error fetching analysis:', error)
    return NextResponse.json(
      { error: 'Ошибка при получении анализа' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Токен не найден' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Недействительный токен' }, { status: 401 })
    }

    const { title, type, date, laboratory, doctor, results, normalRange, status, notes } = await request.json()

    // Проверяем, что анализ принадлежит пользователю
    const existingAnalysis = await prisma.analysis.findFirst({
      where: {
        id: params.id,
        userId: payload.userId
      }
    })

    if (!existingAnalysis) {
      return NextResponse.json({ error: 'Анализ не найден' }, { status: 404 })
    }

    const analysis = await prisma.analysis.update({
      where: { id: params.id },
      data: {
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

    return NextResponse.json({
      message: 'Анализ успешно обновлен',
      analysis: {
        ...analysis,
        results: JSON.parse(analysis.results)
      }
    })
  } catch (error) {
    console.error('Error updating analysis:', error)
    return NextResponse.json(
      { error: 'Ошибка при обновлении анализа' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Токен не найден' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Недействительный токен' }, { status: 401 })
    }

    // Проверяем, что анализ принадлежит пользователю
    const existingAnalysis = await prisma.analysis.findFirst({
      where: {
        id: params.id,
        userId: payload.userId
      }
    })

    if (!existingAnalysis) {
      return NextResponse.json({ error: 'Анализ не найден' }, { status: 404 })
    }

    await prisma.analysis.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ message: 'Анализ успешно удален' })
  } catch (error) {
    console.error('Error deleting analysis:', error)
    return NextResponse.json(
      { error: 'Ошибка при удалении анализа' },
      { status: 500 }
    )
  }
}
