import React, { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  searchMarketplaceWithAI,
  type DiscoveredCompany,
} from '../api/marketplace';
import { useAppTheme } from '@/design/tokens';
import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { AppInput } from '@/components/ui/AppInput';
import { AppButton } from '@/components/ui/AppButton';

const SOURCE_LABEL: Record<string, string> = {
  catalog: 'Каталог',
  openstreetmap: 'Карта',
  web: 'Интернет',
};

type Props = {
  cityHint?: string;
};

export function MarketplaceAISearch({ cityHint }: Props) {
  const router = useRouter();
  const theme = useAppTheme();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState<string | null>(null);
  const [results, setResults] = useState<DiscoveredCompany[]>([]);

  const runSearch = async (text: string) => {
    const message = text.trim();
    if (!message || loading) return;
    setLoading(true);
    setError(null);
    try {
      const data = await searchMarketplaceWithAI({
        message,
        city: cityHint,
        includeWeb: true,
      });
      setReply(data.response);
      setResults(data.companies || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка AI-поиска');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const openCompany = (c: DiscoveredCompany) => {
    const external = c.id.startsWith('web:') || c.id.startsWith('osm:');
    const url = c.sourceUrl || c.website;
    if (external && url) {
      Linking.openURL(url).catch(() => {});
      return;
    }
    router.push(`/marketplace/${c.id}` as any);
  };

  return (
    <AppCard style={{ padding: theme.spacing.md, marginBottom: theme.spacing.sm }}>
      <AppText variant="h3">AI-поиск клиник</AppText>
      <AppText variant="caption" color="mutedText" style={{ marginTop: 4 }}>
        Каталог, карты и интернет{cityHint ? ` · ${cityHint}` : ''}
      </AppText>
      <AppInput
        placeholder="Напр. стоматология в Казани"
        value={query}
        onChangeText={setQuery}
        style={{ marginTop: theme.spacing.sm }}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
        <AppButton
          title="Клиники"
          variant="secondary"
          size="sm"
          disabled={loading}
          onPress={() => runSearch(cityHint ? `Клиники в ${cityHint}` : 'Клиники')}
        />
        <AppButton
          title="Лаборатории"
          variant="secondary"
          size="sm"
          disabled={loading}
          onPress={() => runSearch(cityHint ? `Лаборатории в ${cityHint}` : 'Лаборатории')}
        />
      </View>
      <AppButton
        title={loading ? 'Ищу…' : 'Найти с AI'}
        style={{ marginTop: theme.spacing.sm }}
        disabled={loading || !query.trim()}
        onPress={() => runSearch(query)}
      />
      {loading ? <ActivityIndicator style={{ marginTop: 12 }} /> : null}
      {error ? (
        <AppText color="mutedText" style={{ marginTop: 8 }}>
          {error}
        </AppText>
      ) : null}
      {reply ? (
        <AppText style={{ marginTop: theme.spacing.sm }}>{reply}</AppText>
      ) : null}
      {results.length > 0 ? (
        <View style={{ marginTop: theme.spacing.sm, gap: theme.spacing.xs }}>
          {results.slice(0, 8).map((c) => (
            <Pressable key={c.id} onPress={() => openCompany(c)}>
              <View
                style={{
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radius.md,
                  padding: theme.spacing.sm,
                }}
              >
                <AppText variant="h3">{c.name}</AppText>
                <AppText variant="caption" color="mutedText">
                  {SOURCE_LABEL[c.source] || c.source}
                  {c.city ? ` · ${c.city}` : ''}
                </AppText>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
    </AppCard>
  );
}
