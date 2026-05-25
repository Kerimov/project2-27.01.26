'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AIChat } from '@/components/AIChat'
import {
  Activity,
  Upload,
  FileText,
  Image,
  File,
  Trash2,
  Eye,
  Download,
  Filter,
  Search,
  Loader2,
  CheckCircle,
  AlertCircle,
  LogOut,
  Plus
} from 'lucide-react'
import Link from 'next/link'

interface Document {
  id: string
  fileName: string
  fileType: string
  fileSize: number
  uploadDate: string
  parsed: boolean
  studyType?: string
  studyDate?: string
  category?: string
  ocrConfidence?: number
}

export default function DocumentsPage() {
  const { user, logout, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [documents, setDocuments] = useState<Document[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())
  const pollTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [dragActive, setDragActive] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    } else if (user) {
      loadDocuments()
    }
  }, [user, authLoading, router])

  const loadDocuments = async () => {
    try {
      const response = await fetch('/api/documents')
      if (response.ok) {
        const data = await response.json()
        setDocuments(data.documents)

        // Автоподхват незавершённых распознаваний и запуск опроса
        const pending = data.documents.filter((d: Document) => !d.parsed)
        setProcessingIds((prev) => {
          const next = new Set(prev)
          for (const doc of pending) {
            if (!next.has(doc.id) && !pollTimersRef.current[doc.id]) {
              next.add(doc.id)
              void pollDocument(doc.id)
            }
          }
          return next
        })
      }
    } catch (error) {
      console.error('Error loading documents:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Опрос одного документа до завершения распознавания
  const pollDocument = async (id: string) => {
    // Не запускаем второй раз для того же id
    if (pollTimersRef.current[id]) return

    const tick = async () => {
      try {
        const res = await fetch(`/api/documents/${id}`)
        if (res.ok) {
          const { document } = await res.json()
          setDocuments((prev) => prev.map((d) => (d.id === id ? { ...d, ...document } : d)))
          if (document.parsed) {
            clearTimeout(pollTimersRef.current[id])
            delete pollTimersRef.current[id]
            setProcessingIds((prev) => {
              const next = new Set(prev)
              next.delete(id)
              return next
            })
            return
          }
        }
      } catch {}
      // Повторить через 1.5 сек
      pollTimersRef.current[id] = setTimeout(tick, 1500)
    }

    pollTimersRef.current[id] = setTimeout(tick, 1500)
  }

  // Очистка таймеров при размонтировании
  useEffect(() => {
    return () => {
      Object.values(pollTimersRef.current).forEach((t) => clearTimeout(t))
      pollTimersRef.current = {}
    }
  }, [])

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await handleFiles(e.dataTransfer.files)
    }
  }, [])

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await handleFiles(e.target.files)
    }
  }

  const handleFiles = async (files: FileList) => {
    setIsUploading(true)

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const formData = new FormData()
      formData.append('file', file)

      try {
        const response = await fetch('/api/documents/upload', {
          method: 'POST',
          body: formData
        })

        if (response.ok) {
          const data = await response.json()
          const newId = data?.document?.id as string | undefined
          await loadDocuments()
          if (newId) {
            setProcessingIds((prev) => new Set(prev).add(newId))
            void pollDocument(newId)
          }
        } else {
          const error = await response.json()
          alert(`Ошибка загрузки ${file.name}: ${error.error}`)
        }
      } catch (error) {
        console.error('Upload error:', error)
        alert(`Ошибка загрузки ${file.name}`)
      }
    }

    setIsUploading(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить документ?')) return

    try {
      const response = await fetch(`/api/documents/${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        await loadDocuments()
      }
    } catch (error) {
      console.error('Delete error:', error)
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const getFileIcon = (fileType: string) => {
    if (fileType.includes('image')) return <Image className="h-5 w-5" />
    if (fileType.includes('pdf')) return <FileText className="h-5 w-5" />
    return <File className="h-5 w-5" />
  }

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         doc.studyType?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = filterCategory === 'all' || doc.category === filterCategory
    return matchesSearch && matchesCategory
  })

  if (authLoading || (isLoading && !user)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!user) return null

  const handleLogout = () => {
    logout()
    router.push('/')
  }

  return (
    <div className="web-page">
      <main className="web-container">
        {/* Top toolbar (inside page, to avoid duplicate global header) */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
          </div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard">
              <Button variant="ghost">← Назад</Button>
            </Link>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="web-hero mb-8">
          <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="web-kicker mb-4">
                <FileText className="h-4 w-4" />
                Медицинский архив
              </div>
              <h1 className="web-page-title">Мои документы</h1>
              <p className="web-page-subtitle">
                Загружайте PDF, фото и файлы исследований. После распознавания документы связываются с анализами и AI-разбором.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="web-stat-card min-w-32 p-4">
                <p className="text-muted-foreground">Всего</p>
                <p className="text-2xl font-extrabold">{documents.length}</p>
              </div>
              <div className="web-stat-card min-w-32 p-4">
                <p className="text-muted-foreground">Распознано</p>
                <p className="text-2xl font-extrabold">{documents.filter((d) => d.parsed).length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Upload Area */}
        <Card className="web-card mb-8">
          <CardHeader>
            <CardTitle>Загрузить документы</CardTitle>
            <CardDescription>
              Поддерживаются: PDF, JPG, PNG, DICOM, CSV, TXT
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={`rounded-3xl border-2 border-dashed p-12 text-center transition-colors ${
                dragActive
                  ? 'border-primary bg-primary/5'
                  : 'border-primary/20 bg-muted/40 hover:border-primary/50'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              {isUploading ? (
                <div className="space-y-4">
                  <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
                  <p className="text-muted-foreground">Загрузка и обработка...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="web-icon-bubble mx-auto h-14 w-14">
                    <Upload className="h-7 w-7" />
                  </div>
                  <div>
                    <p className="text-lg font-medium mb-2">
                      Перетащите файлы сюда или
                    </p>
                    <label htmlFor="file-upload">
                      <Button type="button" onClick={() => document.getElementById('file-upload')?.click()}>
                        <Plus className="mr-2 h-4 w-4" />
                        Выбрать файлы
                      </Button>
                    </label>
                    <Input
                      id="file-upload"
                      type="file"
                      className="hidden"
                      multiple
                      accept=".pdf,.jpg,.jpeg,.png,.dcm,.csv,.txt"
                      onChange={handleFileInput}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Максимальный размер файла: 10 МБ
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Filters and Search */}
        <Card className="web-card mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Поиск по названию или типу..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={filterCategory === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterCategory('all')}
                >
                  Все
                </Button>
                <Button
                  variant={filterCategory === 'blood_test' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterCategory('blood_test')}
                >
                  Анализы
                </Button>
                <Button
                  variant={filterCategory === 'imaging' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterCategory('imaging')}
                >
                  Снимки
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Documents List */}
        {filteredDocuments.length === 0 ? (
          <Card className="web-card">
            <CardContent className="py-12 text-center">
              <div className="web-icon-bubble mx-auto mb-4 h-14 w-14">
                <FileText className="h-7 w-7" />
              </div>
              <p className="text-lg font-medium mb-2">Нет документов</p>
              <p className="text-muted-foreground">
                Загрузите первый документ для начала работы
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDocuments.map((doc) => (
              <Card key={doc.id} className="web-card web-card-hover">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="web-icon-bubble h-11 w-11 rounded-xl">
                        {getFileIcon(doc.fileType)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium truncate">{doc.fileName}</h3>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(doc.fileSize)}
                        </p>
                      </div>
                    </div>
                    {doc.parsed ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <Loader2 className="h-5 w-5 text-primary animate-spin" />
                    )}
                  </div>

                  {doc.studyType && (
                    <div className="mb-2">
                      <p className="text-sm font-medium text-primary">{doc.studyType}</p>
                    </div>
                  )}

                  {doc.studyDate && (
                    <p className="text-xs text-muted-foreground mb-4">
                      Дата: {new Date(doc.studyDate).toLocaleDateString('ru-RU')}
                    </p>
                  )}

                  {doc.ocrConfidence && doc.parsed && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Распознано</span>
                        <span className="font-medium">{Math.round(doc.ocrConfidence * 100)}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5">
                        <div
                          className="bg-primary h-1.5 rounded-full transition-all"
                          style={{ width: `${doc.ocrConfidence * 100}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {!doc.parsed && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Распознаётся…</span>
                        <span className="text-muted-foreground">ожидание</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                        <div className="h-1.5 bg-primary animate-[progress_1.2s_linear_infinite]" style={{ width: '40%' }} />
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Link href={`/documents/${doc.id}`} className="flex-1">
                      <Button size="sm" variant="outline" className="w-full">
                        <Eye className="h-4 w-4 mr-1" />
                        Открыть
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(doc.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <p className="text-xs text-muted-foreground mt-3">
                    Загружено: {new Date(doc.uploadDate).toLocaleDateString('ru-RU')}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <AIChat />
    </div>
  )
}

