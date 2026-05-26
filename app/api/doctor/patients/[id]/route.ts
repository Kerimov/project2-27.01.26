import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { parse as parseCookies } from 'cookie'

// Использует cookies, помечаем маршрут как динамический
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) return authHeader.substring(7)
  const cookieHeader = request.headers.get('cookie')
  const cookies = cookieHeader ? parseCookies(cookieHeader) : {}
  return cookies.token || request.cookies.get('token')?.value || null
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = getToken(request)
    if (!token) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

    const decoded = verifyToken(token)
    if (!decoded) return NextResponse.json({ error: 'Неверный токен' }, { status: 401 })

    const patientId = params.id

    // Проверяем, что запрос делает врач и что пациент прикреплен к нему
    const doctorProfile = await prisma.doctorProfile.findUnique({
      where: { userId: decoded.userId },
      include: {
        patientRecords: {
          where: { patientId },
          take: 1
        }
      }
    })

    if (!doctorProfile) {
      return NextResponse.json({ error: 'Профиль врача не найден' }, { status: 404 })
    }

    let patientRecord = doctorProfile.patientRecords[0] || null
    if (!patientRecord) {
      // Разрешаем доступ, если есть хотя бы одна запись на прием у этого врача с данным пациентом
      const hasAppointment = await prisma.appointment.findFirst({
        where: { doctorId: doctorProfile.id, patientId },
        select: { id: true }
      })
      if (!hasAppointment) {
        return NextResponse.json({ error: 'Пациент не прикреплен к врачу' }, { status: 403 })
      }
    }

    const [patient, analyses, recommendations, appointments, prescriptions, notes, documents, carePlanTasks] = await Promise.all([
      prisma.user.findUnique({
        where: { id: patientId },
        select: { id: true, name: true, email: true, createdAt: true }
      }),
      prisma.analysis.findMany({
        where: { userId: patientId },
        orderBy: { date: 'desc' },
        include: {
          document: { select: { laboratory: true, studyDate: true } }
        }
      }),
      prisma.recommendation.findMany({
        where: { userId: patientId },
        orderBy: [ { priority: 'desc' }, { createdAt: 'desc' } ],
        include: { company: true, product: true }
      }),
      prisma.appointment.findMany({
        where: { doctorId: doctorProfile.id, patientId },
        orderBy: { scheduledAt: 'desc' }
      }),
      prisma.prescription.findMany({
        where: patientRecord ? { patientRecordId: patientRecord.id } : { patientRecordId: '' },
        orderBy: { prescribedAt: 'desc' }
      }),
      prisma.medicalNote.findMany({
        where: patientRecord ? { patientRecordId: patientRecord.id } : { patientRecordId: '' },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.document.findMany({
        where: { userId: patientId },
        select: { id: true, fileName: true, uploadDate: true, category: true, studyDate: true, studyType: true, laboratory: true, doctor: true },
        orderBy: { uploadDate: 'desc' },
        take: 30
      }),
      prisma.carePlanTask.findMany({
        where: { userId: patientId },
        select: { id: true, title: true, status: true, dueAt: true, snoozedUntil: true, createdAt: true, updatedAt: true, analysisId: true, documentId: true },
        orderBy: { createdAt: 'desc' },
        take: 50
      })
    ])

    return NextResponse.json({
      patient,
      patientRecord,
      analyses,
      recommendations,
      appointments,
      prescriptions,
      notes,
      documents,
      carePlanTasks
    })
  } catch (error) {
    console.error('Error fetching patient card data:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = getToken(request)
    if (!token) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

    const decoded = verifyToken(token)
    if (!decoded?.userId) return NextResponse.json({ error: 'Неверный токен' }, { status: 401 })

    const patientId = params.id

    const doctorProfile = await prisma.doctorProfile.findUnique({
      where: { userId: decoded.userId },
      include: {
        patientRecords: {
          where: { patientId },
          take: 1
        }
      }
    })
    if (!doctorProfile) return NextResponse.json({ error: 'Профиль врача не найден' }, { status: 404 })

    // allow if attached via appointment
    let patientRecord = doctorProfile.patientRecords[0] || null
    if (!patientRecord) {
      const hasAppointment = await prisma.appointment.findFirst({
        where: { doctorId: doctorProfile.id, patientId },
        select: { id: true }
      })
      if (!hasAppointment) return NextResponse.json({ error: 'Пациент не прикреплен к врачу' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const recordType = typeof body?.recordType === 'string' ? body.recordType : undefined
    const diagnosis = body?.diagnosis === null ? null : (typeof body?.diagnosis === 'string' ? body.diagnosis.trim() : undefined)
    const symptoms = body?.symptoms === null ? null : (typeof body?.symptoms === 'string' ? body.symptoms.trim() : undefined)
    const treatment = body?.treatment === null ? null : (typeof body?.treatment === 'string' ? body.treatment.trim() : undefined)
    const medications = Array.isArray(body?.medications) ? body.medications : (typeof body?.medications === 'string' ? body.medications.split('\n').map((s: string) => s.trim()).filter(Boolean) : undefined)
    const nextVisit = body?.nextVisit === null ? null : (body?.nextVisit ? new Date(body.nextVisit) : undefined)
    const status = typeof body?.status === 'string' ? body.status : undefined

    const data: any = {}
    if (recordType !== undefined) data.recordType = recordType
    if (diagnosis !== undefined) data.diagnosis = diagnosis
    if (symptoms !== undefined) data.symptoms = symptoms
    if (treatment !== undefined) data.treatment = treatment
    if (medications !== undefined) data.medications = (medications && medications.length ? medications : null)
    if (nextVisit !== undefined) data.nextVisit = nextVisit
    if (status !== undefined) data.status = status

    const updated = patientRecord
      ? await prisma.patientRecord.update({ where: { id: patientRecord.id }, data })
      : await prisma.patientRecord.create({
          data: {
            doctorId: doctorProfile.id,
            patientId,
            recordType: recordType || 'consultation',
            diagnosis: diagnosis ?? null,
            symptoms: symptoms ?? null,
            treatment: treatment ?? null,
            medications: medications ? (medications.length ? medications : null) : null,
            nextVisit: nextVisit ?? null,
            status: status || 'active'
          }
        })

    return NextResponse.json({ patientRecord: updated })
  } catch (error) {
    console.error('Error updating patient record:', error)
    return NextResponse.json({ error: 'Ошибка обновления карточки' }, { status: 500 })
  }
}


