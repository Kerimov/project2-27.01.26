import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter } from 'expo-router';

import { getDoctorDay, getDoctorStats } from '../../api/doctor';
import { useAuthStore } from '../../state/authStore';
import { useAppTheme } from '@/design/tokens';
import { AppScreen } from '@/components/ui/AppScreen';
import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { AppButton } from '@/components/ui/AppButton';
import { AppSection } from '@/components/ui/AppSection';

export default function DoctorHomeScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { logout, user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [todayCount, setTodayCount] = useState(0);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [day, st] = await Promise.all([getDoctorDay(), getDoctorStats()]);
      const today = Array.isArray((day as any).today) ? (day as any).today : [];
      setTodayCount(today.length);
      setStats(st || {});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <AppScreen>
      <AppSection title="Кабинет врача" subtitle={user?.name || user?.email || ''}>
        <View style={{ gap: theme.spacing.md }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            <AppCard style={{ flex: 1, minWidth: '40%', alignItems: 'center', padding: 16 }}>
              <AppText variant="title" style={{ color: theme.colors.primary }}>
                {todayCount}
              </AppText>
              <AppText variant="caption" color="mutedText">
                Сегодня
              </AppText>
            </AppCard>
            <AppCard style={{ flex: 1, minWidth: '40%', alignItems: 'center', padding: 16 }}>
              <AppText variant="title" style={{ color: theme.colors.primary }}>
                {stats.pendingAppointments ?? 0}
              </AppText>
              <AppText variant="caption" color="mutedText">
                Ожидают
              </AppText>
            </AppCard>
          </View>

          <AppButton title="Записи на приём" onPress={() => router.push('/doctor/appointments' as any)} fullWidth />
          <AppButton title="Пациенты" variant="secondary" onPress={() => router.push('/doctor/patients' as any)} fullWidth />
          <AppButton
            title="Выйти"
            variant="danger"
            onPress={async () => {
              await logout();
              router.replace('/' as any);
            }}
            fullWidth
          />
        </View>
      </AppSection>
    </AppScreen>
  );
}
