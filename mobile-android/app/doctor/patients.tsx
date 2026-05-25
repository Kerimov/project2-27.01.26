import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';

import { getDoctorPatients } from '../../api/doctor';
import { useAppTheme } from '@/design/tokens';
import { AppScreen } from '@/components/ui/AppScreen';
import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';

export default function DoctorPatientsScreen() {
  const theme = useAppTheme();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await getDoctorPatients();
        setItems(res.patients || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <AppScreen scroll={false} contentContainerStyle={{ flex: 1 }}>
      <FlatList
        data={items}
        keyExtractor={(item, i) => item.id || String(i)}
        contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: 24 }}
        ListEmptyComponent={
          <AppText color="mutedText" style={{ textAlign: 'center', padding: 24 }}>
            Пациентов нет
          </AppText>
        }
        renderItem={({ item }) => (
          <AppCard style={{ padding: 16, gap: 6 }}>
            <AppText variant="h3">{item.name || item.user?.name || 'Пациент'}</AppText>
            <AppText variant="caption" color="mutedText">
              {item.email || item.user?.email || ''}
            </AppText>
          </AppCard>
        )}
      />
    </AppScreen>
  );
}
