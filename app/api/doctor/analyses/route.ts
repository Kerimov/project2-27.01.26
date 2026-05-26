import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'

// Использует cookies, помечаем маршрут как динамический
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Проверяем токен
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Токен не найден' }, { status: 401 })
    }

    const decoded = verifyToken(token)
    if (!decoded) {
      return NextResponse.json({ error: 'Неверный токен' }, { status: 401 })
    }

    // Проверяем, что пользователь является врачом
    const doctorProfile = await prisma.doctorProfile.findUnique({
      where: { userId: decoded.userId }
    })

    if (!doctorProfile) {
      return NextResponse.json({ error: 'Профиль врача не найден' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const filterPatientId = searchParams.get('patientId')

    // Получаем всех пациентов врача
    const patientRecords = await prisma.patientRecord.findMany({
      where: { doctorId: doctorProfile.id },
      select: { patientId: true }
    })

    let patientIds = patientRecords.map(record => record.patientId)
    if (filterPatientId) {
      patientIds = patientIds.filter(id => id === filterPatientId)
    }

    if (patientIds.length === 0) {
      return NextResponse.json([])
    }

    // Получаем анализы пациентов (возможен фильтр по одному пациенту)
    const analyses = await prisma.analysis.findMany({
      where: {
        userId: {
          in: patientIds
        }
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        document: {
          select: {
            fileName: true,
            studyDate: true,
            laboratory: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(analyses)

  } catch (error) {
    console.error('Error fetching doctor analyses:', error)
    return NextResponse.json(
      { error: 'Ошибка при получении анализов' },
      { status: 500 }
    )
  }
}

// POST: врач создает анализ для конкретного пациента
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Токен не найден' }, { status: 401 })
    }

    const decoded = verifyToken(token)
    if (!decoded) {
      return NextResponse.json({ error: 'Неверный токен' }, { status: 401 })
    }

    // Проверяем, что пользователь является врачом
    const doctorProfile = await prisma.doctorProfile.findUnique({
      where: { userId: decoded.userId }
    })
    if (!doctorProfile) {
      return NextResponse.json({ error: 'Профиль врача не найден' }, { status: 403 })
    }

    const body = await request.json()
    const {
      patientId,
      title,
      type,
      date,
      laboratory,
      doctor,
      results, // ожидаем JSON или объект
      normalRange,
      status = 'normal',
      notes
    } = body

    if (!patientId || !title || !type || !date || !results) {
      return NextResponse.json({ error: 'patientId, title, type, date, results обязательны' }, { status: 400 })
    }

    // Разрешаем только если пациент прикреплен к врачу или есть запись на прием
    const [hasRecord, hasAppointment] = await Promise.all([
      prisma.patientRecord.findFirst({ where: { doctorId: doctorProfile.id, patientId }, select: { id: true } }),
      prisma.appointment.findFirst({ where: { doctorId: doctorProfile.id, patientId }, select: { id: true } })
    ])
    if (!hasRecord && !hasAppointment) {
      return NextResponse.json({ error: 'Пациент не прикреплен к врачу' }, { status: 403 })
    }

    const analysis = await prisma.analysis.create({
      data: {
        userId: patientId,
        title,
        type,
        date: new Date(date),
        laboratory,
        doctor: doctor || doctorProfile.userId,
        results: typeof results === 'string' ? results : JSON.stringify(results),
        normalRange,
        status,
        notes
      }
    })

    // Рекомендации будут генерироваться в новом разделе рекомендаций

    return NextResponse.json({ analysis: { ...analysis, results: JSON.parse(analysis.results) } }, { status: 201 })
  } catch (error) {
    console.error('Doctor create analysis error:', error)
    return NextResponse.json({ error: 'Ошибка создания анализа' }, { status: 500 })
  }
}
