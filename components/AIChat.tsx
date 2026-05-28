'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  MessageCircle,
  Send,
  X,
  Bot,
  User,
  Loader2,
  Paperclip,
  FileText,
  XCircle,
  Trash2,
  Maximize2,
  Minimize2,
  PanelBottomClose,
  PanelBottomOpen,
} from 'lucide-react'
import {
  CHAT_DOCUMENT_ANALYZE_PROMPT,
  formatDocumentOcrSummary,
  pollDocumentUntilParsed,
  type DocumentForChat,
} from '@/lib/chat/document-chat'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  attachedDocuments?: AttachedDocument[]
  functionResult?: any
  functionName?: string
  provider?: string
  requestId?: string
  sources?: Array<{
    sourceType?: 'document' | 'analysis' | 'diary' | 'knowledge' | 'app' | 'marketplace'
    id?: string
    label?: string
    date?: string | null
    url?: string | null
    snippet?: string
  }>
}

interface AttachedDocument {
  id: string
  fileName: string
  studyType?: string
}

type AssistantAction =
  | { type: 'select_doctor'; doctorId: string; date?: string | null }
  | { type: 'select_slot'; doctorId: string; scheduledAt: string }
  | { type: 'confirm_booking' }
  | { type: 'cancel_booking' }
  | { type: 'complete_task'; taskId: string }

type PendingBooking = {
  doctorId: string
  doctorName: string
  specialization?: string | null
  scheduledAt: string
  timeString: string
  appointmentType: string
  notes?: string | null
}

type ChatPanelSize = 'default' | 'large' | 'fullscreen'

const CHAT_PANEL_CLASS: Record<ChatPanelSize, string> = {
  default:
    'fixed bottom-6 right-6 z-50 w-[min(24rem,calc(100vw-1.5rem))] h-[min(600px,calc(100vh-5rem))]',
  large:
    'fixed bottom-4 right-4 z-50 w-[min(42rem,calc(100vw-2rem))] h-[min(85vh,52rem)]',
  fullscreen:
    'fixed inset-2 sm:inset-4 z-50 w-auto h-auto max-w-none rounded-xl',
}

