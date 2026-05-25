'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Search, ChevronDown, ChevronRight, Info, Heart, TrendingUp } from 'lucide-react';

interface StudyType {
  id: string;
  name: string;
  nameEn?: string;
  category: string;
  description?: string;
  clinicalSignificance?: string;
  preparation?: string;
  biomaterial?: string;
  indicators: Indicator[];
}

interface Indicator {
  id: string;
  name: string;
  nameEn?: string;
  shortName?: string;
  unit: string;
  description?: string;
  clinicalSignificance?: string;
  increasedMeaning?: string;
  decreasedMeaning?: string;
  maintenanceRecommendations?: string;
  improvementRecommendations?: string;
  referenceRanges: ReferenceRange[];
}

interface ReferenceRange {
  id: string;
  methodology: {
    id: string;
    name: string;
    type: string;
    organization?: string;
  };
  gender?: string;
  ageGroupMin?: number;
  ageGroupMax?: number;
  minValue?: number;
  maxValue?: number;
  optimalMin?: number;
  optimalMax?: number;
  criticalLow?: number;
  criticalHigh?: number;
  note?: string;
}

export default function KnowledgeBasePage() {
  const { user, token, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [studyTypes, setStudyTypes] = useState<StudyType[]>([]);
  const [filteredStudyTypes, setFilteredStudyTypes] = useState<StudyType[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedStudyType, setExpandedStudyType] = useState<string | null>(null);
  const [expandedIndicator, setExpandedIndicator] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Проверяем токен в localStorage
    const hasToken = typeof window !== 'undefined' && localStorage.getItem('token');
    
    // Перенаправляем только если загрузка завершена, нет пользователя и нет токена
    if (!authLoading && !user && !hasToken) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (token) {
      fetchStudyTypes();
    }
  }, [token]);

  useEffect(() => {
    filterStudyTypes();
  }, [searchTerm, selectedCategory, studyTypes]);

  const fetchStudyTypes = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const response = await fetch('/api/knowledge/study-types', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setStudyTypes(data);
      }
    } catch (error) {
      console.error('Error fetching study types:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterStudyTypes = () => {
    let filtered = studyTypes;

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(st => st.category === selectedCategory);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(st => 
        st.name.toLowerCase().includes(term) ||
        st.nameEn?.toLowerCase().includes(term) ||
        st.category.toLowerCase().includes(term) ||
        st.indicators.some(ind => 
          ind.name.toLowerCase().includes(term) ||
          ind.shortName?.toLowerCase().includes(term)
        )
      );
    }

    setFilteredStudyTypes(filtered);
  };

  const categories = Array.from(new Set(studyTypes.map(st => st.category)));

  const getMethodologyTypeName = (type: string) => {
    const names: { [key: string]: string } = {
      'MINZDRAV_RF': 'Минздрав РФ',
      'US_STANDARDS': 'США',
      'EU_STANDARDS': 'Европа',
      'WHO': 'ВОЗ',
      'OTHER': 'Другое'
    };
    return names[type] || type;
  };

  const getGenderName = (gender?: string) => {
    if (!gender || gender === 'all') return 'Все';
    if (gender === 'male') return 'Мужчины';
    if (gender === 'female') return 'Женщины';
    return gender;
  };

  const getAgeGroup = (min?: number, max?: number) => {
    if (!min && !max) return 'Все возрасты';
    if (min && !max) return `${min}+ лет`;
    if (!min && max) return `До ${max} лет`;
    return `${min}-${max} лет`;
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

  if (!user) {
    return null; // Перенаправление произойдет через useEffect
  }

  return (
    <div className="web-page">
      <main className="container mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
            <BookOpen className="w-8 h-8 text-blue-600" />
            База знаний медицинских показателей
          </h1>
          <p className="text-muted-foreground mt-2">
            Справочник видов исследований и нормативных диапазонов по различным методологиям
          </p>
        </div>

        {/* Фильтры */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
                <Input
                  type="text"
                  placeholder="Поиск по названию исследования или показателя..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
              <Button
                size="sm"
                variant={selectedCategory === 'all' ? 'default' : 'outline'}
                onClick={() => setSelectedCategory('all')}
              >
                Все категории
              </Button>
              {categories.map(category => (
                <Button
                  key={category}
                  size="sm"
                  variant={selectedCategory === category ? 'default' : 'outline'}
                  onClick={() => setSelectedCategory(category)}
                >
                  {category}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Результаты */}
        {isLoading ? (
          <Card>
            <CardContent className="text-center py-8">
              <p>Загрузка базы знаний...</p>
            </CardContent>
          </Card>
        ) : filteredStudyTypes.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8 text-muted-foreground">
              <Info className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p>Исследования не найдены</p>
              <p className="text-sm mt-2">Попробуйте изменить параметры поиска</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredStudyTypes.map((studyType) => (
              <Card key={studyType.id}>
                <CardHeader>
                  <div
                    className="flex justify-between items-start cursor-pointer"
                    onClick={() => setExpandedStudyType(expandedStudyType === studyType.id ? null : studyType.id)}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {expandedStudyType === studyType.id ? (
                          <ChevronDown className="w-5 h-5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-muted-foreground" />
                        )}
                        <CardTitle>{studyType.name}</CardTitle>
                      </div>
                <div className="ml-7 mt-1 flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary">{studyType.category}</Badge>
                  {studyType.biomaterial && (
                    <span className="text-xs text-muted-foreground">• Биоматериал: {studyType.biomaterial}</span>
                  )}
                  <span className="text-xs text-muted-foreground">• Показателей: {studyType.indicators.length}</span>
                </div>
                    </div>
                  </div>
                </CardHeader>

                {expandedStudyType === studyType.id && (
                  <CardContent className="space-y-4 border-t pt-4">
                    {studyType.description && (
                      <div>
                        <h4 className="font-semibold text-sm text-gray-700 mb-1">Описание:</h4>
                        <p className="text-sm text-muted-foreground">{studyType.description}</p>
                      </div>
                    )}

                    {studyType.clinicalSignificance && (
                      <div>
                        <h4 className="font-semibold text-sm text-gray-700 mb-1">Клиническое значение:</h4>
                        <p className="text-sm text-muted-foreground">{studyType.clinicalSignificance}</p>
                      </div>
                    )}

                    {studyType.preparation && (
                      <div>
                        <h4 className="font-semibold text-sm text-gray-700 mb-1">Подготовка к исследованию:</h4>
                        <p className="text-sm text-muted-foreground">{studyType.preparation}</p>
                      </div>
                    )}

                    {/* Показатели */}
                    <div>
                      <h4 className="font-semibold text-gray-700 mb-3">Показатели:</h4>
                      <div className="space-y-3">
                        {studyType.indicators.map((indicator) => (
                          <div key={indicator.id} className="border rounded-lg p-4 bg-gray-50">
                            <div
                              className="flex justify-between items-start cursor-pointer"
                              onClick={() => setExpandedIndicator(expandedIndicator === indicator.id ? null : indicator.id)}
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  {expandedIndicator === indicator.id ? (
                                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                  )}
                                  <span className="font-medium">{indicator.name}</span>
                                  {indicator.shortName && (
                                    <Badge variant="outline" className="text-xs">{indicator.shortName}</Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground ml-6">Единица измерения: {indicator.unit}</p>
                              </div>
                            </div>

                            {expandedIndicator === indicator.id && (
                              <div className="mt-4 ml-6 space-y-3">
                                {indicator.description && (
                                  <div>
                                    <p className="text-sm font-medium text-gray-700">Описание:</p>
                                    <p className="text-sm text-muted-foreground mt-1">{indicator.description}</p>
                                  </div>
                                )}

                                {indicator.clinicalSignificance && (
                                  <div>
                                    <p className="text-sm font-medium text-gray-700">Клиническое значение:</p>
                                    <p className="text-sm text-muted-foreground mt-1">{indicator.clinicalSignificance}</p>
                                  </div>
                                )}

                                {indicator.increasedMeaning && (
                                  <div>
                                    <p className="text-sm font-medium text-gray-700">Повышение показателя:</p>
                                    <p className="text-sm text-muted-foreground mt-1">{indicator.increasedMeaning}</p>
                                  </div>
                                )}

                                {indicator.decreasedMeaning && (
                                  <div>
                                    <p className="text-sm font-medium text-gray-700">Понижение показателя:</p>
                                    <p className="text-sm text-muted-foreground mt-1">{indicator.decreasedMeaning}</p>
                                  </div>
                                )}

                                {/* Рекомендации */}
                                {(indicator.maintenanceRecommendations || indicator.improvementRecommendations) && (
                                  <div className="space-y-3">
                                    {indicator.maintenanceRecommendations && (
                                      <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                                        <div className="flex items-center gap-2 mb-2">
                                          <Heart className="h-5 w-5 text-green-600" />
                                          <h4 className="font-semibold text-green-800">Рекомендации для поддержания нормы</h4>
                                        </div>
                                        <div className="text-sm text-gray-700 whitespace-pre-line">
                                          {indicator.maintenanceRecommendations}
                                        </div>
                                      </div>
                                    )}

                                    {indicator.improvementRecommendations && (
                                      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                                        <div className="flex items-center gap-2 mb-2">
                                          <TrendingUp className="h-5 w-5 text-blue-600" />
                                          <h4 className="font-semibold text-blue-800">Рекомендации для улучшения показателей</h4>
                                        </div>
                                        <div className="text-sm text-gray-700 whitespace-pre-line">
                                          {indicator.improvementRecommendations}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Нормативные диапазоны */}
                                {indicator.referenceRanges.length > 0 && (
                                  <div>
                                    <p className="text-sm font-medium text-gray-700 mb-2">Нормативные диапазоны:</p>
                                    <div className="space-y-2">
                                      {indicator.referenceRanges.map((range) => (
                                        <div key={range.id} className="bg-white p-3 rounded border">
                                          <div className="flex justify-between items-start">
                                            <div>
                                              <Badge variant="secondary" className="mb-2">
                                                {getMethodologyTypeName(range.methodology.type)}
                                              </Badge>
                                              <p className="text-xs text-muted-foreground">
                                                {range.methodology.name}
                                                {range.methodology.organization && ` (${range.methodology.organization})`}
                                              </p>
                                            </div>
                                          </div>
                                          <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                                            <div>
                                              <span className="text-muted-foreground">Пол: </span>
                                              <span className="font-medium">{getGenderName(range.gender)}</span>
                                            </div>
                                            <div>
                                              <span className="text-muted-foreground">Возраст: </span>
                                              <span className="font-medium">{getAgeGroup(range.ageGroupMin, range.ageGroupMax)}</span>
                                            </div>
                                            {range.minValue !== null && range.maxValue !== null && (
                                              <div className="col-span-2">
                                                <span className="text-muted-foreground">Норма: </span>
                                                <span className="font-medium text-green-600">
                                                  {range.minValue} - {range.maxValue} {indicator.unit}
                                                </span>
                                              </div>
                                            )}
                                            {range.optimalMin !== null && range.optimalMax !== null && (
                                              <div className="col-span-2">
                                                <span className="text-muted-foreground">Оптимально: </span>
                                                <span className="font-medium text-blue-600">
                                                  {range.optimalMin} - {range.optimalMax} {indicator.unit}
                                                </span>
                                              </div>
                                            )}
                                            {range.criticalLow !== null && (
                                              <div>
                                                <span className="text-muted-foreground">Критически низкий: </span>
                                                <span className="font-medium text-red-600">{'<'} {range.criticalLow}</span>
                                              </div>
                                            )}
                                            {range.criticalHigh !== null && (
                                              <div>
                                                <span className="text-muted-foreground">Критически высокий: </span>
                                                <span className="font-medium text-red-600">{'>'} {range.criticalHigh}</span>
                                              </div>
                                            )}
                                          </div>
                                          {range.note && (
                                            <p className="mt-2 text-xs text-muted-foreground italic">{range.note}</p>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
