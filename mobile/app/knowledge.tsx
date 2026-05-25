import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, View } from 'react-native';
import { getStudyTypes, type StudyType } from '../api/knowledge';
import { useAppTheme } from '@/design/tokens';
import { AppScreen } from '@/components/ui/AppScreen';
import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { AppInput } from '@/components/ui/AppInput';
import { AppChip } from '@/components/ui/AppChip';

export default function KnowledgeScreen() {
  const theme = useAppTheme();
  const [items, setItems] = useState<StudyType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setItems(await getStudyTypes());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.indicators?.some((i) => i.name.toLowerCase().includes(q))
    );
  }, [items, search]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <AppScreen scroll={false} contentContainerStyle={{ flex: 1 }}>
      <AppInput placeholder="Поиск…" value={search} onChangeText={setSearch} />
      <FlatList
        data={filtered}
        keyExtractor={(i) => i.id}
        style={{ flex: 1, marginTop: theme.spacing.md }}
        contentContainerStyle={{ gap: theme.spacing.sm, paddingBottom: 24 }}
        renderItem={({ item }) => (
          <Pressable onPress={() => setExpanded(expanded === item.id ? null : item.id)}>
            <AppCard style={{ padding: theme.spacing.md }}>
              <AppText variant="h3">{item.name}</AppText>
              <AppChip label={item.category} />
              {expanded === item.id ? (
                <View style={{ marginTop: theme.spacing.sm, gap: 8 }}>
                  {item.description ? (
                    <AppText variant="caption" color="mutedText">
                      {item.description}
                    </AppText>
                  ) : null}
                  {item.indicators?.slice(0, 12).map((ind) => (
                    <AppText key={ind.id} variant="caption">
                      • {ind.name} ({ind.unit})
                    </AppText>
                  ))}
                </View>
              ) : null}
            </AppCard>
          </Pressable>
        )}
      />
    </AppScreen>
  );
}
