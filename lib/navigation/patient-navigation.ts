import type { LucideIcon } from 'lucide-react'
import {
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  Calendar,
  FileText,
  HelpCircle,
  LayoutDashboard,
  NotebookPen,
  Settings,
  TrendingUp,
  User,
} from 'lucide-react'

export type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  description?: string
}

export type NavGroup = {
  label: string | null
  items: NavItem[]
}

/** Основная навигация пациента (левая колонка). */
export const PATIENT_NAV_GROUPS: NavGroup[] = [
  {
    label: null,
    items: [
      {
        href: '/dashboard',
        label: 'Обзор',
        icon: LayoutDashboard,
        description: 'Сводка: приёмы, анализы, показатели',
      },
    ],
  },
  {
    label: 'Данные о здоровье',
    items: [
      { href: '/documents', label: 'Документы', icon: FileText, description: 'Загрузки и OCR' },
      { href: '/analyses', label: 'Анализы', icon: TrendingUp, description: 'Результаты и динамика' },
      {
        href: '/diary',
        label: 'Дневник',
        icon: NotebookPen,
        description: 'Самочувствие, лекарства, план',
      },
    ],
  },
  {
    label: 'Расписание',
    items: [
      { href: '/my-appointments', label: 'Записи к врачу', icon: Calendar },
      { href: '/reminders', label: 'Напоминания', icon: Bell },
    ],
  },
  {
    label: 'Сервисы',
    items: [
      { href: '/knowledge-base', label: 'Справочник', icon: BookOpen },
      { href: '/marketplace', label: 'Маркетплейс', icon: Building2 },
      { href: '/analytics', label: 'Аналитика', icon: BarChart3 },
    ],
  },
]

export const PATIENT_NAV_ACCOUNT: NavItem[] = [
  { href: '/profile', label: 'Профиль здоровья', icon: User },
  { href: '/settings', label: 'Настройки', icon: Settings },
  { href: '/help', label: 'Справка', icon: HelpCircle },
]
