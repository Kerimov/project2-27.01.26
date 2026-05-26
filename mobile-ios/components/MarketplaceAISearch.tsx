import React, { useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, View } from 'react-native';
import {
  searchMarketplaceWithAI,
  type DiscoveredCompany,
} from '../api/marketplace';
import { useAppTheme } from '@/design/tokens';
import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { AppInput } from '@/components/ui/AppInput';
import { AppButton } from '@/components/ui/AppButton';
import { MarketplaceCompanyCard } from './MarketplaceCompanyCard';

type Props = {
  cityHint?: string;
  onResults?: (companies: DiscoveredCompany[]) => void;
};

export function MarketplaceAISearch({ cityHint, onResults }: Props) {
  const theme = useAppTheme();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState<string | null>(null);
  const [results, setResults] = useState<DiscoveredCompany[]>([]);

  const runSearch = async (text: string) => {
    const message = text.trim();
    if (!message || loading) return;
    Keyboard.dismiss();
    setLoading(true);
    setError(null);
    try {
      const data = await searchMarketplaceWithAI({
        message,
        city: cityHint,
        includeWeb: true,
      });
      const found = data.companies || [];
      setReply(data.response);
      setResults(found);
      onResults?.(found);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка AI-поиска');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppCard style={{ padding: theme.spacing.md, marginBottom: theme.spacing.sm }}>
      <AppText variant="h3">AI-поиск клиник</AppText>
      <AppText variant="caption" color="mutedText" style={{ marginTop: 4 }}>
        Частичный поиск по названию · каталог, карты и интернет{cityHint ? ` · ${cityHint}` : ''}
      </AppText>
      <AppInput
        placeholder="Напр. стоматология, Invitro, кардиолог…"
        value={query}
        onChangeText={setQuery}
        returnKeyType="search"
        blurOnSubmit
        onSubmitEditing={() => runSearch(query)}
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
        title={loading ? 'Ищу…' : 'Найти'}
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
        <Pressable onPress={Keyboard.dismiss} style={{ marginTop: theme.spacing.sm, gap: theme.spacing.sm }}>
          <AppText variant="caption" color="mutedText">
            Найдено: {results.length}
          </AppText>
          {results.slice(0, 6).map((c) => (
            <MarketplaceCompanyCard
              key={c.id}
              company={{
                id: c.id,
                name: c.name,
                type: c.type,
                description: c.description,
                address: c.address || '',
                city: c.city || '',
                phone: c.phone,
                website: c.website,
                reviewCount: 0,
                isVerified: c.isVerified,
                source: c.source,
                sourceUrl: c.sourceUrl || c.website,
              }}
            />
          ))}
        </Pressable>
      ) : null}
    </AppCard>
  );
}
