'use client'

import { Heart, Activity, Shield } from 'lucide-react'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
  className?: string
}

export function Logo({ size = 'md', showText = true, className = '' }: LogoProps) {
  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-12 w-12'
  }

  const textSizeClasses = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl'
  }

  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      {/* Логотип с градиентом */}
      <div className={`relative ${sizeClasses[size]}`}>
        {/* Основной круг с градиентом */}
        <div className="absolute inset-0 rounded-full gradient-primary shadow-medical animate-pulse-soft"></div>
        
        {/* Внутренний круг */}
        <div className="absolute inset-1 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center">
          {/* Медицинский крест */}
          <div className="relative">
            {/* Горизонтальная линия */}
            <div className="w-3 h-0.5 bg-primary rounded-full"></div>
            {/* Вертикальная линия */}
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-0.5 h-3 bg-primary rounded-full"></div>
          </div>
        </div>
        
        {/* Декоративные элементы */}
        <div className="absolute -top-1 -right-1 w-2 h-2 bg-medical-coral rounded-full animate-pulse"></div>
        <div className="absolute -bottom-1 -left-1 w-1.5 h-1.5 bg-medical-emerald rounded-full animate-pulse" style={{ animationDelay: '0.5s' }}></div>
      </div>

      {/* Текст логотипа */}
      {showText && (
        <div className="flex flex-col">
          <span className={`font-bold ${textSizeClasses[size]} text-gradient-brand`}>
            ПМА
          </span>
          <span className="text-xs text-muted-foreground font-medium">
            Персональный Медицинский Ассистент
          </span>
        </div>
      )}
    </div>
  )
}

// Компактная версия логотипа
export function LogoCompact({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <div className="relative h-8 w-8">
        <div className="absolute inset-0 rounded-full gradient-primary shadow-medical"></div>
        <div className="absolute inset-1 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center">
          <div className="relative">
            <div className="w-2.5 h-0.5 bg-primary rounded-full"></div>
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-0.5 h-2.5 bg-primary rounded-full"></div>
          </div>
        </div>
      </div>
      <span className="font-bold text-lg text-gradient-brand">
        ПМА
      </span>
    </div>
  )
}
