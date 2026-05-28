import type { NavGroup } from './patient-navigation'
import {
  Bell,
  BookOpen,
  Database,
  FileText,
  LayoutDashboard,
  Settings,
  Shield,
  Users,
} from 'lucide-react'

export const ADMIN_NAV_GROUPS: NavGroup[] = [
  {
    label: null,
    items: [{ href: '/admin', label: 'Обзор', icon: LayoutDashboard }],
  },
  {
    label: 'Управление',
    items: [
      { href: '/admin/users', label: 'Пользователи', icon: Users },
      { href: '/admin/documents', label: 'Документы', icon: FileText },
      { href: '/admin/knowledge', label: 'База знаний', icon: BookOpen },
      { href: '/admin/reminders', label: 'Напоминания', icon: Bell },
    ],
  },
  {
    label: 'Система',
    items: [
      { href: '/admin/settings', label: 'Настройки AI', icon: Settings },
      { href: '/admin/users/roles', label: 'Роли', icon: Shield },
      { href: '/analytics', label: 'Аналитика', icon: Database },
    ],
  },
]
