import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { getCompany, type MarketplaceCompany } from '../../api/marketplace';
import { AppScreen } from '@/components/ui/AppScreen';
import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { AppButton } from '@/components/ui/AppButton';

export default function MarketplaceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [c, setC] = useState<MarketplaceCompany | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getCompany(String(id))
      .then(setC)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading || !c) {
    return <ActivityIndicator style={{ flex: 1 }} />;
  }

  return (
    <AppScreen>
      <AppCard style={{ gap: 8, padding: 16 }}>
        <AppText variant="title">{c.name}</AppText>
        <AppText variant="body" color="mutedText">
          {c.address}, {c.city}
        </AppText>
        {c.description ? <AppText variant="body">{c.description}</AppText> : null}
        {c.phone ? <AppText variant="body">Тел: {c.phone}</AppText> : null}
        {c.website ? (
          <AppButton title="Сайт" variant="secondary" onPress={() => Linking.openURL(c.website!)} />
        ) : null}
      </AppCard>
    </AppScreen>
  );
}