export function AIChat() {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Здравствуйте! Я ИИ-ассистент персонального медицинского кабинета (не врач). Помогаю с анализами, дневником, лекарствами, планом ухода, напоминаниями и записью к врачу — без диагнозов и назначений.\n\nКакая задача сегодня: посмотреть анализы, добавить запись в дневник, проверить лекарства или записаться к врачу?\n\nНапишите вопрос — при наличии данных укажу последние отклонения. Примеры: «покажи анализы за месяц», «запиши в дневник: головная боль, сон 6 ч», «выведи отклонения».',
      timestamp: new Date()
    }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [availableDocuments, setAvailableDocuments] = useState<AttachedDocument[]>([])
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([])
  const [showDocumentSelector, setShowDocumentSelector] = useState(false)
  const [pendingBooking, setPendingBooking] = useState<PendingBooking | null>(null)
  const [isUploadingFile, setIsUploadingFile] = useState(false)
  const [panelSize, setPanelSize] = useState<ChatPanelSize>('default')
  const [showQuickSuggestions, setShowQuickSuggestions] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = window.localStorage.getItem('aiChatShowSuggestions')
    if (stored === '0') setShowQuickSuggestions(false)
  }, [])

  const toggleQuickSuggestions = () => {
    setShowQuickSuggestions((prev) => {
      const next = !prev
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('aiChatShowSuggestions', next ? '1' : '0')
      }
      return next
    })
  }

  const cyclePanelSize = () => {
    setPanelSize((prev) => {
      if (prev === 'default') return 'large'
      if (prev === 'large') return 'fullscreen'
      return 'default'
    })
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Загрузка доступных документов при открытии чата
  useEffect(() => {
    if (isOpen && availableDocuments.length === 0) {
      fetchDocuments()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  const fetchDocuments = async () => {
    try {
      const response = await fetch('/api/documents')
      if (response.ok) {
        const data = await response.json()
        setAvailableDocuments(data.documents.map((doc: any) => ({
          id: doc.id,
          fileName: doc.fileName,
          studyType: doc.studyType
        })))
      }
    } catch (error) {
      console.error('Failed to fetch documents:', error)
    }
  }

  const toggleDocumentSelection = (documentId: string) => {
    setSelectedDocuments(prev =>
      prev.includes(documentId)
        ? prev.filter(id => id !== documentId)
        : [...prev, documentId]
    )
  }

  const removeSelectedDocument = (documentId: string) => {
    setSelectedDocuments(prev => prev.filter(id => id !== documentId))
  }

  const fetchDocumentForChat = useCallback(async (id: string): Promise<DocumentForChat | null> => {
    const token = localStorage.getItem('token')
    const res = await fetch(`/api/documents/${id}`, {
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) return null
    const data = await res.json().catch(() => ({}))
    return data.document as DocumentForChat
  }, [])

  const requestAssistantReply = useCallback(
    async (params: {
      content: string
      documentIds: string[]
      attachedDocs?: AttachedDocument[]
      action?: AssistantAction
      historySnapshot?: Message[]
    }) => {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        credentials: 'include',
        body: JSON.stringify({
          message: params.content,
          history: params.historySnapshot ?? messages,
          documentIds: params.documentIds,
          ragScope: params.documentIds.length > 0 ? 'attached' : 'patient_data',
          action: params.action,
          pendingBooking,
          patientId: localStorage.getItem('caretakerPatientId') || undefined,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Ошибка получения ответа')
      return data
    },
    [messages, pendingBooking]
  )

  const runDocumentPipeline = useCallback(
    async (uploaded: AttachedDocument[]) => {
      if (uploaded.length === 0) return

      const statusId = `ocr-status-${Date.now()}`
      setMessages((prev) => [
        ...prev,
        {
          id: statusId,
          role: 'assistant',
          content: `⏳ Распознаю ${uploaded.length === 1 ? 'документ' : `${uploaded.length} документа`}… Это может занять до 2 минут.`,
          timestamp: new Date(),
        },
      ])
      setIsLoading(true)

      const parsedDocs: DocumentForChat[] = []
      for (const item of uploaded) {
        let doc = await pollDocumentUntilParsed(item.id, { fetchDoc: fetchDocumentForChat })
        if (doc && !doc.parsed) {
          const token = localStorage.getItem('token')
          await fetch(`/api/documents/${item.id}/process`, {
            method: 'POST',
            credentials: 'include',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          }).catch(() => null)
          doc = await pollDocumentUntilParsed(item.id, { maxAttempts: 45, fetchDoc: fetchDocumentForChat })
        }
        if (doc) parsedDocs.push(doc)
      }

      setMessages((prev) => prev.filter((m) => m.id !== statusId))

      const summaryParts = parsedDocs.map((d) => formatDocumentOcrSummary(d))
      if (summaryParts.length > 0) {
        setMessages((prev) => [
          ...prev,
          {
            id: `ocr-${Date.now()}`,
            role: 'assistant',
            content: `**Результат распознавания (OCR):**\n\n${summaryParts.join('\n\n---\n\n')}`,
            timestamp: new Date(),
          },
        ])
      }

      const docIds = uploaded.map((d) => d.id)
      setSelectedDocuments(docIds)

      const userMessage: Message = {
        id: `user-analyze-${Date.now()}`,
        role: 'user',
        content: CHAT_DOCUMENT_ANALYZE_PROMPT,
        timestamp: new Date(),
        attachedDocuments: uploaded,
      }
      setMessages((prev) => [...prev, userMessage])

      try {
        const data = await requestAssistantReply({
          content: CHAT_DOCUMENT_ANALYZE_PROMPT,
          documentIds: docIds,
          attachedDocs: uploaded,
        })
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: data.response,
            timestamp: new Date(),
            functionResult: data.functionResult,
            functionName: data.functionName,
            provider: data.provider,
            requestId: data.requestId,
            sources: Array.isArray(data.sources) ? data.sources : undefined,
          },
        ])
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: `analyze-err-${Date.now()}`,
            role: 'assistant',
            content:
              'OCR завершён, но AI-разбор сейчас недоступен. Проверьте DeepSeek/Ollama в настройках или откройте документ в разделе «Анализы».',
            timestamp: new Date(),
          },
        ])
      } finally {
        setSelectedDocuments([])
        setIsLoading(false)
      }
    },
    [fetchDocumentForChat, requestAssistantReply]
  )

  const uploadFilesToCabinet = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files)
    if (list.length === 0) return

    setIsUploadingFile(true)
    setShowDocumentSelector(true)
    const token = localStorage.getItem('token')
    const patientId = localStorage.getItem('caretakerPatientId')
    const uploaded: AttachedDocument[] = []
    const errors: string[] = []

    for (const file of list) {
      const formData = new FormData()
      formData.append('file', file)
      if (patientId) formData.append('patientId', patientId)

      try {
        const response = await fetch('/api/documents/upload', {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          credentials: 'include',
          body: formData,
        })
        const data = await response.json().catch(() => ({}))
        if (!response.ok) {
          errors.push(`${file.name}: ${data.error || 'ошибка загрузки'}`)
          continue
        }
        const doc = data.document
        if (doc?.id) {
          uploaded.push({
            id: doc.id,
            fileName: doc.fileName || file.name,
            studyType: undefined,
          })
        }
      } catch {
        errors.push(`${file.name}: сеть`)
      }
    }

    if (uploaded.length > 0) {
      setAvailableDocuments((prev) => {
        const ids = new Set(prev.map((d) => d.id))
        const merged = [...prev]
        for (const d of uploaded) {
          if (!ids.has(d.id)) merged.unshift(d)
        }
        return merged
      })
      setSelectedDocuments((prev) => [...new Set([...prev, ...uploaded.map((d) => d.id)])])
      if (errors.length) {
        setMessages((prev) => [
          ...prev,
          {
            id: `upload-warn-${Date.now()}`,
            role: 'assistant',
            content: `Не загружено: ${errors.join('; ')}`,
            timestamp: new Date(),
          },
        ])
      }
      setIsUploadingFile(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
      void runDocumentPipeline(uploaded)
      return
    } else if (errors.length) {
      setMessages((prev) => [
        ...prev,
        {
          id: `upload-err-${Date.now()}`,
          role: 'assistant',
          content: `Не удалось загрузить: ${errors.join('; ')}`,
          timestamp: new Date(),
        },
      ])
    }

    setIsUploadingFile(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [runDocumentPipeline])

  const requestInFlightRef = useRef(false)

  const sendChatMessage = async (content: string, action?: AssistantAction) => {
    if (!content.trim() || isLoading || isUploadingFile || requestInFlightRef.current) return
    requestInFlightRef.current = true

    const documentIdsForRequest = [...selectedDocuments]
    const attachedDocs = documentIdsForRequest
      .map((id) => availableDocuments.find((doc) => doc.id === id)!)
      .filter(Boolean)

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
      attachedDocuments: attachedDocs.length > 0 ? attachedDocs : undefined,
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setSelectedDocuments([])
    setShowDocumentSelector(false)
    setIsLoading(true)

    try {
      if (documentIdsForRequest.length > 0) {
        for (const id of documentIdsForRequest) {
          const doc = await fetchDocumentForChat(id)
          if (doc && !doc.parsed) {
            const token = localStorage.getItem('token')
            await fetch(`/api/documents/${id}/process`, {
              method: 'POST',
              credentials: 'include',
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            }).catch(() => null)
            await pollDocumentUntilParsed(id, { maxAttempts: 30, fetchDoc: fetchDocumentForChat })
          }
        }
      }

      const data = await requestAssistantReply({
        content: userMessage.content,
        documentIds: documentIdsForRequest,
        attachedDocs,
        action,
      })

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
        functionResult: data.functionResult,
        functionName: data.functionName,
        provider: data.provider,
        requestId: data.requestId,
        sources: Array.isArray(data.sources) ? data.sources : undefined,
      }
      const nextPending = data.functionResult?.pendingBooking || null
      if (
        data.functionResult?.action === 'appointment_created' ||
        data.functionResult?.action === 'booking_cancelled'
      ) {
        setPendingBooking(null)
      } else {
        setPendingBooking(nextPending)
      }
      setMessages((prev) => [...prev, assistantMessage])
    } catch {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Извините, произошла ошибка. Проверьте сеть и попробуйте ещё раз.',
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      requestInFlightRef.current = false
      setIsLoading(false)
    }
  }

  const handleSend = async () => {
    if (!input.trim() || isLoading) return
    await sendChatMessage(input.trim())
  }

  const handleAction = async (label: string, action: AssistantAction) => {
    await sendChatMessage(label, action)
  }

  const openAppLink = (href: string) => {
    if (!href) return
    setIsOpen(false)
    router.push(href)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const clearChat = () => {
    setMessages([
      {
        id: '1',
        role: 'assistant',
        content: 'Здравствуйте! Я ИИ-ассистент персонального медицинского кабинета (не врач). Помогаю с анализами, дневником, лекарствами, планом ухода, напоминаниями и записью к врачу — без диагнозов и назначений.\n\nКакая задача сегодня: посмотреть анализы, добавить запись в дневник, проверить лекарства или записаться к врачу?\n\nНапишите вопрос — при наличии данных укажу последние отклонения. Примеры: «покажи анализы за месяц», «запиши в дневник: головная боль, сон 6 ч», «выведи отклонения».',
        timestamp: new Date()
      }
    ])
    setSelectedDocuments([])
    setShowDocumentSelector(false)
    setPendingBooking(null)
  }

  const getFunctionLabel = (functionName: string): string => {
    switch (functionName) {
      case 'book_appointment': return '📅 Запись на прием'
      case 'get_analysis_results': return '📊 Результаты анализов'
      case 'get_recommendations': return '💡 Рекомендации'
      case 'get_doctors': return '👨‍⚕️ Список врачей'
      case 'get_appointments': return '📋 Записи на приемы'
      case 'get_reminders': return '🔔 Напоминания'
      case 'get_documents': return '📄 Документы'
      case 'get_diary_entries':
      case 'add_diary_entry':
      case 'diary_weekly_review': return '📓 Дневник'
      case 'get_medications': return '💊 Лекарства'
      case 'get_care_plan_tasks':
      case 'add_care_plan_task':
      case 'complete_task': return '📋 План действий'
      default: return 'Функция выполнена'
    }
  }

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        size="lg"
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50"
      >
        <MessageCircle className="h-6 w-6" />
      </Button>
    )
  }

  const panelSizeLabel =
    panelSize === 'default' ? 'Расширить окно' : panelSize === 'large' ? 'На весь экран' : 'Обычный размер'

  return (
    <Card className={`${CHAT_PANEL_CLASS[panelSize]} shadow-2xl flex flex-col min-h-0`}>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-4 border-b shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Bot className="h-6 w-6 text-primary" />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-lg truncate">AI Ассистент</CardTitle>
            <CardDescription className="text-xs truncate">
              {panelSize === 'fullscreen' ? 'Полноэкранный режим' : 'Персональный медицинский помощник'}
            </CardDescription>
          </div>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={cyclePanelSize}
            title={panelSizeLabel}
            className="h-8 w-8"
          >
            {panelSize === 'fullscreen' ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleQuickSuggestions}
            title={showQuickSuggestions ? 'Скрыть быстрые подсказки' : 'Показать быстрые подсказки'}
            className="h-8 w-8"
          >
            {showQuickSuggestions ? (
              <PanelBottomClose className="h-4 w-4" />
            ) : (
              <PanelBottomOpen className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={clearChat}
            title="Очистить чат"
            className="h-8 w-8"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsOpen(false)}
            title="Закрыть"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${
              message.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            {message.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Bot className="h-4 w-4 text-primary" />
              </div>
            )}
            <div
              className={`flex flex-col gap-2 ${
                panelSize === 'fullscreen' ? 'max-w-[min(48rem,85%)]' : 'max-w-[80%]'
              }`}
            >
              {message.attachedDocuments && message.attachedDocuments.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {message.attachedDocuments.map(doc => (
                    <Badge key={doc.id} variant="outline" className="text-xs">
                      <FileText className="h-3 w-3 mr-1" />
                      {doc.studyType || doc.fileName}
                    </Badge>
                  ))}
                </div>
              )}
              <div
                className={`rounded-lg px-4 py-2 ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                
                {/* Отображение результатов функций */}
                {message.functionResult && message.functionName && (
                  <div className="mt-3 p-3 bg-white/50 rounded-lg border">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-xs font-medium text-green-700">
                        {getFunctionLabel(message.functionName)}
                      </span>
                    </div>
                    {message.functionName === 'book_appointment' && (
                      <div className="text-xs text-green-600">
                        Запись успешно создана! Проверьте раздел «Мои записи».
                      </div>
                    )}
                    {message.functionName === 'get_analysis_results' && message.functionResult && (
                      <div className="space-y-2 text-xs text-blue-600">
                        {Array.isArray(message.functionResult?.analyses) && (
                          <>
                            <div>Показаны последние {message.functionResult.analyses.length} анализов.</div>
                            {message.functionResult.analyses.slice(0, 5).map((analysis: any) => (
                              <button
                                key={analysis.id}
                                type="button"
                                className="block text-left text-primary hover:underline font-medium"
                                onClick={() => openAppLink(`/analyses/${analysis.id}`)}
                              >
                                {analysis.title || analysis.type || 'Анализ'}
                              </button>
                            ))}
                          </>
                        )}
                        {(message.functionResult?.action === 'analyses' ||
                          message.functionResult?.action === 'analyses_empty' ||
                          message.functionResult?.link) && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => openAppLink(message.functionResult?.link || '/analyses')}
                          >
                            Открыть анализы
                          </Button>
                        )}
                      </div>
                    )}
                    {message.functionName === 'get_recommendations' && message.functionResult && (
                      <div className="text-xs text-purple-600">
                        Найдено {message.functionResult.length} рекомендаций.
                      </div>
                    )}
                    {message.functionName === 'get_doctors' && message.functionResult && (
                      <div className="space-y-2 text-xs text-orange-700">
                        <div>Найдено {message.functionResult.doctors?.length ?? message.functionResult.length ?? 0} врачей.</div>
                        {Array.isArray(message.functionResult.doctors) && message.functionResult.doctors.map((doctor: any) => (
                          <div key={doctor.id} className="rounded-md border bg-background/80 p-2 text-foreground">
                            <div className="font-medium">{doctor.name}</div>
                            <div className="text-muted-foreground">{doctor.specialization}{doctor.clinic ? `, ${doctor.clinic}` : ''}</div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="mt-2 h-7 text-xs"
                              onClick={() => handleAction(`Выбрать врача ${doctor.name}`, {
                                type: 'select_doctor',
                                doctorId: doctor.id,
                                date: null
                              })}
                              disabled={isLoading}
                            >
                              Выбрать врача
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                    {message.functionResult?.action === 'date_required' && Array.isArray(message.functionResult?.dateOptions) && (
                      <div className="space-y-2 text-xs text-blue-700">
                        <div>Выберите дату:</div>
                        <div className="flex flex-wrap gap-2">
                          {message.functionResult.dateOptions.map((option: any) => (
                            <Button
                              key={option.date}
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => handleAction(`Показать слоты на ${option.label}`, {
                                type: 'select_doctor',
                                doctorId: message.functionResult.doctors?.[0]?.id,
                                date: option.date
                              })}
                              disabled={isLoading || !message.functionResult.doctors?.[0]?.id}
                            >
                              {option.label}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                    {message.functionName === 'get_available_slots' && message.functionResult && (
                      <div className="space-y-2 text-xs text-blue-700">
                        <div>Выберите свободное время:</div>
                        <div className="flex flex-wrap gap-2">
                          {(message.functionResult.slots || []).map((slot: any) => (
                            <Button
                              key={slot.time}
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => handleAction(`Выбрать ${slot.timeString}`, {
                                type: 'select_slot',
                                doctorId: message.functionResult.doctors?.[0]?.id,
                                scheduledAt: slot.time
                              })}
                              disabled={isLoading || !message.functionResult.doctors?.[0]?.id}
                            >
                              {slot.timeString}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                    {(message.functionResult?.action === 'booking_pending') && (
                      <div className="space-y-2 text-xs text-green-700">
                        <div className="rounded-md border bg-background/80 p-2 text-foreground">
                          <div className="font-medium">{message.functionResult.pendingBooking?.doctorName}</div>
                          <div className="text-muted-foreground">
                            {new Date(message.functionResult.pendingBooking?.scheduledAt).toLocaleDateString('ru-RU')} в {message.functionResult.pendingBooking?.timeString}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => handleAction('Подтверждаю запись', { type: 'confirm_booking' })}
                            disabled={isLoading}
                          >
                            Подтвердить
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => handleAction('Отмена записи', { type: 'cancel_booking' })}
                            disabled={isLoading}
                          >
                            Отмена
                          </Button>
                        </div>
                      </div>
                    )}
                    {message.functionResult?.action === 'appointment_created' && (
                      <div className="text-xs text-green-600">
                        Запись успешно создана! Проверьте раздел «Мои записи».
                      </div>
                    )}
                    {message.functionName === 'get_appointments' && message.functionResult && (
                      <div className="space-y-2 text-xs text-indigo-700">
                        {Array.isArray(message.functionResult?.appointments) ? (
                          <>
                            <div>Показано {message.functionResult.appointments.length} записей.</div>
                            {message.functionResult.link && (
                              <a href={message.functionResult.link} className="text-primary hover:underline font-medium">
                                Открыть мои записи →
                              </a>
                            )}
                          </>
                        ) : (
                          <div>Показано {Array.isArray(message.functionResult) ? message.functionResult.length : 0} записей.</div>
                        )}
                      </div>
                    )}
                    {message.functionResult?.action === 'reminders' && Array.isArray(message.functionResult.reminders) && (
                      <div className="space-y-1 text-xs text-blue-700">
                        <div>Показано {message.functionResult.reminders.length} напоминаний.</div>
                        {message.functionResult.link && (
                          <a href={message.functionResult.link} className="text-primary hover:underline font-medium">
                            Открыть напоминания →
                          </a>
                        )}
                      </div>
                    )}
                    {message.functionResult?.action === 'documents' && Array.isArray(message.functionResult.documents) && (
                      <div className="space-y-1 text-xs text-slate-700">
                        <div>Показано {message.functionResult.documents.length} документов.</div>
                        {message.functionResult.link && (
                          <a href={message.functionResult.link} className="text-primary hover:underline font-medium">
                            Открыть документы →
                          </a>
                        )}
                      </div>
                    )}
                    {(message.functionResult?.action === 'diary_entries' || message.functionResult?.action === 'diary_entry_created') && (
                      <div className="text-xs text-rose-700 space-y-1">
                        {message.functionResult?.link && (
                          <a href={message.functionResult.link} className="text-primary hover:underline font-medium">
                            Открыть дневник →
                          </a>
                        )}
                      </div>
                    )}
                    {message.functionResult?.action === 'medications' && Array.isArray(message.functionResult.medications) && (
                      <div className="space-y-2 text-xs text-violet-700">
                        {message.functionResult.medications.map((med: any) => (
                          <div key={med.id} className="rounded-md border bg-background/80 p-2 text-foreground">
                            <div className="font-medium">{med.name}</div>
                            {med.dosage ? <div className="text-muted-foreground">{med.dosage}</div> : null}
                          </div>
                        ))}
                        {message.functionResult?.link && (
                          <a href={message.functionResult.link} className="text-primary hover:underline font-medium">
                            Все лекарства →
                          </a>
                        )}
                      </div>
                    )}
                    {message.functionResult?.action === 'care_plan_tasks' && Array.isArray(message.functionResult.tasks) && (
                      <div className="space-y-2 text-xs text-emerald-700">
                        {message.functionResult.tasks.map((task: any) => (
                          <div key={task.id} className="rounded-md border bg-background/80 p-2 text-foreground flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="font-medium truncate">{task.title}</div>
                              <div className="text-muted-foreground">{task.status}</div>
                            </div>
                            {task.status === 'ACTIVE' && task.approvalStatus !== 'PENDING' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs shrink-0"
                                onClick={() => handleAction(`Выполнено: ${task.title}`, { type: 'complete_task', taskId: task.id })}
                                disabled={isLoading}
                              >
                                Готово
                              </Button>
                            )}
                          </div>
                        ))}
                        {message.functionResult?.link && (
                          <a href={message.functionResult.link} className="text-primary hover:underline font-medium">
                            Открыть план →
                          </a>
                        )}
                      </div>
                    )}
                    {message.functionResult?.action === 'task_completed' && (
                      <div className="text-xs text-green-600">Задача выполнена.</div>
                    )}
                  </div>
                )}

                {/* Источники (RAG) */}
                {message.role === 'assistant' && Array.isArray(message.sources) && message.sources.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {(() => {
                      const seen = new Set<string>()
                      const unique = message.sources.filter((s) => {
                        const key = String(s.url || `${s.sourceType || 'src'}:${s.id || s.label || ''}`)
                        if (seen.has(key)) return false
                        seen.add(key)
                        return true
                      })
                      return unique.slice(0, 6)
                    })().map((s, idx) => {
                      const label = (s.label || s.sourceType || `SOURCE ${idx + 1}`).toString()
                      return s.url ? (
                        <a key={`${s.id || idx}`} href={s.url} className="text-xs">
                          <Badge variant="outline" className="text-xs hover:bg-muted">
                            {label}
                          </Badge>
                        </a>
                      ) : (
                        <Badge key={`${s.id || idx}`} variant="outline" className="text-xs">
                          {label}
                        </Badge>
                      )
                    })}
                  </div>
                )}
                
                <p className="text-xs opacity-70 mt-1">
                  {message.timestamp.toLocaleTimeString('ru-RU', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
            </div>
            {message.role === 'user' && (
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                <User className="h-4 w-4 text-primary-foreground" />
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div className="bg-muted rounded-lg px-4 py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </CardContent>

      <div className="p-4 border-t space-y-2 shrink-0">
        {/* Прикрепленные документы */}
        {selectedDocuments.length > 0 && (
          <div className="flex flex-wrap gap-1 pb-2 border-b">
            {selectedDocuments.map(docId => {
              const doc = availableDocuments.find(d => d.id === docId)
              return doc ? (
                <Badge key={docId} variant="secondary" className="text-xs">
                  <FileText className="h-3 w-3 mr-1" />
                  {doc.studyType || doc.fileName}
                  <button
                    onClick={() => removeSelectedDocument(docId)}
                    className="ml-1 hover:text-destructive"
                  >
                    <XCircle className="h-3 w-3" />
                  </button>
                </Badge>
              ) : null
            })}
          </div>
        )}

        {/* Селектор документов */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".pdf,image/*,.heic,.heif,.dcm,text/csv,text/plain,.doc,.docx,.xls,.xlsx"
          multiple
          onChange={(e) => {
            if (e.target.files?.length) void uploadFilesToCabinet(e.target.files)
          }}
        />

        {showDocumentSelector && (
          <div className="mb-2 p-2 border rounded-lg bg-muted/50 max-h-40 overflow-y-auto space-y-2">
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="text-xs flex-1"
                disabled={isLoading || isUploadingFile}
                onClick={() => fileInputRef.current?.click()}
              >
                {isUploadingFile ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Загрузка…
                  </>
                ) : (
                  <>📤 Загрузить PDF/фото</>
                )}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground px-1">
              Или выберите уже загруженные документы:
            </p>
            {availableDocuments.length > 0 ? (
              <div className="space-y-1">
                {availableDocuments.map(doc => (
                  <button
                    key={doc.id}
                    onClick={() => toggleDocumentSelection(doc.id)}
                    className={`w-full text-left px-2 py-1 text-xs rounded hover:bg-background transition-colors ${
                      selectedDocuments.includes(doc.id) ? 'bg-primary/10' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {doc.studyType || doc.fileName}
                      </span>
                      {selectedDocuments.includes(doc.id) && (
                        <span className="text-primary">✓</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-2">
                Нет документов — нажмите «Загрузить PDF/фото» выше
              </p>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">Быстрые подсказки</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground"
            onClick={toggleQuickSuggestions}
          >
            {showQuickSuggestions ? 'Скрыть' : 'Показать'}
          </Button>
        </div>
        {showQuickSuggestions && (
          <div className="flex flex-wrap gap-2 mb-2 max-h-28 overflow-y-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => sendChatMessage('Хочу записаться на прием')}
              disabled={isLoading}
              className="text-xs"
            >
              📅 Запись на прием
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => sendChatMessage('Покажи список врачей')}
              disabled={isLoading}
              className="text-xs"
            >
              👨‍⚕️ Врачи
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => sendChatMessage('Покажи мои результаты анализов')}
              disabled={isLoading}
              className="text-xs"
            >
              📊 Анализы
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => sendChatMessage('Покажи мои записи на приемы')}
              disabled={isLoading}
              className="text-xs"
            >
              📋 Мои записи
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => sendChatMessage('Покажи мой дневник')}
              disabled={isLoading}
              className="text-xs"
            >
              📓 Дневник
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => sendChatMessage('Покажи мои лекарства')}
              disabled={isLoading}
              className="text-xs"
            >
              💊 Лекарства
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => sendChatMessage('Покажи задачи плана')}
              disabled={isLoading}
              className="text-xs"
            >
              ✅ План
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => sendChatMessage('Покажи мои напоминания')}
              disabled={isLoading}
              className="text-xs"
            >
              🔔 Напоминания
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => sendChatMessage('Покажи мои документы')}
              disabled={isLoading}
              className="text-xs"
            >
              📄 Документы
            </Button>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowDocumentSelector(!showDocumentSelector)}
            disabled={isLoading || isUploadingFile}
            title="Загрузить или прикрепить документ"
          >
            <Paperclip className={`h-4 w-4 ${selectedDocuments.length > 0 ? 'text-primary' : ''}`} />
          </Button>
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Напишите ваш вопрос..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            size="icon"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground text-center">
          AI может ошибаться. Проверяйте важную информацию.
        </p>
      </div>
    </Card>
  )
}

