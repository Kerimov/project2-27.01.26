import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { parse as parseCookies } from 'cookie'

export const runtime = 'nodejs'
// Использует headers/cookies, помечаем маршрут как динамический
export const dynamic = 'force-dynamic'

function getToken(request: NextRequest) {
  const auth = request.headers.get('authorization') || ''
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7)
  const cookieHeader = request.headers.get('cookie')
  const cookies = cookieHeader ? parseCookies(cookieHeader) : {}
  return cookies.token || null
}

// GET - получить документ по ID
export async function GET(
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

    const document = await prisma.document.findUnique({ where: { id: params.id } })
    
    if (!document) {
      return NextResponse.json({ error: 'Документ не найден' }, { status: 404 })
    }

    if (document.userId !== payload.userId) {
      // Разрешаем врачу доступ, если пациент прикреплен или есть прием
      const isDoctor = payload.role === 'DOCTOR'
      if (isDoctor) {
        const doctor = await prisma.doctorProfile.findUnique({ where: { userId: payload.userId } })
        if (doctor) {
          const [hasRecord, hasAppointment] = await Promise.all([
            prisma.patientRecord.findFirst({ where: { doctorId: doctor.id, patientId: document.userId }, select: { id: true } }),
            prisma.appointment.findFirst({ where: { doctorId: doctor.id, patientId: document.userId }, select: { id: true } })
          ])
          if (!hasRecord && !hasAppointment) {
            return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
          }
        } else {
          return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
        }
      } else {
        return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
      }
    }

    return NextResponse.json({ document })
  } catch (error) {
    console.error('Get document error:', error)
    return NextResponse.json(
      { error: 'Ошибка получения документа' },
      { status: 500 }
    )
  }
}

// DELETE - удалить документ
export async function DELETE(
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

    const document = await prisma.document.findUnique({ where: { id: params.id } })
    
    if (!document) {
      return NextResponse.json({ error: 'Документ не найден' }, { status: 404 })
    }

    if (document.userId !== payload.userId) {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
    }

    await prisma.document.delete({ where: { id: params.id } })
    return NextResponse.json({ message: 'Документ удален' })
  } catch (error) {
    console.error('Delete document error:', error)
    return NextResponse.json(
      { error: 'Ошибка удаления документа' },
      { status: 500 }
    )
  }
}

// PATCH - обновить документ
export async function PATCH(
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

    const document = await prisma.document.findUnique({ where: { id: params.id } })
    
    if (!document) {
      return NextResponse.json({ error: 'Документ не найден' }, { status: 404 })
    }

    if (document.userId !== payload.userId) {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
    }

    const updates = await request.json()
    const updated = await prisma.document.update({ where: { id: params.id }, data: updates })
    return NextResponse.json({ document: updated })
  } catch (error) {
    console.error('Update document error:', error)
    return NextResponse.json(
      { error: 'Ошибка обновления документа' },
      { status: 500 }
    )
  }
}

