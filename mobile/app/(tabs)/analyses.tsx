import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, View } from 'react-native';
import { useRouter } from 'expo-router';

import { getAnalyses, deleteAnalysis, type AnalysisSummary } from '../../api/analyses';
import { AppChip } from '@/components/ui/AppChip';
import { useAppTheme } from '@/design/tokens';
import { useContentPadding, useMaxContentWidth } from '@/design/responsive';
import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { AppButton } from '@/components/ui/AppButton';
import { AppFAB } from '@/components/ui/AppFAB';
import { AppScreen } from '@/components/ui/AppScreen';

export default function AnalysesScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const pad = useContentPadding();
  const { maxWidth } = useMaxContentWidth();

  const [items, setItems] = useState<AnalysisSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAnalyses = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAnalyses();
      setItems(data);
    } catch (e: any) {
      setError(e?.message || 'Не удалось загрузить анализы');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAnalyses();
  }, [loadAnalyses]);

  const handleDelete = (item: AnalysisSummary) => {
    Alert.alert('Удалить анализ', `Удалить «${item.title}»? Действие необратимо.`, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteAnalysis(item.id);
            await loadAnalyses();
          } catch (e: any) {
            Alert.alert('Ошибка', e?.message || 'Не удалось удалить анализ');
          }
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: AnalysisSummary }) => (
    <AppCard style={{ gap: theme.spacing.sm }}>
      <View>
        <AppText variant="h3">{item.title}</AppText>
        <AppText variant="caption" color="mutedText" style={{ marginTop: theme.spacing.xs }}>
          {new Date(item.date).toLocaleDateString('ru-RU')} · {item.type || 'Без типа'}
        </AppText>
        {item.laboratory ? (
          <AppText variant="caption" color="mutedText" style={{ marginTop: theme.spacing.xs }}>
            {item.laboratory}
          </AppText>
        ) : null}
        {item.status ? (
          <View style={{ flexDirection: 'row', marginTop: theme.spacing.sm }}>
            <AppChip
              label={
                item.status === 'normal'
                  ? 'Норма'
                  : item.status === 'abnormal'
                    ? 'Отклонение'
                    : item.status === 'critical'
                      ? 'Критично'
                      : item.status
              }
              tone={item.status === 'normal' ? 'primary' : 'neutral'}
            />
          </View>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <AppButton
          title="Подробнее"
          variant="secondary"
          size="sm"
          onPress={() => router.push(`/analysis/${item.id}` as any)}
        />
        <AppButton title="Удалить" variant="danger" size="sm" onPress={() => handleDelete(item)} />
      </View>
    </AppCard>
  );

  if (loading) {
    return (
      <AppScreen
        scroll={false}
        contentContainerStyle={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.sm }}>
        <ActivityIndicator />
        <AppText variant="caption" color="mutedText">
          Загружаем анализы…
        </AppText>
      </AppScreen>
    );
  }

  if (error) {
    return (
      <AppScreen scroll={false} contentContainerStyle={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <AppText variant="body" color="danger" style={{ textAlign: 'center' }}>
          {error}
        </AppText>
      </AppScreen>
    );
  }

  return (
    <AppScreen scroll={false} contentContainerStyle={{ flex: 1 }}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        style={{ flex: 1 }}
        contentContainerStyle={{
          gap: theme.spacing.md,
          paddingBottom: pad.vertical + 96,
        }}
        renderItem={renderItem}
        refreshing={loading}
        onRefresh={loadAnalyses}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', padding: 24 }}>
            <AppText variant="body" color="mutedText">
              Анализы пока не найдены.
            </AppText>
            <AppButton
              title="Добавить вручную"
              style={{ marginTop: theme.spacing.md }}
              onPress={() => router.push('/analyses/create' as any)}
            />
          </View>
        }
      />
      <AppFAB icon="plus" onPress={() => router.push('/analyses/create' as any)} />
    </AppScreen>
  );
}
