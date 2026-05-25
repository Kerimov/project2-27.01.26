import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';

import { getDoctorAppointments } from '../../api/doctor';
import { useAppTheme } from '@/design/tokens';
import { AppScreen } from '@/components/ui/AppScreen';
import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';

export default function DoctorAppointmentsScreen() {
  const theme = useAppTheme();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await getDoctorAppointments();
        setItems(res.appointments || []);
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
            Записей нет
          </AppText>
        }
        renderItem={({ item }) => (
          <AppCard style={{ padding: 16, gap: 6 }}>
            <AppText variant="h3">{item.patientName || item.patient?.name || 'Пациент'}</AppText>
            <AppText variant="caption" color="mutedText">
              {item.scheduledAt
                ? new Date(item.scheduledAt).toLocaleString('ru-RU')
                : '—'}{' '}
              · {item.status || 'scheduled'}
            </AppText>
            {item.notes ? (
              <AppText variant="caption" color="mutedText">
                {item.notes}
              </AppText>
            ) : null}
          </AppCard>
        )}
      />
    </AppScreen>
  );
}
