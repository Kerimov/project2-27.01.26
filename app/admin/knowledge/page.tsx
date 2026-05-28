'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { BookOpen, Stethoscope, FileText, BarChart3, Plus, Edit, Trash2, Search } from 'lucide-react';

interface StudyType {
  id: string;
  name: string;
  category: string;
  description?: string;
  indicators: Indicator[];
}

interface Indicator {
  id: string;
  name: string;
  shortName?: string;
  unit: string;
  description?: string;
  referenceRanges: ReferenceRange[];
}

interface Methodology {
  id: string;
  name: string;
  type: string;
  organization?: string;
}

interface ReferenceRange {
  id: string;
  methodology: Methodology;
  gender?: string;
  ageGroupMin?: number;
  ageGroupMax?: number;
  minValue?: number;
  maxValue?: number;
}

export default function KnowledgeBasePage() {
  const { user, token, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'study-types' | 'indicators' | 'methodologies' | 'ranges'>('study-types');
  const [studyTypes, setStudyTypes] = useState<StudyType[]>([]);
  const [methodologies, setMethodologies] = useState<Methodology[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  // Формы для создания/редактирования
  const [studyTypeForm, setStudyTypeForm] = useState({
    name: '',
    nameEn: '',
    category: '',
    description: '',
    clinicalSignificance: '',
    preparation: '',
    biomaterial: ''
  });

  const [methodologyForm, setMethodologyForm] = useState({
    name: '',
    type: 'MINZDRAV_RF',
    description: '',
    organization: '',
    country: '',
    version: '',
    source: ''
  });

  useEffect(() => {
    // Проверяем токен в localStorage
    const hasToken = typeof window !== 'undefined' && localStorage.getItem('token');
    
    // Перенаправляем только если загрузка завершена, нет токена и (нет пользователя или он не админ)
    if (!authLoading && !hasToken && (!user || user.role !== 'ADMIN')) {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      if (activeTab === 'study-types') {
        const response = await fetch('/api/knowledge/study-types', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setStudyTypes(data);
        }
      } else if (activeTab === 'methodologies') {
        const response = await fetch('/api/knowledge/methodologies', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setMethodologies(data);
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, token]);

  useEffect(() => {
    if (token) {
      fetchData();
    }
  }, [token, fetchData]);

  const handleCreateStudyType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    try {
      const response = await fetch('/api/knowledge/study-types', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(studyTypeForm)
      });

      if (response.ok) {
        alert('Тип исследования успешно создан');
        setShowForm(false);
        setStudyTypeForm({
          name: '',
          nameEn: '',
          category: '',
          description: '',
          clinicalSignificance: '',
          preparation: '',
          biomaterial: ''
        });
        fetchData();
      } else {
        const error = await response.json();
        alert(`Ошибка: ${error.error}`);
      }
    } catch (error) {
      console.error('Error creating study type:', error);
      alert('Произошла ошибка при создании');
    }
  };

  const handleCreateMethodology = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    try {
      const response = await fetch('/api/knowledge/methodologies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(methodologyForm)
      });

      if (response.ok) {
        alert('Методология успешно создана');
        setShowForm(false);
        setMethodologyForm({
          name: '',
          type: 'MINZDRAV_RF',
          description: '',
          organization: '',
          country: '',
          version: '',
          source: ''
        });
        fetchData();
      } else {
        const error = await response.json();
        alert(`Ошибка: ${error.error}`);
      }
    } catch (error) {
      console.error('Error creating methodology:', error);
      alert('Произошла ошибка при создании');
    }
  };

  const handleDelete = async (id: string, type: 'study-types' | 'methodologies') => {
    if (!token || !confirm('Вы уверены, что хотите удалить этот элемент?')) return;

    try {
      const response = await fetch(`/api/knowledge/${type}/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        alert('Успешно удалено');
        fetchData();
      } else {
        const error = await response.json();
        alert(`Ошибка: ${error.error}`);
      }
    } catch (error) {
      console.error('Error deleting:', error);
      alert('Произошла ошибка при удалении');
    }
  };

  if (authLoading) {
    return (
      <div className="web-page flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'ADMIN') {
    return null; // Перенаправление произойдет через useEffect
  }

  const filteredStudyTypes = studyTypes.filter(st =>
    st.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    st.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredMethodologies = methodologies.filter(m =>
    m.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="web-page">
      <main className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
              <BookOpen className="w-8 h-8" />
              База знаний
            </h1>
            <p className="text-muted-foreground mt-2">Управление медицинскими справочниками и нормативами</p>
          </div>
        </div>

        {/* Табы */}
        <div className="flex gap-4 border-b">
          <button
            className={`px-4 py-2 font-medium ${activeTab === 'study-types' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-muted-foreground'}`}
            onClick={() => setActiveTab('study-types')}
          >
            <Stethoscope className="w-4 h-4 inline mr-2" />
            Типы исследований
          </button>
          <button
            className={`px-4 py-2 font-medium ${activeTab === 'methodologies' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-muted-foreground'}`}
            onClick={() => setActiveTab('methodologies')}
          >
            <FileText className="w-4 h-4 inline mr-2" />
            Методологии
          </button>
        </div>

        {/* Поиск и добавление */}
        <div className="flex gap-4">
          <div className="web-search-field flex-1">
            <Search className="web-search-icon h-5 w-5" />
            <Input
              type="text"
              placeholder="Поиск..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="web-search-input"
            />
          </div>
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="w-4 h-4 mr-2" />
            Добавить
          </Button>
        </div>

        {/* Формы создания */}
        {showForm && activeTab === 'study-types' && (
          <Card>
            <CardHeader>
              <CardTitle>Добавить тип исследования</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateStudyType} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Название *</Label>
                    <Input
                      required
                      value={studyTypeForm.name}
                      onChange={(e) => setStudyTypeForm({ ...studyTypeForm, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Английское название</Label>
                    <Input
                      value={studyTypeForm.nameEn}
                      onChange={(e) => setStudyTypeForm({ ...studyTypeForm, nameEn: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Категория *</Label>
                    <Input
                      required
                      value={studyTypeForm.category}
                      onChange={(e) => setStudyTypeForm({ ...studyTypeForm, category: e.target.value })}
                      placeholder="Например: Гематология, Биохимия"
                    />
                  </div>
                  <div>
                    <Label>Биоматериал</Label>
                    <Input
                      value={studyTypeForm.biomaterial}
                      onChange={(e) => setStudyTypeForm({ ...studyTypeForm, biomaterial: e.target.value })}
                      placeholder="Например: Кровь, Моча"
                    />
                  </div>
                </div>
                <div>
                  <Label>Описание</Label>
                  <Textarea
                    value={studyTypeForm.description}
                    onChange={(e) => setStudyTypeForm({ ...studyTypeForm, description: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Клиническое значение</Label>
                  <Textarea
                    value={studyTypeForm.clinicalSignificance}
                    onChange={(e) => setStudyTypeForm({ ...studyTypeForm, clinicalSignificance: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Подготовка к исследованию</Label>
                  <Textarea
                    value={studyTypeForm.preparation}
                    onChange={(e) => setStudyTypeForm({ ...studyTypeForm, preparation: e.target.value })}
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit">Создать</Button>
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                    Отмена
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {showForm && activeTab === 'methodologies' && (
          <Card>
            <CardHeader>
              <CardTitle>Добавить методологию</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateMethodology} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Название *</Label>
                    <Input
                      required
                      value={methodologyForm.name}
                      onChange={(e) => setMethodologyForm({ ...methodologyForm, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Тип *</Label>
                    <select
                      className="w-full p-2 border rounded"
                      value={methodologyForm.type}
                      onChange={(e) => setMethodologyForm({ ...methodologyForm, type: e.target.value })}
                    >
                      <option value="MINZDRAV_RF">Минздрав РФ</option>
                      <option value="US_STANDARDS">Американские стандарты</option>
                      <option value="EU_STANDARDS">Европейские стандарты</option>
                      <option value="WHO">ВОЗ</option>
                      <option value="OTHER">Другое</option>
                    </select>
                  </div>
                  <div>
                    <Label>Организация</Label>
                    <Input
                      value={methodologyForm.organization}
                      onChange={(e) => setMethodologyForm({ ...methodologyForm, organization: e.target.value })}
                      placeholder="Например: CDC, NIH, ESC"
                    />
                  </div>
                  <div>
                    <Label>Страна</Label>
                    <Input
                      value={methodologyForm.country}
                      onChange={(e) => setMethodologyForm({ ...methodologyForm, country: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Версия</Label>
                    <Input
                      value={methodologyForm.version}
                      onChange={(e) => setMethodologyForm({ ...methodologyForm, version: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Источник/Ссылка</Label>
                    <Input
                      value={methodologyForm.source}
                      onChange={(e) => setMethodologyForm({ ...methodologyForm, source: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label>Описание</Label>
                  <Textarea
                    value={methodologyForm.description}
                    onChange={(e) => setMethodologyForm({ ...methodologyForm, description: e.target.value })}
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit">Создать</Button>
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                    Отмена
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Списки данных */}
        {activeTab === 'study-types' && (
          <div className="grid gap-4">
            {authLoading ? (
              <p>Загрузка...</p>
            ) : filteredStudyTypes.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8 text-muted-foreground">
                  Типы исследований не найдены. Создайте первый!
                </CardContent>
              </Card>
            ) : (
              filteredStudyTypes.map((studyType) => (
                <Card key={studyType.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle>{studyType.name}</CardTitle>
                        <CardDescription>
                          Категория: {studyType.category} • Показателей: {studyType.indicators?.length || 0}
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => router.push(`/admin/knowledge/study-types/${studyType.id}`)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(studyType.id, 'study-types')}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  {studyType.description && (
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{studyType.description}</p>
                    </CardContent>
                  )}
                </Card>
              ))
            )}
          </div>
        )}

        {activeTab === 'methodologies' && (
          <div className="grid gap-4">
            {authLoading ? (
              <p>Загрузка...</p>
            ) : filteredMethodologies.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8 text-muted-foreground">
                  Методологии не найдены. Создайте первую!
                </CardContent>
              </Card>
            ) : (
              filteredMethodologies.map((methodology) => (
                <Card key={methodology.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle>{methodology.name}</CardTitle>
                        <CardDescription>
                          Тип: {methodology.type} {methodology.organization && `• ${methodology.organization}`}
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => router.push(`/admin/knowledge/methodologies/${methodology.id}`)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(methodology.id, 'methodologies')}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}
