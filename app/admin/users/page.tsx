'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useAuth } from '@/contexts/AuthContext'
import { 
  Users, 
  Search, 
  Edit, 
  Trash2, 
  Eye,
  Shield,
  Calendar,
  Mail,
  ArrowLeft,
  Save,
  X,
  AlertCircle,
  CheckCircle,
  Loader2,
  UserPlus,
  User,
  Stethoscope
} from 'lucide-react'
import Link from 'next/link'

interface User {
  id: string
  name: string
  email: string
  role: 'PATIENT' | 'DOCTOR' | 'ADMIN'
  createdAt: string
  documentsCount: number
  analysesCount: number
  remindersCount: number
  recommendationsCount: number
}

export default function AdminUsersPage() {
  const { user: currentUser, isLoading, token } = useAuth()
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [deleteUser, setDeleteUser] = useState<User | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    role: 'PATIENT' as 'PATIENT' | 'DOCTOR' | 'ADMIN'
  })
  
  const isAdmin = !!(currentUser && currentUser.role === 'ADMIN')

  useEffect(() => {
    if (!isLoading && !currentUser) {
      router.push('/login')
    } else if (!isLoading && currentUser && !isAdmin) {
      router.push('/dashboard')
    }
  }, [currentUser, isLoading, router, isAdmin])

  useEffect(() => {
    const fetchUsers = async () => {
      if (!currentUser || !isAdmin) return
      
      try {
        setLoading(true)
        if (!token) return

        const response = await fetch('/api/admin/users', {
          headers: { Authorization: `Bearer ${token}` }
        })
        
        if (response.ok) {
          const data = await response.json()
          setUsers(data.users)
        }
      } catch (error) {
        console.error('Error fetching users:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchUsers()
  }, [currentUser, isAdmin, token])

  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleEditUser = (user: User) => {
    setEditingUser(user)
    setNewPassword('')
    setMessage(null)
  }

  const handleSaveUser = async (updatedUser: User) => {
    setSaving(true)
    setMessage(null)

    try {
      if (!token) return
      if (!token) return

      const updateData: any = {
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role
      }

      if (newPassword.trim()) {
        updateData.password = newPassword
      }

      const response = await fetch(`/api/admin/users/${updatedUser.id}`, {
        method: 'PUT',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      })

      if (response.ok) {
        const data = await response.json()
        setUsers(users.map(u => u.id === updatedUser.id ? data : u))
        setEditingUser(null)
        setNewPassword('')
        setMessage({ type: 'success', text: 'Пользователь успешно обновлен' })
      } else {
        const error = await response.json()
        setMessage({ type: 'error', text: error.error || 'Ошибка при обновлении пользователя' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Ошибка при обновлении пользователя' })
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteUser = async (userToDelete: User) => {
    setDeleting(true)
    setMessage(null)

    try {
      if (!token) return
      if (!token) return

      const response = await fetch(`/api/admin/users/${userToDelete.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })

      if (response.ok) {
        setUsers(users.filter(user => user.id !== userToDelete.id))
        setDeleteUser(null)
        setMessage({ type: 'success', text: 'Пользователь успешно удален' })
      } else {
        const error = await response.json()
        setMessage({ type: 'error', text: error.error || 'Ошибка при удалении пользователя' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Ошибка при удалении пользователя' })
    } finally {
      setDeleting(false)
    }
  }

  const handleCreateUser = async () => {
    if (!token) return
    
    if (!newUser.name || !newUser.email || !newUser.password) {
      setMessage({ type: 'error', text: 'Все поля обязательны для заполнения' })
      return
    }

    if (newUser.password.length < 6) {
      setMessage({ type: 'error', text: 'Пароль должен содержать минимум 6 символов' })
      return
    }

    try {
      setCreating(true)
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(newUser)
      })

      if (response.ok) {
        const data = await response.json()
        setUsers([data.user, ...users])
        setShowCreateModal(false)
        setNewUser({ name: '', email: '', password: '', role: 'PATIENT' })
        setMessage({ type: 'success', text: 'Пользователь успешно создан' })
      } else {
        const error = await response.json()
        setMessage({ type: 'error', text: error.error || 'Ошибка при создании пользователя' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Ошибка при создании пользователя' })
    } finally {
      setCreating(false)
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return <Shield className="h-4 w-4" />
      case 'DOCTOR':
        return <Stethoscope className="h-4 w-4" />
      default:
        return <User className="h-4 w-4" />
    }
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'destructive'
      case 'DOCTOR':
        return 'default'
      default:
        return 'secondary'
    }
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'Администратор'
      case 'DOCTOR':
        return 'Врач'
      default:
        return 'Пациент'
    }
  }

  if (isLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Users className="h-12 w-12 text-primary animate-pulse mx-auto mb-4" />
          <p className="text-muted-foreground">Загрузка пользователей...</p>
        </div>
      </div>
    )
  }

  if (!currentUser || !isAdmin) {
    return null
  }

  return (
    <div className="web-page">
      <main className="web-container">
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
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gradient-brand">
                Управление пользователями
              </h1>
              <p className="text-muted-foreground">
                Просмотр и управление пользователями системы
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="flex items-center gap-4 mb-6">
            <div className="web-search-field flex-1 max-w-md">
              <Search className="web-search-icon h-4 w-4" />
              <Input
                placeholder="Поиск пользователей..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="web-search-input"
              />
            </div>
            <Badge variant="secondary" className="px-3 py-1">
              {filteredUsers.length} пользователей
            </Badge>
            <Button 
              onClick={() => setShowCreateModal(true)}
              className="bg-gradient-to-r from-green-500 to-emerald-500 hover:opacity-90 text-white"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Создать пользователя
            </Button>
          </div>
        </div>

        {/* Users Table */}
        <Card className="glass-effect border-0 shadow-medical">
          <CardHeader>
            <CardTitle className="text-xl">Список пользователей</CardTitle>
            <CardDescription>
              Все зарегистрированные пользователи системы
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Пользователь</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Роль</TableHead>
                    <TableHead>Дата регистрации</TableHead>
                    <TableHead>Активность</TableHead>
                    <TableHead>Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id} className="hover:bg-muted/50">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
                            <span className="text-white font-semibold">
                              {user.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-semibold">{user.name}</p>
                            <p className="text-sm text-muted-foreground">ID: {user.id.slice(0, 8)}...</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{user.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getRoleBadgeVariant(user.role)} className="flex items-center gap-1 w-fit">
                          {getRoleIcon(user.role)}
                          {getRoleLabel(user.role)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">
                            {new Date(user.createdAt).toLocaleDateString('ru-RU')}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-muted-foreground">Документы:</span>
                            <Badge variant="outline" className="text-xs">
                              {user.documentsCount}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-muted-foreground">Анализы:</span>
                            <Badge variant="outline" className="text-xs">
                              {user.analysesCount}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-muted-foreground">Напоминания:</span>
                            <Badge variant="outline" className="text-xs">
                              {user.remindersCount}
                            </Badge>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedUser(user)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditUser(user)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => setDeleteUser(user)}
                            disabled={user.id === currentUser?.id}
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

        {/* Messages */}
        {message && (
          <Alert className={`mb-6 ${message.type === 'error' ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}>
            {message.type === 'error' ? (
              <AlertCircle className="h-4 w-4 text-red-600" />
            ) : (
              <CheckCircle className="h-4 w-4 text-green-600" />
            )}
            <AlertDescription className={message.type === 'error' ? 'text-red-800' : 'text-green-800'}>
              {message.text}
            </AlertDescription>
          </Alert>
        )}

        {/* Edit User Modal */}
        {editingUser && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md glass-effect border-0 shadow-medical-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl">Редактировать пользователя</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingUser(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="edit-name">Имя</Label>
                    <Input
                      id="edit-name"
                      value={editingUser.name}
                      onChange={(e) => setEditingUser({...editingUser, name: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-email">Email</Label>
                    <Input
                      id="edit-email"
                      type="email"
                      value={editingUser.email}
                      onChange={(e) => setEditingUser({...editingUser, email: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-role">Роль</Label>
                    <Select
                      value={editingUser.role}
                      onValueChange={(value) => setEditingUser({...editingUser, role: value as 'PATIENT' | 'DOCTOR' | 'ADMIN'})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PATIENT">Пациент</SelectItem>
                        <SelectItem value="DOCTOR">Врач</SelectItem>
                        <SelectItem value="ADMIN">Администратор</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="edit-password">Новый пароль (оставьте пустым, чтобы не изменять)</Label>
                    <Input
                      id="edit-password"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Введите новый пароль"
                    />
                  </div>
                  <div className="flex gap-2 pt-4">
                    <Button
                      onClick={() => handleSaveUser(editingUser)}
                      disabled={saving}
                      className="flex-1"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Сохранение...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Сохранить
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setEditingUser(null)}
                    >
                      Отмена
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteUser && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md glass-effect border-0 shadow-medical-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl text-red-600">Подтверждение удаления</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteUser(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-muted-foreground">
                    Вы уверены, что хотите удалить пользователя <strong>{deleteUser.name}</strong>?
                  </p>
                  <p className="text-sm text-red-600">
                    Это действие нельзя отменить. Все данные пользователя будут удалены.
                  </p>
                  <div className="flex gap-2 pt-4">
                    <Button
                      variant="destructive"
                      onClick={() => handleDeleteUser(deleteUser)}
                      disabled={deleting}
                      className="flex-1"
                    >
                      {deleting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Удаление...
                        </>
                      ) : (
                        <>
                          <Trash2 className="h-4 w-4 mr-2" />
                          Удалить
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setDeleteUser(null)}
                    >
                      Отмена
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* User Details Modal */}
        {selectedUser && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-2xl glass-effect border-0 shadow-medical-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl">Детали пользователя</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedUser(null)}
                  >
                    ✕
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
                      <span className="text-white text-xl font-semibold">
                        {selectedUser.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold">{selectedUser.name}</h3>
                      <p className="text-muted-foreground">{selectedUser.email}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 rounded-xl bg-gradient-to-r from-blue-50 to-green-50 border border-blue-100">
                      <p className="text-2xl font-bold text-primary">{selectedUser.documentsCount}</p>
                      <p className="text-sm text-muted-foreground">Документы</p>
                    </div>
                    <div className="text-center p-4 rounded-xl bg-gradient-to-r from-blue-50 to-green-50 border border-blue-100">
                      <p className="text-2xl font-bold text-primary">{selectedUser.analysesCount}</p>
                      <p className="text-sm text-muted-foreground">Анализы</p>
                    </div>
                    <div className="text-center p-4 rounded-xl bg-gradient-to-r from-blue-50 to-green-50 border border-blue-100">
                      <p className="text-2xl font-bold text-primary">{selectedUser.remindersCount}</p>
                      <p className="text-sm text-muted-foreground">Напоминания</p>
                    </div>
                    <div className="text-center p-4 rounded-xl bg-gradient-to-r from-blue-50 to-green-50 border border-blue-100">
                      <p className="text-2xl font-bold text-primary">{selectedUser.recommendationsCount}</p>
                      <p className="text-sm text-muted-foreground">Рекомендации</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      <strong>ID:</strong> {selectedUser.id}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <strong>Дата регистрации:</strong> {new Date(selectedUser.createdAt).toLocaleString('ru-RU')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Create User Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md mx-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  Создать пользователя
                </CardTitle>
                <CardDescription>
                  Заполните данные для создания нового пользователя
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="create-name">Имя</Label>
                  <Input
                    id="create-name"
                    placeholder="Введите имя"
                    value={newUser.name}
                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="create-email">Email</Label>
                  <Input
                    id="create-email"
                    type="email"
                    placeholder="Введите email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="create-password">Пароль</Label>
                  <Input
                    id="create-password"
                    type="password"
                    placeholder="Введите пароль (минимум 6 символов)"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="create-role">Роль</Label>
                  <Select value={newUser.role} onValueChange={(value: 'PATIENT' | 'DOCTOR' | 'ADMIN') => setNewUser({ ...newUser, role: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите роль" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PATIENT">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          Пациент
                        </div>
                      </SelectItem>
                      <SelectItem value="DOCTOR">
                        <div className="flex items-center gap-2">
                          <Stethoscope className="h-4 w-4" />
                          Врач
                        </div>
                      </SelectItem>
                      <SelectItem value="ADMIN">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4" />
                          Администратор
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={handleCreateUser}
                    disabled={creating}
                    className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 hover:opacity-90"
                  >
                    {creating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Создание...
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-4 w-4 mr-2" />
                        Создать
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowCreateModal(false)
                      setNewUser({ name: '', email: '', password: '', role: 'PATIENT' })
                    }}
                    disabled={creating}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  )
}
