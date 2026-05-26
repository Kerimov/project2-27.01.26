import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { apiJson } from '../../api/client';
import { fetchAnalysisTrendComparison } from '../../api/analysis-ai';
import {
  getCommonNumericIndicators,
  parseAnalysisIndicators,
} from '../../utils/parseAnalysisResults';
import { useAppTheme } from '@/design/tokens';
import { AppScreen } from '@/components/ui/AppScreen';
import { AppSection } from '@/components/ui/AppSection';
import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { AppButton } from '@/components/ui/AppButton';
import { AppChip } from '@/components/ui/AppChip';
import { IconSymbol } from '@/components/ui/icon-symbol';

type CompareAnalysis = {
  id: string;
  title: string;
  date: string;
  type: string | null;
  results: unknown;
};

function toNumeric(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const v = Number(value.replace(',', '.').replace(/[^\d.-]/g, ''));
    return Number.isFinite(v) ? v : null;
  }
  return null;
}

function buildSeries(analyses: CompareAnalysis[], indicatorName: string) {
  const points: Array<{
    date: string;
    value: number;
    unit?: string;
    isNormal?: boolean | null;
    title: string;
  }> = [];

  for (const a of analyses) {
    const ind = parseAnalysisIndicators(a.results).find((x) => x.name === indicatorName);
    const num = toNumeric(ind?.value);
    if (num === null) continue;
    points.push({
      date: a.date,
      value: num,
      unit: ind?.unit,
      isNormal: ind?.isNormal,
      title: a.title,
    });
  }

  return points.sort((x, y) => new Date(x.date).getTime() - new Date(y.date).getTime());
}

export default function CompareAnalysesScreen() {
  const theme = useAppTheme();
  const { prefill } = useLocalSearchParams<{ prefill?: string }>();

  const [items, setItems] = useState<CompareAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [indicator, setIndicator] = useState('');
  const [aiText, setAiText] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiJson<{ analyses: CompareAnalysis[] }>('/api/analyses');
      const rows = (data.analyses || []).map((a) => ({
        id: a.id,
        title: a.title,
        date: a.date,
        type: a.type,
        results: a.results,
      }));
      setItems(rows);
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message || 'Не удалось загрузить анализы');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (prefill && items.length > 0) {
      setSelectedIds(new Set([String(prefill)]));
    }
  }, [prefill, items.length]);

  const selected = useMemo(
    () => items.filter((a) => selectedIds.has(a.id)),
    [items, selectedIds]
  );

  const commonIndicators = useMemo(
    () => getCommonNumericIndicators(selected.map((a) => ({ results: a.results }))),
    [selected]
  );

  const series = useMemo(() => {
    if (!indicator || selected.length === 0) return [];
    return buildSeries(selected, indicator);
  }, [selected, indicator]);

  useEffect(() => {
    if (!indicator && commonIndicators.length > 0) {
      setIndicator(commonIndicators[0]);
    }
    if (indicator && !commonIndicators.includes(indicator)) {
      setIndicator(commonIndicators[0] || '');
    }
  }, [commonIndicators, indicator]);

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setAiText(null);
  };

  const interpret = async () => {
    if (selected.length < 2 || !indicator || series.length < 2) return;
    try {
      setAiBusy(true);
      setAiText(null);
      const r = await fetchAnalysisTrendComparison({
        analysisIds: selected.map((a) => a.id),
        indicatorName: indicator,
        series,
      });
      const text =
        r.interpretation ||
        r.summary ||
        r.text ||
        (r.result && typeof r.result === 'object' && 'tldr' in r.result
          ? String((r.result as { tldr?: string }).tldr)
          : null);
      setAiText(
        text ? `Показатель: ${r.indicatorName || indicator}\n\n${text}` : JSON.stringify(r)
      );
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message || 'ИИ недоступен');
    } finally {
      setAiBusy(false);
    }
  };

  if (loading) {
    return (
      <AppScreen
        scroll={false}
        contentContainerStyle={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.sm }}>
        <ActivityIndicator />
        <AppText variant="caption" color="mutedText">
          Загружаем анализы…
        </AppText>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <AppSection
        title="Сравнение анализов"
        subtitle="Выберите 2+ анализа с общим показателем и получите AI‑интерпретацию динамики">
        <View style={{ gap: theme.spacing.md }}>
          {items.map((item) => {
            const checked = selectedIds.has(item.id);
            return (
              <Pressable key={item.id} onPress={() => toggle(item.id)}>
                <AppCard variant={checked ? 'interactive' : 'glass'}>
                  <View style={{ flexDirection: 'row', gap: theme.spacing.md, alignItems: 'center' }}>
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        borderWidth: 2,
                        borderColor: checked ? theme.colors.primary : theme.colors.border,
                        backgroundColor: checked ? theme.colors.primary : 'transparent',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                      {checked ? <IconSymbol name="checkmark.circle.fill" size={14} color="#fff" /> : null}
                    </View>
                    <View style={{ flex: 1, gap: theme.spacing.xs }}>
                      <AppText variant="h3">{item.title}</AppText>
                      <AppText variant="caption" color="mutedText">
                        {new Date(item.date).toLocaleDateString('ru-RU')} · {item.type || 'Без типа'}
                      </AppText>
                    </View>
                  </View>
                </AppCard>
              </Pressable>
            );
          })}

          {selected.length < 2 ? (
            <AppCard variant="glass">
              <AppText variant="body" color="mutedText">
                Для тренда нужно минимум два анализа с одинаковым показателем.
              </AppText>
            </AppCard>
          ) : commonIndicators.length === 0 ? (
            <AppCard variant="glass">
              <AppText variant="body" color="mutedText">
                У выбранных анализов нет общих числовых показателей для сравнения.
              </AppText>
            </AppCard>
          ) : (
            <>
              <AppSection title="Общий показатель">
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {commonIndicators.map((name) => (
                      <AppChip
                        key={name}
                        label={name}
                        tone={indicator === name ? 'primary' : 'neutral'}
                        onPress={() => setIndicator(name)}
                      />
                    ))}
                  </View>
                </ScrollView>
              </AppSection>

              {series.length > 0 ? (
                <AppSection title="История значений">
                  <AppCard variant="glass">
                    <View style={{ gap: theme.spacing.sm }}>
                      {series
                        .slice()
                        .reverse()
                        .map((p) => (
                          <View
                            key={`${p.date}-${p.title}`}
                            style={{
                              flexDirection: 'row',
                              justifyContent: 'space-between',
                              gap: theme.spacing.sm,
                            }}>
                            <View style={{ flex: 1 }}>
                              <AppText variant="caption" color="mutedText">
                                {new Date(p.date).toLocaleDateString('ru-RU')}
                              </AppText>
                              <AppText variant="body">{p.title}</AppText>
                            </View>
                            <AppText
                              variant="body"
                              style={p.isNormal === false ? { color: theme.colors.danger } : undefined}>
                              {p.value}
                              {p.unit ? ` ${p.unit}` : ''}
                            </AppText>
                          </View>
                        ))}
                    </View>
                  </AppCard>
                </AppSection>
              ) : null}

              <AppButton
                title="Интерпретировать динамику"
                variant="ai"
                icon="sparkles"
                loading={aiBusy}
                disabled={series.length < 2}
                onPress={interpret}
              />
            </>
          )}

          {aiText ? (
            <AppCard variant="glass">
              <AppText variant="body" selectable>
                {aiText}
              </AppText>
            </AppCard>
          ) : null}
        </View>
      </AppSection>
    </AppScreen>
  );
}
