import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  View,
} from 'react-native';
import {
  getCompanies,
  getCities,
  mergeMarketplaceCompanies,
  type MarketplaceCompany,
} from '../../api/marketplace';
import { useAppTheme } from '@/design/tokens';
import { AppScreen } from '@/components/ui/AppScreen';
import { AppText } from '@/components/ui/AppText';
import { AppInput } from '@/components/ui/AppInput';
import { AppChip } from '@/components/ui/AppChip';
import { MarketplaceAISearch } from '../../components/MarketplaceAISearch';
import { MarketplaceCompanyCard } from '../../components/MarketplaceCompanyCard';

export default function MarketplaceScreen() {
  const theme = useAppTheme();
  const [companies, setCompanies] = useState<MarketplaceCompany[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [city, setCity] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
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
  }, [city, search]);

  useEffect(() => {
    getCities().then(setCities).catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 400);
    return () => clearTimeout(t);
  }, [load]);

  const header = (
    <View style={{ gap: theme.spacing.sm, paddingBottom: theme.spacing.sm }}>
      <MarketplaceAISearch
        cityHint={city || undefined}
        onResults={(found) => setCompanies((prev) => mergeMarketplaceCompanies(prev, found))}
      />
      <AppInput
        placeholder="Поиск в каталоге, на карте и в интернете…"
        value={search}
        onChangeText={setSearch}
        returnKeyType="search"
        blurOnSubmit
        onSubmitEditing={() => Keyboard.dismiss()}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <AppChip label="Все города" tone={!city ? 'primary' : 'neutral'} onPress={() => setCity('')} />
        {cities.slice(0, 8).map((c) => (
          <AppChip key={c} label={c} tone={city === c ? 'primary' : 'neutral'} onPress={() => setCity(c)} />
        ))}
      </View>
      {error ? (
        <AppText color="mutedText" style={{ textAlign: 'center', padding: 8 }}>
          {error}
        </AppText>
      ) : null}
      {!loading ? (
        <AppText variant="caption" color="mutedText">
          Найдено: {companies.length}
        </AppText>
      ) : null}
    </View>
  );

  return (
    <AppScreen scroll={false} style={{ flex: 1 }} contentContainerStyle={{ flex: 1, paddingBottom: 0 }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        {loading && companies.length === 0 ? (
          <View style={{ flex: 1 }}>
            {header}
            <ActivityIndicator style={{ marginTop: 24 }} />
          </View>
        ) : (
          <FlatList
            style={{ flex: 1 }}
            data={companies}
            keyExtractor={(c) => c.id}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            onScrollBeginDrag={Keyboard.dismiss}
            ListHeaderComponent={header}
            contentContainerStyle={{ gap: theme.spacing.sm, paddingBottom: 120 }}
            renderItem={({ item }) => <MarketplaceCompanyCard company={item} />}
            ListEmptyComponent={
              !loading ? (
                <AppText color="mutedText" style={{ textAlign: 'center', padding: 24 }}>
                  Ничего не найдено. Укажите город или попробуйте другой запрос.
                </AppText>
              ) : null
            }
          />
        )}
      </KeyboardAvoidingView>
    </AppScreen>
  );
}
