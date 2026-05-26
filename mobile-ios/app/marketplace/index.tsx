import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Linking, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { getCompanies, getCities, type MarketplaceCompany } from '../../api/marketplace';
import { useAppTheme } from '@/design/tokens';
import { AppScreen } from '@/components/ui/AppScreen';
import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { AppInput } from '@/components/ui/AppInput';
import { AppChip } from '@/components/ui/AppChip';
import { MarketplaceAISearch } from '@/components/MarketplaceAISearch';

export default function MarketplaceScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const [companies, setCompanies] = useState<MarketplaceCompany[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [city, setCity] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getCompanies({
        city: city || undefined,
        search: search || undefined,
      });
      setCompanies(res.companies || []);
    } catch (e: unknown) {
      setCompanies([]);
      setError(e instanceof Error ? e.message : 'Не удалось загрузить клиники');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getCities().then(setCities).catch(() => {});
    load();
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 400);
    return () => clearTimeout(t);
  }, [city, search]);

  return (
    <AppScreen scroll={false} contentContainerStyle={{ flex: 1 }}>
      <MarketplaceAISearch cityHint={city || undefined} />
      <AppInput placeholder="Поиск в каталоге, на карте и в интернете…" value={search} onChangeText={setSearch} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 8 }}>
        <AppChip label="Все города" tone={!city ? 'primary' : 'neutral'} onPress={() => setCity('')} />
        {cities.slice(0, 8).map((c) => (
          <AppChip key={c} label={c} tone={city === c ? 'primary' : 'neutral'} onPress={() => setCity(c)} />
        ))}
      </View>
      {error ? (
        <AppText color="mutedText" style={{ textAlign: 'center', padding: 16 }}>
          {error}
        </AppText>
      ) : null}
      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={companies}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ gap: theme.spacing.sm, paddingBottom: 24 }}
          renderItem={({ item }) => {
            const external = item.id.startsWith('web:') || item.id.startsWith('osm:');
            const open = () => {
              const url = item.sourceUrl || item.website;
              if (external && url) {
                Linking.openURL(url).catch(() => {});
                return;
              }
              router.push(`/marketplace/${item.id}` as any);
            };
            return (
            <Pressable onPress={open}>
              <AppCard style={{ padding: theme.spacing.md }}>
                <AppText variant="h3">{item.name}</AppText>
                <AppText variant="caption" color="mutedText">
                  {item.city} · {item.type}
                  {item.source && item.source !== 'catalog'
                    ? ` · ${item.source === 'web' ? 'Интернет' : 'Карта'}`
                    : ''}
                </AppText>
                {item.rating != null ? (
                  <AppText variant="caption" style={{ marginTop: 4 }}>
                    ★ {item.rating} ({item.reviewCount})
                  </AppText>
                ) : null}
              </AppCard>
            </Pressable>
            );
          }}
          ListEmptyComponent={
            <AppText color="mutedText" style={{ textAlign: 'center', padding: 24 }}>
              Ничего не найдено
            </AppText>
          }
        />
      )}
    </AppScreen>
  );
}
