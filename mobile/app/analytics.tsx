import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { getAnalytics } from '../api/analytics';
import { useAppTheme } from '@/design/tokens';
import { AppScreen } from '@/components/ui/AppScreen';
import { AppSection } from '@/components/ui/AppSection';
import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';

export default function AnalyticsScreen() {
  const theme = useAppTheme();
  const [loading, setLoading] = useState(true);
  const [kpi, setKpi] = useState<Record<string, number | undefined>>({});
  const [trend, setTrend] = useState<{ day: string; sleep?: number; mood?: number }[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const data = await getAnalytics();
        setKpi(data.kpi || {});
        setTrend(data.trend || []);
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
    <AppScreen>
      <AppSection title="Аналитика">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {[
            ['Документы', kpi.documentsCount],
            ['Анализы', kpi.analysesCount],
            ['Записи', kpi.upcomingAppointments],
            ['Сон (ср.)', kpi.avgSleep != null ? `${kpi.avgSleep.toFixed(1)} ч` : '—'],
          ].map(([label, val]) => (
            <AppCard key={String(label)} style={{ minWidth: '45%', flex: 1, alignItems: 'center', padding: 16 }}>
              <AppText variant="title" style={{ color: theme.colors.primary }}>
                {String(val ?? '—')}
              </AppText>
              <AppText variant="caption" color="mutedText">
                {label}
              </AppText>
            </AppCard>
          ))}
        </View>
        {trend.length > 0 ? (
          <AppSection title="Дневник (7 дней)" style={{ marginTop: theme.spacing.lg }}>
            <AppCard>
              {trend.map((p) => (
                <AppText key={p.day} variant="caption" color="mutedText" style={{ marginBottom: 6 }}>
                  {p.day}: сон {p.sleep ?? '—'} ч, настроение {p.mood ?? '—'}
                </AppText>
              ))}
            </AppCard>
          </AppSection>
        ) : null}
      </AppSection>
    </AppScreen>
  );
}
