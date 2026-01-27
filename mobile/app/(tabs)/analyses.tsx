import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';

import { getAnalyses, type AnalysisSummary } from '../../api/analyses';
import { useAppTheme } from '@/design/tokens';
import { useContentPadding, useMaxContentWidth } from '@/design/responsive';
import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { AppScreen } from '@/components/ui/AppScreen';

export default function AnalysesScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const pad = useContentPadding();
  const { maxWidth } = useMaxContentWidth();

  const [items, setItems] = useState<AnalysisSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getAnalyses();
        if (mounted) setItems(data);
      } catch (e: any) {
        if (mounted) setError(e?.message || 'Не удалось загрузить анализы');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const renderItem = ({ item }: { item: AnalysisSummary }) => (
    <Pressable onPress={() => router.push(`/analysis/${item.id}` as any)}>
      {({ pressed }) => (
        <AppCard style={{ opacity: pressed ? 0.95 : 1 }}>
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
            <AppText variant="caption" color="primary" style={{ marginTop: theme.spacing.sm }}>
              Статус: {item.status}
            </AppText>
          ) : null}
        </AppCard>
      )}
    </Pressable>
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

  if (!items.length) {
    return (
      <AppScreen scroll={false} contentContainerStyle={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <AppText variant="body" color="mutedText">
          Анализы пока не найдены.
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
          paddingBottom: pad.vertical + 80,
        }}
        renderItem={renderItem}
      />
    </AppScreen>
  );
}
