import React from 'react';
import { Linking, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';

import { type MarketplaceCompany } from '../api/marketplace';
import { useAppTheme } from '@/design/tokens';
import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { AppButton } from '@/components/ui/AppButton';
import { AppChip } from '@/components/ui/AppChip';

const SOURCE_LABEL: Record<string, string> = {
  catalog: 'Каталог',
  openstreetmap: 'Карта',
  web: 'Интернет',
};

const TYPE_LABEL: Record<string, string> = {
  CLINIC: 'Клиника',
  LABORATORY: 'Лаборатория',
  PHARMACY: 'Аптека',
  HEALTH_STORE: 'Магазин',
  FITNESS_CENTER: 'Фитнес',
  NUTRITIONIST: 'Диетолог',
  OTHER: 'Другое',
};

type Props = {
  company: MarketplaceCompany;
};

export function MarketplaceCompanyCard({ company }: Props) {
  const router = useRouter();
  const theme = useAppTheme();
  const external = company.id.startsWith('web:') || company.id.startsWith('osm:');
  const url = company.sourceUrl || company.website;

  const open = () => {
    if (external && url) {
      Linking.openURL(url).catch(() => {});
      return;
    }
    router.push(`/marketplace/${company.id}` as any);
  };

  return (
    <Pressable onPress={open}>
      <AppCard style={{ padding: theme.spacing.md, gap: theme.spacing.xs }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
          <AppText variant="h3" style={{ flex: 1 }}>
            {company.name}
          </AppText>
          {company.source && company.source !== 'catalog' ? (
            <AppChip label={SOURCE_LABEL[company.source] || company.source} tone="neutral" />
          ) : null}
        </View>

        <AppText variant="caption" color="mutedText">
          {TYPE_LABEL[company.type] || company.type}
          {company.city ? ` · ${company.city}` : ''}
        </AppText>

        {company.description ? (
          <AppText variant="body" numberOfLines={3} style={{ marginTop: 4 }}>
            {company.description}
          </AppText>
        ) : null}

        {company.address ? (
          <AppText variant="caption" color="mutedText" numberOfLines={2}>
            {company.address}
          </AppText>
        ) : null}

        {company.phone ? (
          <AppText variant="caption" style={{ marginTop: 2 }}>
            Тел: {company.phone}
          </AppText>
        ) : null}

        {company.rating != null ? (
          <AppText variant="caption" style={{ marginTop: 2 }}>
            ★ {company.rating} ({company.reviewCount})
          </AppText>
        ) : null}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: theme.spacing.sm }}>
          <AppButton
            title={external ? 'Открыть сайт' : 'Подробнее'}
            size="sm"
            variant="secondary"
            onPress={open}
          />
          {company.website ? (
            <AppButton
              title="Сайт"
              size="sm"
              variant="secondary"
              onPress={() => Linking.openURL(company.website!).catch(() => {})}
            />
          ) : null}
        </View>
      </AppCard>
    </Pressable>
  );
}
