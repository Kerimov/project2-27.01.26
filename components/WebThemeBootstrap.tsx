'use client'

import { useEffect } from 'react'
import { applyThemeToDocument, getWebTheme } from '@/lib/theme-store-web'

/** Применяет сохранённую тему при загрузке приложения. */
export function WebThemeBootstrap() {
  useEffect(() => {
    applyThemeToDocument(getWebTheme())
  }, [])
  return null
}
