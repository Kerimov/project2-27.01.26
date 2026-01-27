import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { getAnalysis, type AnalysisDetail } from '../../api/analyses';
import { useAppTheme } from '@/design/tokens';
import { AppScreen } from '@/components/ui/AppScreen';
import { AppSection } from '@/components/ui/AppSection';
import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';

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

          <AppSection title="Показатели">
            <AppCard padded={false} style={{ padding: theme.spacing.lg }}>
              {Array.isArray(item.results) && item.results.length ? (
                <View style={{ gap: theme.spacing.md }}>
                  {item.results.map((r, idx) => (
                    <View key={idx} style={{ paddingBottom: theme.spacing.md, borderBottomWidth: idx === item.results.length - 1 ? 0 : 1, borderColor: theme.colors.border }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                        <AppText variant="bodyStrong" style={{ flex: 1 }}>
                          {r.name}
                        </AppText>
                        <AppText variant="bodyStrong">
                          {r.value} {r.unit || ''}
                        </AppText>
                      </View>
                      {r.reference ? (
                        <AppText variant="caption" color="mutedText" style={{ marginTop: 4 }}>
                          Референс: {r.reference}
                        </AppText>
                      ) : null}
                      {r.flag ? (
                        <AppText variant="caption" color="danger" style={{ marginTop: 4 }}>
                          Флаг: {r.flag}
                        </AppText>
                      ) : null}
                    </View>
                  ))}
                </View>
              ) : (
                <AppText variant="caption" color="mutedText">
                  Нет структурированных показателей.
                </AppText>
              )}
            </AppCard>
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
