import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { callOllamaChat, callOllamaJson, isOllamaConfigured } from '@/lib/ollama'
import { parse as parseCookies } from 'cookie'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getToken(request: NextRequest) {
  const auth = request.headers.get('authorization') || ''
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7)
  const cookieHeader = request.headers.get('cookie')
  const cookies = cookieHeader ? parseCookies(cookieHeader) : {}
  return cookies.token || null
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text)
  } catch {}
  return null
}

export async function POST(request: NextRequest) {
  try {
    const token = getToken(request)
    if (!token) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    const decoded = verifyToken(token)
    if (!decoded?.userId) return NextResponse.json({ error: 'Неверный токен' }, { status: 401 })

    const doctor = await prisma.doctorProfile.findUnique({ where: { userId: decoded.userId }, select: { id: true } })
    if (!doctor) return NextResponse.json({ error: 'Профиль врача не найден' }, { status: 403 })

    const body = await request.json().catch(() => ({}))
    const patientId = typeof body?.patientId === 'string' ? body.patientId.trim() : ''
    const candidate = {
      medication: typeof body?.medication === 'string' ? body.medication.trim() : '',
      dosage: typeof body?.dosage === 'string' ? body.dosage.trim() : '',
      frequency: typeof body?.frequency === 'string' ? body.frequency.trim() : '',
      duration: typeof body?.duration === 'string' ? body.duration.trim() : '',
      instructions: typeof body?.instructions === 'string' ? body.instructions.trim() : '',
    }
    if (!patientId) return NextResponse.json({ error: 'patientId обязателен' }, { status: 400 })
    if (!candidate.medication) return NextResponse.json({ error: 'medication обязателен' }, { status: 400 })

    // access check (record or appointment)
    const [rec, appt] = await Promise.all([
      prisma.patientRecord.findFirst({ where: { doctorId: doctor.id, patientId }, select: { id: true } }),
      prisma.appointment.findFirst({ where: { doctorId: doctor.id, patientId }, select: { id: true } })
    ])
    if (!rec && !appt) return NextResponse.json({ error: 'Нет доступа к пациенту' }, { status: 403 })

    const meds = await prisma.patientMedication.findMany({
      where: { userId: patientId },
      select: { name: true, dosage: true, route: true, frequencyPerDay: true, times: true, isSupplement: true, notes: true }
    })

    // only prescriptions created by this doctor (MVP, scoped access)
    const recordIds = await prisma.patientRecord.findMany({
      where: { doctorId: doctor.id, patientId },
      select: { id: true }
    })
    const ids = recordIds.map((r) => r.id)
    const activePres = ids.length
      ? await prisma.prescription.findMany({
          where: { patientRecordId: { in: ids }, isActive: true },
          select: { medication: true, dosage: true, frequency: true, duration: true, instructions: true, expiresAt: true }
        })
      : []

    if (!isOllamaConfigured()) {
      // fallback: minimal checks without AI
      const name = candidate.medication.toLowerCase()
      const dup = activePres.some((p) => p.medication.toLowerCase() === name) || meds.some((m) => (m.name || '').toLowerCase() === name)
      return NextResponse.json({
        ok: true,
        mode: 'fallback',
        warnings: dup ? [{ severity: 'medium', title: 'Возможный дубль', details: 'Похоже, препарат уже есть у пациента (по названию). Проверьте дозировку/дубли.' }] : [],
        note: 'AI выключен (нет Ollama). Показана упрощённая проверка.'
      })
    }

    const system = [
      'Ты помощник врача. Задача: проверить лекарственные взаимодействия и риски.',
      'Отвечай строго JSON объектом.',
      'Если данных недостаточно — укажи missingInfo.',
      'Не выдумывай диагнозы. Формулируй предупреждения кратко и по делу.',
      '',
      'JSON формат:',
      '{ "warnings":[{"severity":"high|medium|low","title":"...","details":"...","recommendation":"..."}], "missingInfo":[...], "notes":[...] }'
    ].join('\n')

    const user = JSON.stringify(
      {
        patientEnteredMedications: meds,
        activePrescriptionsByThisDoctor: activePres,
        newPrescriptionCandidate: candidate,
        locale: 'ru-RU'
      },
      null,
      2
    )

    const text = await callOllamaJson(system, user)
    const parsed = safeJsonParse(text)

    const warnings = Array.isArray(parsed?.warnings) ? parsed.warnings : []
    const missingInfo = Array.isArray(parsed?.missingInfo) ? parsed.missingInfo : []
    const notes = Array.isArray(parsed?.notes) ? parsed.notes : []

    return NextResponse.json({ ok: true, mode: 'ai', warnings, missingInfo, notes })
  } catch (e) {
    console.error('[doctor][prescriptions][interactions] error:', e)
    return NextResponse.json({ error: 'Ошибка проверки взаимодействий' }, { status: 500 })
  }
}


