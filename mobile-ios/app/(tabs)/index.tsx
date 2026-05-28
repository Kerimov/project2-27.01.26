import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, useWindowDimensions, View } from 'react-native';
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
import { AppMetricCard } from '@/components/ui/AppMetricCard';
import { AppStatusBadge } from '@/components/ui/AppStatusBadge';
import { AppListItem } from '@/components/ui/AppListItem';
import { IconSymbol } from '@/components/ui/icon-symbol';

export default function DashboardScreen() {
  const router = useRouter();
  const { user, token } = useAuthStore();
  const theme = useAppTheme();
  const bp = useBreakpoint();
  const { width: screenWidth } = useWindowDimensions();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    analysesCount: 0,
    documentsCount: 0,
    upcomingAppointments: 0,
    avgSleep: null as number | null,
    latestAnalysis: null as any,
    upcomingAppointmentsList: [] as any[],
    diaryTrend: [] as { day: string; sleep?: number }[],
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
      const kpi = (analytics?.kpi || {}) as any;

      const upcoming = appointments
        .filter((apt) => new Date(apt.scheduledAt) >= new Date() && apt.status !== 'cancelled')
        .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
        .slice(0, 3);

      const latestAnalysis =
        analyses.length > 0
          ? analyses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
          : null;

      setStats({
        analysesCount: kpi.analysesCount ?? analyses.length,
        documentsCount: kpi.documentsCount ?? documents.length,
        upcomingAppointments: kpi.upcomingAppointments ?? upcoming.length,
        avgSleep: kpi.avgSleep ?? null,
        latestAnalysis,
        upcomingAppointmentsList: upcoming,
        diaryTrend: analytics?.trend ?? [],
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

  const isNarrowPhone = bp === 'phone' && screenWidth < 390;
  const cardWidth = isNarrowPhone ? '100%' : bp === 'phone' ? '48%' : bp === 'tablet' ? '31%' : '23%';
  const quickActionWidth = isNarrowPhone ? '100%' : bp === 'phone' ? '48%' : bp === 'tablet' ? '31%' : '23%';
  const firstName = displayFirstName || user?.name || 'Пользователь';
  const nextAppointment = stats.upcomingAppointmentsList[0];
  const latestAnalysisTitle = stats.latestAnalysis?.title || stats.latestAnalysis?.studyType || 'Анализ';
  const latestIndicators = Array.isArray(stats.latestAnalysis?.indicators) ? stats.latestAnalysis.indicators : [];
  const abnormalCount = latestIndicators.filter((i: any) => i?.isNormal === false).length;
  const aiInsight =
    abnormalCount > 0
      ? `AI нашёл ${abnormalCount} показател${abnormalCount === 1 ? 'ь' : 'я'} вне референса в последнем анализе.`
      : stats.latestAnalysis
        ? 'Последний анализ выглядит спокойно. Можно открыть AI-интерпретацию для деталей.'
        : 'Загрузите анализ или документ, и AI соберёт персональную картину здоровья.';

  return (
    <AppScreen>
      <View style={{ gap: theme.spacing.xl }}>
        <AppCard variant="hero">
          <View style={{ gap: theme.spacing.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <View style={{ flex: 1, gap: theme.spacing.xs }}>
                <AppText variant="caption" color="ai">
                  Ваш помощник здоровья
                </AppText>
                <AppText variant="hero">Здравствуйте, {firstName}</AppText>
                <AppText variant="body" color="mutedText">
                  Здесь собраны анализы, документы, план лечения и ближайшие действия.
                </AppText>
              </View>
              {!isNarrowPhone ? (
                <View
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: theme.radius.pill,
                  backgroundColor: theme.colors.aiSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <IconSymbol name="sparkles" size={26} color={theme.colors.ai} />
              </View>
              ) : null}
            </View>

            <AppCard variant="glass" style={{ borderColor: theme.colors.borderStrong }}>
              <View style={{ gap: theme.spacing.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                  <AppStatusBadge label="AI-инсайт" tone="ai" />
                  <AppStatusBadge label={abnormalCount > 0 ? 'Требует внимания' : 'Спокойно'} tone={abnormalCount > 0 ? 'warning' : 'success'} />
                </View>
                <AppText variant="bodyStrong">{aiInsight}</AppText>
                <AppText variant="caption" color="mutedText">
                  Помощник объясняет данные простыми словами. Важные решения обсуждайте с врачом.
                </AppText>
              </View>
            </AppCard>

            <View style={{ flexDirection: isNarrowPhone ? 'column' : 'row', gap: theme.spacing.sm }}>
              <AppButton
                title="Загрузить документ"
                icon="doc.badge.plus"
                variant="ai"
                style={{ flex: 1 }}
                onPress={() => router.push('/documents' as any)}
              />
              <AppButton
                title="Аналитика"
                icon="chart.bar.fill"
                variant="secondary"
                style={{ flex: 1 }}
                onPress={() => router.push('/analytics' as any)}
              />
            </View>
          </View>
        </AppCard>

        <AppSection title="Снимок здоровья" subtitle="Главные показатели и ближайшие события">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md }}>
            <AppMetricCard
              label="Анализы"
              value={stats.analysesCount}
              caption={stats.latestAnalysis ? `последний: ${formatDate(stats.latestAnalysis.date)}` : 'пока нет данных'}
              icon="waveform.path.ecg"
              tone={abnormalCount > 0 ? 'warning' : 'primary'}
              style={{ width: cardWidth }}
              onPress={() => router.push('/analyses' as any)}
            />
            <AppMetricCard
              label="Документы"
              value={stats.documentsCount}
              caption="распознавание и вопросы"
              icon="doc.text.fill"
              tone="info"
              style={{ width: cardWidth }}
              onPress={() => router.push('/documents' as any)}
            />
            <AppMetricCard
              label="Записи"
              value={stats.upcomingAppointments}
              caption={nextAppointment ? 'ближайшая запланирована' : 'нет активных записей'}
              icon="calendar"
              tone="success"
              style={{ width: cardWidth }}
              onPress={() => router.push('/appointments' as any)}
            />
            <AppMetricCard
              label="Сон"
              value={stats.avgSleep != null ? `${stats.avgSleep.toFixed(1)} ч` : '—'}
              caption="средний показатель"
              icon="moon.fill"
              tone="ai"
              style={{ width: cardWidth }}
              onPress={() => router.push('/(tabs)/diary' as any)}
            />
          </View>
        </AppSection>

        <AppSection title="Что важно сейчас" subtitle="Ближайшие действия по вашим данным">
          <AppCard variant="glass">
            {stats.latestAnalysis ? (
              <AppListItem
                title={latestAnalysisTitle}
                subtitle={`${formatDate(stats.latestAnalysis.date)} · ${abnormalCount > 0 ? `${abnormalCount} отклон.` : 'без явных отклонений'}`}
                icon="waveform.path.ecg"
                meta="Анализ"
                onPress={() => router.push(`/analysis/${stats.latestAnalysis.id}` as any)}
              />
            ) : (
              <AppListItem
                title="Загрузите первый анализ"
                subtitle="Помощник выделит показатели и объяснит результат простым языком."
                icon="doc.badge.plus"
                onPress={() => router.push('/documents' as any)}
              />
            )}
            {nextAppointment ? (
              <AppListItem
                title={nextAppointment.doctor.user.name}
                subtitle={`${nextAppointment.doctor.specialization || 'Врач'} · ${formatDateTime(nextAppointment.scheduledAt)}`}
                icon="calendar"
                meta="Запись"
                onPress={() => router.push(`/appointment/${nextAppointment.id}` as any)}
              />
            ) : (
              <AppListItem
                title="Запланировать визит"
                subtitle="Подготовьте вопросы врачу и прикрепите документы перед приёмом."
                icon="calendar.badge.plus"
                onPress={() => router.push('/appointments' as any)}
              />
            )}
          </AppCard>
        </AppSection>

        <AppSection title="Разделы" subtitle="Быстрый доступ ко всем функциям">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            <QuickAction
              width={quickActionWidth}
              icon="book.fill"
              label="Дневник"
              onPress={() => router.push('/(tabs)/diary' as any)}
            />
            <QuickAction width={quickActionWidth} icon="bell.fill" label="Напоминания" onPress={() => router.push('/reminders' as any)} />
            <QuickAction width={quickActionWidth} icon="book.closed.fill" label="Знания" onPress={() => router.push('/knowledge' as any)} />
            <QuickAction width={quickActionWidth} icon="building.2.fill" label="Клиники" onPress={() => router.push('/marketplace' as any)} />
          </View>
        </AppSection>
      </View>
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
  width: any;
}) {
  const theme = useAppTheme();
  return (
    <AppCard padded={false} variant="interactive" style={{ width, overflow: 'hidden' }}>
      <View style={{ padding: theme.spacing.md, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.sm }}>
      <View style={{ width: 42, height: 42, borderRadius: theme.radius.pill, backgroundColor: theme.colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
        <IconSymbol name={icon} size={20} color={theme.colors.primary} />
      </View>
      <AppText variant="caption" style={{ textAlign: 'center' }}>
        {label}
      </AppText>
      </View>
      <AppButton title="Открыть" size="sm" variant="ghost" onPress={onPress} style={{ borderRadius: 0 }} />
    </AppCard>
  );
}
