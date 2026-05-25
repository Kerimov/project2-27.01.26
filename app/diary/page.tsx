'use client'

import { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { BookOpen, ClipboardList, Pill } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DiaryEntriesPanel } from '@/components/diary/DiaryEntriesPanel'
import { MedicationsPanel } from '@/components/diary/MedicationsPanel'
import { CarePlanPanel } from '@/components/diary/CarePlanPanel'

export type DiaryTab = 'entries' | 'medications' | 'plan'

const TABS: { id: DiaryTab; label: string; icon: typeof BookOpen }[] = [
  { id: 'entries', label: 'Записи', icon: BookOpen },
  { id: 'medications', label: 'Лекарства', icon: Pill },
  { id: 'plan', label: 'План', icon: ClipboardList },
]

function parseTab(raw: string | null): DiaryTab {
  if (raw === 'medications' || raw === 'plan') return raw
  return 'entries'
}

function DiaryHubInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tab = parseTab(searchParams.get('tab'))

  const setTab = (next: DiaryTab) => {
    const params = new URLSearchParams(searchParams.toString())
    if (next === 'entries') params.delete('tab')
    else params.set('tab', next)
    const qs = params.toString()
    router.replace(qs ? `/diary?${qs}` : '/diary')
  }

  return (
    <div className="web-page">
      <div className="web-container space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Дневник</h1>
          <p className="text-muted-foreground mt-1">
            Записи самочувствия, лекарства и план действий в одном месте
          </p>
        </div>

        <nav
          className="flex flex-wrap gap-2 p-1 rounded-xl bg-muted/50 border"
          aria-label="Разделы дневника"
        >
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors',
                tab === id
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/60'
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>

        {tab === 'entries' && <DiaryEntriesPanel />}
        {tab === 'medications' && <MedicationsPanel />}
        {tab === 'plan' && <CarePlanPanel />}
      </div>
    </div>
  )
}

export default function DiaryPage() {
  return (
    <Suspense
      fallback={
        <div className="web-page">
          <div className="web-container py-12 text-center text-muted-foreground">Загрузка…</div>
        </div>
      }
    >
      <DiaryHubInner />
    </Suspense>
  )
}
