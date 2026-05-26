import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, View } from 'react-native';
import { useRouter } from 'expo-router';

import { getAnalyses, deleteAnalysis, type AnalysisSummary } from '../../api/analyses';
import { useAppTheme } from '@/design/tokens';
import { useContentPadding } from '@/design/responsive';
import { useFloatingTabBarInsets } from '@/design/tab-bar';
import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { AppButton } from '@/components/ui/AppButton';
import { AppFAB } from '@/components/ui/AppFAB';
import { AppScreen } from '@/components/ui/AppScreen';
import { AppSection } from '@/components/ui/AppSection';
import { AppStatusBadge } from '@/components/ui/AppStatusBadge';
import { AppEmptyState } from '@/components/ui/AppEmptyState';
import { IconSymbol } from '@/components/ui/icon-symbol';

export default function AnalysesScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const pad = useContentPadding();
  const { listPaddingBottom } = useFloatingTabBarInsets();

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

  const renderItem = ({ item }: { item: AnalysisSummary }) => {
    const tone = item.status === 'critical' ? 'danger' : item.status === 'abnormal' ? 'warning' : 'success';
    const label =
      item.status === 'normal'
        ? 'Норма'
        : item.status === 'abnormal'
          ? 'Отклонение'
          : item.status === 'critical'
            ? 'Критично'
            : item.status || 'AI-анализ';

    return (
      <AppCard variant="interactive" style={{ gap: theme.spacing.md }}>
        <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: theme.radius.pill,
              backgroundColor: tone === 'success' ? theme.colors.successSoft : tone === 'warning' ? theme.colors.warningSoft : theme.colors.dangerSoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <IconSymbol name="waveform.path.ecg" size={22} color={theme.colors[tone]} />
          </View>
          <View style={{ flex: 1, gap: theme.spacing.xs }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: theme.spacing.sm }}>
              <AppText variant="h3" style={{ flex: 1 }}>
                {item.title}
              </AppText>
              <AppStatusBadge label={label} tone={tone} />
            </View>
            <AppText variant="caption" color="mutedText">
              {new Date(item.date).toLocaleDateString('ru-RU')} · {item.type || 'Без типа'}
            </AppText>
            {item.laboratory ? (
              <AppText variant="caption" color="mutedText">
                {item.laboratory}
              </AppText>
            ) : null}
          </View>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <AppButton
            title="AI-разбор"
            icon="sparkles"
            variant="ai"
            size="sm"
            onPress={() => router.push(`/analysis/${item.id}` as any)}
          />
          <AppButton
            title="Сравнить"
            icon="chart.bar.fill"
            variant="secondary"
            size="sm"
            onPress={() => router.push('/analyses/compare' as any)}
          />
          <AppButton title="Удалить" variant="ghost" size="sm" onPress={() => handleDelete(item)} />
        </View>
      </AppCard>
    );
  };

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
          paddingBottom: listPaddingBottom,
        }}
        ListHeaderComponent={
          <View style={{ marginBottom: theme.spacing.sm }}>
            <AppSection title="Анализы" subtitle="Понятная интерпретация, динамика и отклонения">
              <AppCard variant="hero">
                <View style={{ gap: theme.spacing.sm }}>
                  <AppStatusBadge label={`${items.length} записей`} tone="ai" />
                  <AppText variant="h2">Ваши лабораторные показатели</AppText>
                  <AppText variant="caption" color="mutedText">
                    Откройте анализ, чтобы увидеть пояснения, отклонения и рекомендации простым языком.
                  </AppText>
                  <AppButton
                    title="Сравнить анализы"
                    icon="chart.bar.fill"
                    variant="secondary"
                    size="sm"
                    onPress={() => router.push('/analyses/compare' as any)}
                  />
                </View>
              </AppCard>
            </AppSection>
          </View>
        }
        renderItem={renderItem}
        refreshing={loading}
        onRefresh={loadAnalyses}
        ListEmptyComponent={
          <AppEmptyState
            title="Анализы пока не добавлены"
            subtitle="Добавьте анализ вручную или загрузите PDF/фото в документы, чтобы помощник извлёк показатели."
            icon="waveform.path.ecg"
            actionTitle="Добавить анализ"
            onAction={() => router.push('/analyses/create' as any)}
          />
        }
      />
      <AppFAB icon="plus" onPress={() => router.push('/analyses/create' as any)} />
    </AppScreen>
  );
}
