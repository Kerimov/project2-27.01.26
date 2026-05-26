import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { apiJson } from '../../api/client';
import { fetchAnalysisTrendComparison } from '../../api/analysis-ai';
import {
  convertValueToCanonicalUnit,
  getCommonIndicatorGroups,
  indicatorKeyFromName,
  parseAnalysisIndicators,
  suggestProbableCommonGroups,
  type ProbableIndicatorGroup,
} from '../../utils/parseAnalysisResults';
import { useAppTheme } from '@/design/tokens';
import { AppScreen } from '@/components/ui/AppScreen';
import { AppSection } from '@/components/ui/AppSection';
import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { AppButton } from '@/components/ui/AppButton';
import { AppChip } from '@/components/ui/AppChip';
import { IconSymbol } from '@/components/ui/icon-symbol';

function sparkline(values: number[]) {
  const blocks = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
  if (!values || values.length === 0) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return values
    .map((v) => {
      const idx = Math.round(((v - min) / range) * (blocks.length - 1));
      return blocks[Math.max(0, Math.min(blocks.length - 1, idx))];
    })
    .join('');
}

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
  // legacy exact-name; kept for fallback usage only
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

function buildSeriesByKey(analyses: CompareAnalysis[], indicatorKey: string) {
  const warnings: string[] = [];
  const points: Array<{
    date: string;
    value: number;
    unit?: string;
    isNormal?: boolean | null;
    title: string;
  }> = [];

  for (const a of analyses) {
    const numeric = parseAnalysisIndicators(a.results).filter((x) => toNumeric(x.value) !== null);
    const pick = numeric.find((x) => indicatorKeyFromName(x.name) === indicatorKey);
    const num = toNumeric(pick?.value);
    if (!pick || num === null) continue;

    const conv = convertValueToCanonicalUnit(indicatorKey, num, pick.unit);
    if (conv.warning) warnings.push(`${a.title}: ${conv.warning}`);
    points.push({
      date: a.date,
      value: conv.value,
      unit: conv.unit,
      isNormal: pick.isNormal,
      title: a.title,
    });
  }

  return {
    series: points.sort((x, y) => new Date(x.date).getTime() - new Date(y.date).getTime()),
    warnings: [...new Set(warnings)].slice(0, 10),
  };
}

