import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter } from 'expo-router';

import { getAnalyses } from '../../api/analyses';
import { getAppointments } from '../../api/appointments';
import { getDocuments } from '../../api/documents';
import { getAnalytics } from '../../api/analytics';
import { setAuthToken } from '../../api/client';
import { useAuthStore } from '../../state/authStore';
import { useAppTheme } from '@/design/tokens';
import { useBreakpoint } from '@/design/responsive';
import { AppScreen } from '@/components/ui/AppScreen';
import { AppSection } from '@/components/ui/AppSection';
import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { AppButton } from '@/components/ui/AppButton';
import { IconSymbol } from '@/components/ui/icon-symbol';

export default function DashboardScreen() {
  const router = useRouter();
  const { user, token } = useAuthStore();
  const theme = useAppTheme();
  const bp = useBreakpoint();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    analysesCount: 0,
    documentsCount: 0,
    upcomingAppointments: 0,
    latestAnalysis: null as any,
    upcomingAppointmentsList: [] as any[],
  });

  useEffect(() => {
    if (token) {
      setAuthToken(token);
    }
  }, [token]);

  const loadDashboard = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      setAuthToken(token);

      const [analyses, documents, appointments, analytics] = await Promise.all([
        getAnalyses().catch(() => []),
        getDocuments().catch(() => []),
        getAppointments().catch(() => []),
        getAnalytics().catch(() => ({ kpi: {}, trend: [] })),
      ]);

      const upcoming = appointments
        .filter((apt) => new Date(apt.scheduledAt) >= new Date() && apt.status !== 'cancelled')
        .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
        .slice(0, 3);

      const latestAnalysis =
        analyses.length > 0
          ? analyses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
          : null;

      setStats({
        analysesCount: analyses.length,
        documentsCount: documents.length,
        upcomingAppointments: upcoming.length,
        latestAnalysis,
        upcomingAppointmentsList: upcoming,
      });
    } catch (e: any) {
      console.error('Dashboard load error:', e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const displayFirstName = useMemo(() => {
    const fullName = user?.name?.trim() ?? '';
    if (!fullName) return '';
    const parts = fullName.split(/\s+/);
    if (parts.length >= 2) return parts[1];
    return parts[0];
  }, [user?.name]);

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    return `${date.toLocaleDateString('ru-RU')} в ${date.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  };

  if (loading) {
    return (
      <AppScreen
        scroll={false}
        contentContainerStyle={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          gap: theme.spacing.sm,
        }}>
        <ActivityIndicator />
        <AppText variant="caption" color="mutedText">
          Загружаем данные…
        </AppText>
      </AppScreen>
    );
  }

  const quickActionWidth = bp === 'phone' ? '48%' : bp === 'tablet' ? '31%' : '23%';

  return (
    <AppScreen>
      <AppSection
        title="Главная"
        subtitle={`Добро пожаловать, ${displayFirstName || user?.name || 'Пользователь'}`}
      >
        <View style={{ gap: theme.spacing.lg }}>
          {/* Статистика */}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <AppCard padded={false} style={{ flex: 1, alignItems: 'center', padding: theme.spacing.lg }}>
              <AppText variant="title" style={{ color: theme.colors.primary }}>
                {stats.analysesCount}
              </AppText>
              <AppText variant="caption" color="mutedText">
                Анализы
              </AppText>
            </AppCard>
            <AppCard padded={false} style={{ flex: 1, alignItems: 'center', padding: theme.spacing.lg }}>
              <AppText variant="title" style={{ color: theme.colors.primary }}>
                {stats.documentsCount}
              </AppText>
              <AppText variant="caption" color="mutedText">
                Документы
              </AppText>
            </AppCard>
            <AppCard padded={false} style={{ flex: 1, alignItems: 'center', padding: theme.spacing.lg }}>
              <AppText variant="title" style={{ color: theme.colors.primary }}>
                {stats.upcomingAppointments}
              </AppText>
              <AppText variant="caption" color="mutedText">
                Записи
              </AppText>
            </AppCard>
          </View>

          {/* Последний анализ */}
          {stats.latestAnalysis ? (
            <AppSection title="Последний анализ">
              <AppCard>
                <AppText variant="h3">{stats.latestAnalysis.title || 'Анализ'}</AppText>
                <AppText variant="caption" color="mutedText" style={{ marginTop: theme.spacing.xs }}>
                  {formatDate(stats.latestAnalysis.date)}
                </AppText>
                <View style={{ marginTop: theme.spacing.md }}>
                  <AppButton
                    title="Открыть"
                    onPress={() => router.push(`/analysis/${stats.latestAnalysis.id}` as any)}
                  />
                </View>
              </AppCard>
            </AppSection>
          ) : null}

          {/* Предстоящие записи */}
          {stats.upcomingAppointmentsList.length > 0 ? (
            <AppSection
              title="Предстоящие записи"
              headerRight={<AppButton title="Все" variant="ghost" size="sm" onPress={() => router.push('/appointments' as any)} />}
            >
              <View style={{ gap: theme.spacing.md }}>
                {stats.upcomingAppointmentsList.map((apt) => (
                  <AppCard key={apt.id}>
                    <AppText variant="h3">{apt.doctor.user.name}</AppText>
                    {apt.doctor.specialization ? (
                      <AppText variant="caption" color="mutedText" style={{ marginTop: theme.spacing.xs }}>
                        {apt.doctor.specialization}
                      </AppText>
                    ) : null}
                    <AppText variant="caption" color="mutedText" style={{ marginTop: theme.spacing.xs }}>
                      {formatDateTime(apt.scheduledAt)}
                    </AppText>
                    <View style={{ marginTop: theme.spacing.md }}>
                      <AppButton title="Открыть" onPress={() => router.push('/appointments' as any)} />
                    </View>
                  </AppCard>
                ))}
              </View>
            </AppSection>
          ) : null}

          {/* Быстрые действия */}
          <AppSection title="Быстрые действия" subtitle="Часто используемые разделы">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              <QuickAction
                width={quickActionWidth}
                icon="waveform.path.ecg"
                label="Анализы"
                onPress={() => router.push('/analyses' as any)}
              />
              <QuickAction
                width={quickActionWidth}
                icon="doc.text.fill"
                label="Документы"
                onPress={() => router.push('/documents' as any)}
              />
              <QuickAction
                width={quickActionWidth}
                icon="calendar"
                label="Записи"
                onPress={() => router.push('/appointments' as any)}
              />
              <QuickAction
                width={quickActionWidth}
                icon="checkmark.circle.fill"
                label="План задач"
                onPress={() => router.push('/care-plan' as any)}
              />
              <QuickAction
                width={quickActionWidth}
                icon="pills.fill"
                label="Лекарства"
                onPress={() => router.push('/medications' as any)}
              />
              <QuickAction
                width={quickActionWidth}
                icon="book.fill"
                label="Дневник"
                onPress={() => router.push('/diary' as any)}
              />
            </View>
          </AppSection>
        </View>
      </AppSection>
    </AppScreen>
  );
}

function QuickAction({
  icon,
  label,
  onPress,
  width,
}: {
  icon: Parameters<typeof IconSymbol>[0]['name'];
  label: string;
  onPress: () => void;
  width: string;
}) {
  const theme = useAppTheme();
  return (
    <AppCard
      padded={false}
      style={{
        width,
        padding: theme.spacing.lg,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: theme.colors.surface2, alignItems: 'center', justifyContent: 'center' }}>
        <IconSymbol name={icon} size={20} color={theme.colors.primary} />
      </View>
      <AppText variant="caption" color="mutedText" style={{ marginTop: theme.spacing.sm, textAlign: 'center' }}>
        {label}
      </AppText>
      <View style={{ marginTop: theme.spacing.sm, width: '100%' }}>
        <AppButton title="Открыть" size="sm" variant="secondary" onPress={onPress} />
      </View>
    </AppCard>
  );
}
