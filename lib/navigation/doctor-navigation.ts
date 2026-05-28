import type { LucideIcon } from 'lucide-react'
import {
  Calendar,
  LayoutDashboard,
  Pill,
  Stethoscope,
  TrendingUp,
  Users,
} from 'lucide-react'
import type { NavGroup, NavItem } from './patient-navigation'

export const DOCTOR_NAV_GROUPS: NavGroup[] = [
  {
    label: null,
    items: [{ href: '/doctor', label: 'Кабинет', icon: LayoutDashboard }],
  },
  {
    label: 'Работа',
    items: [
      { href: '/doctor/patients', label: 'Пациенты', icon: Users },
      { href: '/doctor/appointments', label: 'Приёмы', icon: Calendar },
      { href: '/doctor/analyses', label: 'Анализы', icon: TrendingUp },
      { href: '/doctor/prescriptions', label: 'Рецепты', icon: Pill },
    ],
  },
]

export const DOCTOR_NAV_FOOTER: NavItem[] = [
  { href: '/doctor/setup', label: 'Профиль врача', icon: Stethoscope },
]