export default function CompareAnalysesScreen() {
  const theme = useAppTheme();
  const { prefill } = useLocalSearchParams<{ prefill?: string }>();

  const [items, setItems] = useState<CompareAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [indicatorKey, setIndicatorKey] = useState('');
  const [aiText, setAiText] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [probableNameByIndex, setProbableNameByIndex] = useState<Record<number, string> | null>(null);
  const [aiPerPoint, setAiPerPoint] = useState<Array<{ date: string; title?: string; summary: string }> | null>(
    null
  );

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

  const commonGroups = useMemo(
    () => getCommonIndicatorGroups(selected.map((a) => ({ results: a.results }))),
    [selected]
  );

  const probableGroups = useMemo<ProbableIndicatorGroup[]>(
    () => suggestProbableCommonGroups(selected.map((a) => ({ results: a.results }))),
    [selected]
  );

  const selectedGroup = useMemo(
    () => commonGroups.find((g) => String(g.key) === String(indicatorKey)) || null,
    [commonGroups, indicatorKey]
  );

  const seriesInfo = useMemo(() => {
    if (!indicatorKey || selected.length === 0) return { series: [], warnings: [] as string[] };
    if (indicatorKey.startsWith('prob:') && probableNameByIndex) {
      const pickedSeries = selected
        .map((a, idx) => ({ a, idx, wanted: probableNameByIndex[idx] }))
        .map(({ a, wanted }) => {
          const ind = parseAnalysisIndicators(a.results).find((x) => x.name === wanted);
          const num = toNumeric(ind?.value);
          if (!ind || num === null) return null;
          return {
            date: a.date,
            value: num,
            unit: ind.unit,
            isNormal: ind.isNormal,
            title: a.title,
          };
        })
        .filter(Boolean) as any[];
      return {
        series: pickedSeries.sort((x, y) => new Date(x.date).getTime() - new Date(y.date).getTime()),
        warnings: ['Используется вероятное сопоставление (проверьте названия и единицы).'],
      };
    }
    return buildSeriesByKey(selected, indicatorKey);
  }, [selected, indicatorKey, probableNameByIndex]);

  const series = seriesInfo.series;
  const seriesValues = series.map((p) => p.value);

  useEffect(() => {
    if (!indicatorKey && commonGroups.length > 0) {
      setIndicatorKey(String(commonGroups[0].key));
    }
    if (indicatorKey && !commonGroups.some((g) => String(g.key) === String(indicatorKey))) {
      setIndicatorKey(String(commonGroups[0]?.key || ''));
    }
  }, [commonGroups, indicatorKey]);

  useEffect(() => {
    setWarnings(seriesInfo.warnings || []);
  }, [seriesInfo.warnings]);

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setAiText(null);
    setWarnings([]);
    setProbableNameByIndex(null);
    setAiPerPoint(null);
  };

  const interpret = async () => {
    if (selected.length < 2 || !indicatorKey || series.length < 2) return;
    try {
      setAiBusy(true);
      setAiText(null);
      setAiPerPoint(null);
      const r = await fetchAnalysisTrendComparison({
        analysisIds: selected.map((a) => a.id),
        indicatorName: selectedGroup?.label || indicatorKey,
        series,
        perPoint: true,
      });
      const text =
        r.interpretation ||
        r.summary ||
        r.text ||
        (r.result && typeof r.result === 'object' && 'tldr' in r.result
          ? String((r.result as { tldr?: string }).tldr)
          : null);
      setAiText(
        text ? `Показатель: ${r.indicatorName || (selectedGroup?.label || indicatorKey)}\n\n${text}` : JSON.stringify(r)
      );
      if (r?.result?.perPoint && Array.isArray(r.result.perPoint)) {
        setAiPerPoint(r.result.perPoint.slice(0, 24));
      }
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
          ) : commonGroups.length === 0 ? (
            <AppCard variant="glass">
              <View style={{ gap: theme.spacing.sm }}>
                <AppText variant="body" color="mutedText">
                  Точных совпадений не нашли. Ниже — вероятные совпадения по похожести названий (нужно выбрать).
                </AppText>
                {probableGroups.length === 0 ? (
                  <AppText variant="body" color="mutedText">
                    Вероятных совпадений тоже нет. Попробуйте другие анализы.
                  </AppText>
                ) : (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {probableGroups.slice(0, 6).map((g) => (
                      <AppChip
                        key={g.key}
                        label={`${g.label} · ${Math.round(g.confidence * 100)}%`}
                        tone={indicatorKey === g.key ? 'primary' : 'neutral'}
                        onPress={() => {
                          setIndicatorKey(g.key);
                          setProbableNameByIndex(g.perAnalysisNameByIndex);
                          setAiText(null);
                        }}
                      />
                    ))}
                  </View>
                )}

                {indicatorKey.startsWith('prob:') && probableNameByIndex ? (
                  <View style={{ gap: theme.spacing.xs }}>
                    <AppText variant="caption" color="mutedText">
                      Что сопоставили:
                    </AppText>
                    {selected.map((a, idx) => (
                      <AppText key={a.id} variant="body" color="mutedText">
                        • {a.title}: {probableNameByIndex[idx] || '—'}
                      </AppText>
                    ))}
                  </View>
                ) : null}
              </View>
            </AppCard>
          ) : (
            <>
              <AppSection title="Общий показатель">
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {commonGroups.map((g) => (
                      <AppChip
                        key={String(g.key)}
                        label={g.label}
                        tone={String(indicatorKey) === String(g.key) ? 'primary' : 'neutral'}
                        onPress={() => setIndicatorKey(String(g.key))}
                      />
                    ))}
                  </View>
                </ScrollView>
              </AppSection>

              {(selectedGroup?.variants?.length || 0) > 0 ? (
                <AppCard variant="glass">
                  <View style={{ gap: theme.spacing.xs }}>
                    <AppText variant="caption" color="mutedText">
                      Сопоставленные названия в документах:
                    </AppText>
                    <AppText variant="body">{selectedGroup!.variants.slice(0, 8).join(', ')}</AppText>
                  </View>
                </AppCard>
              ) : null}

              {warnings.length > 0 ? (
                <AppCard variant="glass">
                  <View style={{ gap: theme.spacing.xs }}>
                    <AppText variant="caption" color="mutedText">
                      Важно:
                    </AppText>
                    {warnings.slice(0, 6).map((w, idx) => (
                      <AppText key={idx} variant="body" color="mutedText">
                        • {w}
                      </AppText>
                    ))}
                  </View>
                </AppCard>
              ) : null}

              {series.length > 0 ? (
                <AppSection title="История значений">
                  <AppCard variant="glass">
                    {series.length >= 2 ? (
                      <View style={{ marginBottom: theme.spacing.sm }}>
                        <AppText variant="caption" color="mutedText">
                          Общий график: {sparkline(seriesValues)}
                        </AppText>
                      </View>
                    ) : null}
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

          {aiPerPoint && aiPerPoint.length > 0 ? (
            <AppSection title="AI‑разбор по каждому замеру">
              <View style={{ gap: theme.spacing.sm }}>
                {aiPerPoint.slice(0, 12).map((pp, idx) => (
                  <AppCard key={idx} variant="glass">
                    <View style={{ gap: theme.spacing.xs }}>
                      <AppText variant="caption" color="mutedText">
                        {pp.date ? new Date(pp.date).toLocaleDateString('ru-RU') : '—'}
                        {pp.title ? ` · ${pp.title}` : ''}
                      </AppText>
                      <AppText variant="body">{pp.summary}</AppText>
                    </View>
                  </AppCard>
                ))}
              </View>
            </AppSection>
          ) : null}
        </View>
      </AppSection>
    </AppScreen>
  );
}
