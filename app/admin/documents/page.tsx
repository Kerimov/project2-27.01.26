'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/contexts/AuthContext'
import { 
  FileText, 
  Search, 
  Eye, 
  Download,
  Trash2,
  User,
  Calendar,
  ArrowLeft,
  Database,
  TrendingUp
} from 'lucide-react'
import Link from 'next/link'

interface Document {
  id: string
  fileName: string
  fileType: string
  fileSize: number
  uploadDate: string
  parsed: boolean
  userId: string
  user: {
    name: string
    email: string
  }
  analyses: {
    id: string
    title: string
    status: string
    createdAt: string
  }[]
}

export default function AdminDocumentsPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null)
  
  const isAdmin = !!(user && user.role === 'ADMIN')

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login')
    } else if (!isLoading && user && !isAdmin) {
      router.push('/dashboard')
    }
  }, [user, isLoading, router, isAdmin])

  useEffect(() => {
    const fetchDocuments = async () => {
      if (!user || !isAdmin) return
      
      try {
        setLoading(true)
        const token = localStorage.getItem('token')
        if (!token) return

        const response = await fetch('/api/admin/documents', {
          headers: { Authorization: `Bearer ${token}` }
        })
        
        if (response.ok) {
          const data = await response.json()
          setDocuments(data.documents)
        }
      } catch (error) {
        console.error('Error fetching documents:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchDocuments()
  }, [user, isAdmin])

  const filteredDocuments = documents.filter(doc => 
    doc.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.user.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleDeleteDocument = async (documentId: string) => {
    if (!confirm('Вы уверены, что хотите удалить этот документ?')) return
    
    try {
      const token = localStorage.getItem('token')
      if (!token) return

      const response = await fetch(`/api/admin/documents/${documentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      
      if (response.ok) {
        setDocuments(documents.filter(doc => doc.id !== documentId))
      }
    } catch (error) {
      console.error('Error deleting document:', error)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  if (isLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <FileText className="h-12 w-12 text-primary animate-pulse mx-auto mb-4" />
          <p className="text-muted-foreground">Загрузка документов...</p>
        </div>
      </div>
    )
  }

  if (!user || !isAdmin) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      <main className="container py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-6">
            <Link href="/admin">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Назад
              </Button>
            </Link>
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full gradient-primary shadow-medical">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gradient-brand">
                Управление документами
              </h1>
              <p className="text-muted-foreground">
                Просмотр и управление загруженными документами и анализами
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Поиск документов..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Badge variant="secondary" className="px-3 py-1">
              {filteredDocuments.length} документов
            </Badge>
          </div>
        </div>

        {/* Documents Table */}
        <Card className="glass-effect border-0 shadow-medical">
          <CardHeader>
            <CardTitle className="text-xl">Список документов</CardTitle>
            <CardDescription>
              Все загруженные документы и связанные с ними анализы
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Документ</TableHead>
                    <TableHead>Пользователь</TableHead>
                    <TableHead>Размер</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Дата загрузки</TableHead>
                    <TableHead>Анализы</TableHead>
                    <TableHead>Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDocuments.map((doc) => (
                    <TableRow key={doc.id} className="hover:bg-muted/50">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-blue-100/50">
                            <FileText className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-semibold">{doc.fileName}</p>
                            <p className="text-sm text-muted-foreground">{doc.fileType}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">{doc.user.name}</p>
                            <p className="text-xs text-muted-foreground">{doc.user.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{formatFileSize(doc.fileSize)}</span>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={doc.parsed ? "default" : "secondary"}
                          className={doc.parsed ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}
                        >
                          {doc.parsed ? 'Обработан' : 'Новый'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">
                            {new Date(doc.uploadDate).toLocaleDateString('ru-RU')}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{doc.analyses.length}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedDocument(doc)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              // TODO: Скачивание документа
                              alert('Функция скачивания будет добавлена')
                            }}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDeleteDocument(doc.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Document Details Modal */}
        {selectedDocument && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-4xl glass-effect border-0 shadow-medical-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl">Детали документа</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedDocument(null)}
                  >
                    ✕
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="p-4 rounded-2xl bg-blue-100/50">
                      <FileText className="h-8 w-8 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold">{selectedDocument.fileName}</h3>
                      <p className="text-muted-foreground">{selectedDocument.fileType}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h4 className="font-semibold text-gray-800">Информация о документе</h4>
                      <div className="space-y-2">
                        <p className="text-sm">
                          <strong>Размер:</strong> {formatFileSize(selectedDocument.fileSize)}
                        </p>
                        <p className="text-sm">
                          <strong>Статус:</strong> 
                          <Badge 
                            variant={selectedDocument.parsed ? "default" : "secondary"}
                            className={`ml-2 ${selectedDocument.parsed ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}
                          >
                            {selectedDocument.parsed ? 'Обработан' : 'Новый'}
                          </Badge>
                        </p>
                        <p className="text-sm">
                          <strong>Дата загрузки:</strong> {new Date(selectedDocument.uploadDate).toLocaleString('ru-RU')}
                        </p>
                        <p className="text-sm">
                          <strong>ID:</strong> {selectedDocument.id}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-semibold text-gray-800">Пользователь</h4>
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-blue-50/50 to-green-50/50 border border-blue-100/50">
                        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
                          <span className="text-white font-semibold">
                            {selectedDocument.user.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-semibold">{selectedDocument.user.name}</p>
                          <p className="text-sm text-muted-foreground">{selectedDocument.user.email}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {selectedDocument.analyses.length > 0 && (
                    <div className="space-y-4">
                      <h4 className="font-semibold text-gray-800">Связанные анализы</h4>
                      <div className="space-y-3">
                        {selectedDocument.analyses.map((analysis) => (
                          <div key={analysis.id} className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-green-50/50 to-emerald-50/50 border border-green-100/50">
                            <div className="p-2 rounded-lg bg-green-100/50">
                              <TrendingUp className="h-4 w-4 text-green-600" />
                            </div>
                            <div className="flex-1">
                              <p className="font-semibold">{analysis.title}</p>
                              <p className="text-sm text-muted-foreground">
                                Статус: {analysis.status === 'normal' ? 'Норма' : analysis.status === 'abnormal' ? 'Отклонение' : analysis.status === 'critical' ? 'Критично' : analysis.status} • {new Date(analysis.createdAt).toLocaleDateString('ru-RU')}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  )
}
