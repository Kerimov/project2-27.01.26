import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { getAnalysis, type AnalysisDetail } from '../../api/analyses';
import { useAppTheme } from '@/design/tokens';
import { AppScreen } from '@/components/ui/AppScreen';
import { AppSection } from '@/components/ui/AppSection';
import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { AppChip } from '@/components/ui/AppChip';

export default function AnalysisDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useAppTheme();

  const [item, setItem] = useState<AnalysisDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getAnalysis(String(id));
        if (mounted) setItem(data);
      } catch (e: any) {
        if (mounted) setError(e?.message || 'Не удалось загрузить анализ');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id]);

  // ВСЕ хуки должны быть вызваны ДО любых условных возвратов
  // Извлекаем показатели из results (может быть массив indicators или сам results)
  const indicators = useMemo(() => {
    if (!item) return [];
    
    try {
      // results может быть объектом с полем indicators или массивом
      const results = item.results;
      if (!results) return [];
      
      if (Array.isArray(results)) {
        // Если results - массив, проверяем, есть ли поле indicators
        if (results.length > 0 && typeof results[0] === 'object' && 'indicators' in results[0]) {
          return results[0].indicators || [];
        }
        // Иначе это уже массив показателей
        return results;
      }
      
      // Если results - объект
      if (typeof results === 'object' && 'indicators' in results) {
        return Array.isArray(results.indicators) ? results.indicators : [];
      }
      
      return [];
    } catch (e) {
      console.error('Error parsing indicators:', e);
      return [];
    }
  }, [item]);

  if (!id) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: theme.colors.background }}>
        <AppText variant="body" color="danger" style={{ textAlign: 'center' }}>
          Некорректный идентификатор анализа
        </AppText>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: theme.colors.background }}>
        <ActivityIndicator />
        <AppText variant="caption" color="mutedText" style={{ marginTop: theme.spacing.sm }}>
          Загружаем анализ…
        </AppText>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: theme.colors.background }}>
        <AppText variant="body" color="danger" style={{ textAlign: 'center' }}>
          {error}
        </AppText>
      </View>
    );
  }

  if (!item) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: theme.colors.background }}>
        <AppText variant="body" color="mutedText">
          Анализ не найден.
        </AppText>
      </View>
    );
  }

  return (
    <AppScreen>
      <AppSection
        title={item.title}
        subtitle={`${new Date(item.date).toLocaleDateString('ru-RU')} · ${item.type || 'Без типа'}`}
      >
        <View style={{ gap: theme.spacing.lg }}>
          <AppCard>
            <View style={{ gap: 6 }}>
              {item.laboratory ? (
                <AppText variant="caption" color="mutedText">
                  Лаборатория: {item.laboratory}
                </AppText>
              ) : null}
              {item.doctor ? (
                <AppText variant="caption" color="mutedText">
                  Врач: {item.doctor}
                </AppText>
              ) : null}
              {item.status ? (
                <AppText variant="caption" color="primary">
                  Статус: {item.status}
                </AppText>
              ) : null}
              {item.normalRange ? (
                <AppText variant="caption" color="mutedText">
                  Нормальный диапазон: {item.normalRange}
                </AppText>
              ) : null}
            </View>
          </AppCard>

          <AppSection title="Показатели" subtitle={indicators.length > 0 ? `${indicators.length} показателей` : undefined}>
            {indicators.length > 0 ? (
              <View style={{ gap: theme.spacing.sm }}>
                {indicators.map((ind: any, idx: number) => {
                  const value = `${ind.value || ''}${ind.unit ? ` ${ind.unit}` : ''}`;
                  const ref =
                    ind.referenceMin !== undefined && ind.referenceMax !== undefined
                      ? `${ind.referenceMin} - ${ind.referenceMax}${ind.unit ? ` ${ind.unit}` : ''}`
                      : ind.reference || null;
                  const isAbnormal = ind.isNormal === false || ind.flag === 'high' || ind.flag === 'low';
                  
                  return (
                    <AppCard
                      key={idx}
                      style={{
                        gap: 6,
                        borderLeftWidth: isAbnormal ? 4 : 0,
                        borderLeftColor: isAbnormal ? theme.colors.danger : 'transparent',
                        backgroundColor: isAbnormal ? theme.colors.danger + '10' : undefined,
                      }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                        <View style={{ flex: 1 }}>
                          <AppText variant="bodyStrong" color={isAbnormal ? 'danger' : undefined}>
                            {ind.name || `Показатель ${idx + 1}`}
                          </AppText>
                          <AppText variant="body" color={isAbnormal ? 'danger' : undefined} style={{ marginTop: 2 }}>
                            {value}
                          </AppText>
                        </View>
                        {isAbnormal !== undefined ? (
                          <AppChip
                            label={isAbnormal ? 'Отклонение' : 'Норма'}
                            tone={isAbnormal ? 'neutral' : 'primary'}
                          />
                        ) : null}
                      </View>
                      {ref ? (
                        <AppText variant="caption" color="mutedText" style={{ marginTop: 4 }}>
                          Референс: {ref}
                        </AppText>
                      ) : null}
                      {ind.flag && ind.flag !== 'normal' ? (
                        <AppText variant="caption" color="danger" style={{ marginTop: 4 }}>
                          {ind.flag === 'high' ? '↑ Повышен' : ind.flag === 'low' ? '↓ Понижен' : `Флаг: ${ind.flag}`}
                        </AppText>
                      ) : null}
                    </AppCard>
                  );
                })}
              </View>
            ) : (
              <AppCard>
                <AppText variant="caption" color="mutedText">
                  Нет структурированных показателей.
                </AppText>
              </AppCard>
            )}
          </AppSection>

          {item.notes ? (
            <AppSection title="Заметки">
              <AppCard>
                <AppText variant="body">{item.notes}</AppText>
              </AppCard>
            </AppSection>
          ) : null}
        </View>
      </AppSection>
    </AppScreen>
  );
}
