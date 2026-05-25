import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { getAnalysis, deleteAnalysis, type AnalysisDetail } from '../../api/analyses';
import {
  fetchAnalysisTrend,
  fetchRiskTriage,
  generateAnalysisComments,
  generateCarePlanFromAnalysis,
  type RiskTriageResult,
} from '../../api/analysis-ai';
import { parseAnalysisIndicators, extractAiComments } from '../../utils/parseAnalysisResults';
import { useAppTheme } from '@/design/tokens';
import { AppScreen } from '@/components/ui/AppScreen';
import { AppSection } from '@/components/ui/AppSection';
import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { AppChip } from '@/components/ui/AppChip';
import { AppButton } from '@/components/ui/AppButton';
import { AppStatusBadge } from '@/components/ui/AppStatusBadge';
import { IconSymbol } from '@/components/ui/icon-symbol';

const AI_MARKER = '--- AI Комментарии ---';

function riskLabel(level?: string): string {
  if (level === 'urgent') return 'Срочно';
  if (level === 'attention') return 'Внимание';
  return 'Ок';
}

function statusLabel(status?: string | null): string {
  if (status === 'normal') return 'Норма';
  if (status === 'abnormal') return 'Отклонение';
  if (status === 'critical') return 'Критично';
  return status || '—';
}

export default function AnalysisDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useAppTheme();
  const [deleting, setDeleting] = useState(false);

  const [item, setItem] = useState<AnalysisDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [risk, setRisk] = useState<RiskTriageResult | null>(null);
  const [riskLoading, setRiskLoading] = useState(false);
  const [aiComments, setAiComments] = useState<string | null>(null);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const loadRisk = useCallback(async (analysisId: string) => {
    try {
      setRiskLoading(true);
      const r = await fetchRiskTriage(analysisId);
      setRisk(r);
    } catch {
      setRisk(null);
    } finally {
      setRiskLoading(false);
    }
  }, []);

  const loadComments = useCallback(
    async (analysisId: string, force = false) => {
      try {
        setCommentsLoading(true);
        if (!force && item?.notes?.includes(AI_MARKER)) {
          setAiComments(extractAiComments(item.notes));
          return;
        }
        const { comment } = await generateAnalysisComments(analysisId);
        setAiComments(comment);
        const refreshed = await getAnalysis(analysisId);
        setItem(refreshed);
        setAiComments(extractAiComments(refreshed.notes) || comment);
      } catch {
        // ИИ-комментарии не блокируют экран
      } finally {
        setCommentsLoading(false);
      }
    },
    [item?.notes]
  );

  useEffect(() => {
    if (!id) return;
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getAnalysis(String(id));
        if (!mounted) return;
        setItem(data);
        setAiComments(extractAiComments(data.notes));
        await loadRisk(data.id);
        if (!extractAiComments(data.notes) && parseAnalysisIndicators(data.results).length > 0) {
          try {
            setCommentsLoading(true);
            const { comment } = await generateAnalysisComments(data.id);
            if (!mounted) return;
            setAiComments(comment);
            const refreshed = await getAnalysis(data.id);
            if (mounted) {
              setItem(refreshed);
              setAiComments(extractAiComments(refreshed.notes) || comment);
            }
          } catch {
            /* optional */
          } finally {
            if (mounted) setCommentsLoading(false);
          }
        }
      } catch (e: any) {
        if (mounted) setError(e?.message || 'Не удалось загрузить анализ');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id, loadRisk]);

  const indicators = useMemo(() => (item ? parseAnalysisIndicators(item.results) : []), [item]);

  const abnormalCount = useMemo(
    () =>
      indicators.filter(
        (ind) => ind.isNormal === false || ind.flag === 'high' || ind.flag === 'low'
      ).length,
    [indicators]
  );

  if (!id) {
    return (
      <AppScreen scroll={false} contentContainerStyle={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <AppText color="danger">Некорректный идентификатор анализа</AppText>
      </AppScreen>
    );
  }

  if (loading) {
    return (
      <AppScreen scroll={false} contentContainerStyle={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 }}>
        <ActivityIndicator />
        <AppText variant="caption" color="mutedText">
          Загружаем анализ…
        </AppText>
      </AppScreen>
    );
  }

  if (error || !item) {
    return (
      <AppScreen scroll={false} contentContainerStyle={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <AppText color="danger">{error || 'Анализ не найден'}</AppText>
      </AppScreen>
    );
  }

  const displayRiskLevel =
    risk?.level || (item.status === 'critical' ? 'urgent' : item.status === 'abnormal' ? 'attention' : 'ok');

  return (
    <AppScreen>
      <AppSection title={item.title} subtitle={`${new Date(item.date).toLocaleDateString('ru-RU')} · ${item.type || 'Без типа'}`}>
        <View style={{ gap: theme.spacing.lg }}>
          <AppCard variant="hero" style={{ gap: theme.spacing.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.md }}>
              <View style={{ flex: 1, gap: theme.spacing.xs }}>
                <AppStatusBadge
                  label={`Риск: ${riskLoading ? '…' : riskLabel(displayRiskLevel)}`}
                  tone={displayRiskLevel === 'urgent' ? 'danger' : displayRiskLevel === 'attention' ? 'warning' : 'success'}
                />
                <AppText variant="h2">{item.title}</AppText>
                <AppText variant="caption" color="mutedText">
                  {item.type || 'Лабораторное исследование'} · {indicators.length} показателей
                </AppText>
              </View>
              <View
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: theme.radius.pill,
                  backgroundColor: theme.colors.aiSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <IconSymbol name="sparkles" size={24} color={theme.colors.ai} />
              </View>
            </View>
            {item.laboratory ? (
              <AppText variant="caption" color="mutedText">
                Лаборатория: {item.laboratory}
              </AppText>
            ) : null}
            {item.doctor ? (
              <AppText variant="caption" color="mutedText">
                Врач: {item.doctor}
              </AppText>
            ) : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
              <AppChip label={statusLabel(item.status)} tone={item.status === 'normal' ? 'success' : item.status === 'critical' ? 'danger' : 'warning'} />
              <AppChip
                label={`Риск: ${riskLoading ? '…' : riskLabel(displayRiskLevel)}`}
                tone={displayRiskLevel === 'urgent' ? 'danger' : displayRiskLevel === 'attention' ? 'warning' : 'success'}
              />
              {risk?.confidence !== undefined ? (
                <AppChip label={`Уверенность ${risk.confidence}%`} tone="info" />
              ) : null}
              {abnormalCount > 0 ? <AppChip label={`Отклонений: ${abnormalCount}`} tone="warning" /> : null}
            </View>
          </AppCard>

          {risk && (risk.reasons?.length || risk.redFlags?.length || risk.nextSteps?.length) ? (
            <AppSection title="Сигналы риска и триаж" subtitle="Как на веб-версии">
              {risk.reasons?.length ? (
                <AppCard variant="glass" style={{ marginBottom: theme.spacing.sm, gap: 6 }}>
                  <AppText variant="bodyStrong">Почему так</AppText>
                  {risk.reasons.slice(0, 6).map((x, idx) => (
                    <AppText key={idx} variant="caption" color="mutedText">
                      • {x}
                    </AppText>
                  ))}
                </AppCard>
              ) : null}
              {risk.redFlags?.length ? (
                <AppCard variant="glass" style={{ marginBottom: theme.spacing.sm, gap: 6, borderColor: theme.colors.danger }}>
                  <AppText variant="bodyStrong" color="danger">
                    Когда срочно
                  </AppText>
                  {risk.redFlags.slice(0, 6).map((x, idx) => (
                    <AppText key={idx} variant="caption" color="danger">
                      • {x}
                    </AppText>
                  ))}
                </AppCard>
              ) : null}
              {risk.nextSteps?.length ? (
                <AppCard variant="glass" style={{ gap: 6 }}>
                  <AppText variant="bodyStrong">Что делать дальше</AppText>
                  {risk.nextSteps.slice(0, 6).map((x, idx) => (
                    <AppText key={idx} variant="caption" color="mutedText">
                      • {x}
                    </AppText>
                  ))}
                </AppCard>
              ) : null}
            </AppSection>
          ) : null}

          <AppSection
            title="Показатели"
            subtitle={
              indicators.length > 0
                ? `${indicators.length} показателей${abnormalCount ? `, отклонений: ${abnormalCount}` : ''}`
                : 'Нет данных'
            }
          >
            {indicators.length > 0 ? (
              <View style={{ gap: theme.spacing.sm }}>
                {indicators.map((ind, idx) => {
                  const value = `${ind.value ?? ''}${ind.unit ? ` ${ind.unit}` : ''}`;
                  const ref =
                    ind.referenceMin !== undefined && ind.referenceMax !== undefined
                      ? `${ind.referenceMin} – ${ind.referenceMax}${ind.unit ? ` ${ind.unit}` : ''}`
                      : ind.reference || null;
                  const isAbnormal =
                    ind.isNormal === false || ind.flag === 'high' || ind.flag === 'low';

                  return (
                    <AppCard
                      variant={isAbnormal ? 'glass' : 'surface'}
                      key={`${ind.name}-${idx}`}
                      style={{
                        gap: 6,
                        borderLeftWidth: isAbnormal ? 4 : 0,
                        borderLeftColor: isAbnormal ? theme.colors.danger : 'transparent',
                        backgroundColor: isAbnormal ? theme.colors.dangerSoft : undefined,
                      }}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                        <View style={{ flex: 1 }}>
                          <AppText variant="bodyStrong" color={isAbnormal ? 'danger' : undefined}>
                            {ind.name}
                          </AppText>
                          <AppText variant="body" color={isAbnormal ? 'danger' : undefined} style={{ marginTop: 2 }}>
                            {value}
                          </AppText>
                        </View>
                        {ind.isNormal !== undefined || isAbnormal ? (
                          <AppChip label={isAbnormal ? 'Отклонение' : 'Норма'} tone={isAbnormal ? 'warning' : 'success'} />
                        ) : null}
                      </View>
                      {ref ? (
                        <AppText variant="caption" color="mutedText">
                          Референс: {ref}
                        </AppText>
                      ) : null}
                      {ind.flag && ind.flag !== 'normal' ? (
                        <AppText variant="caption" color="danger">
                          {ind.flag === 'high' ? '↑ Повышен' : ind.flag === 'low' ? '↓ Понижен' : ind.flag}
                        </AppText>
                      ) : null}
                    </AppCard>
                  );
                })}
              </View>
            ) : (
              <AppCard variant="glass">
                <AppText variant="caption" color="mutedText">
                  Показатели не найдены в записи анализа. Если документ только что обработан — обновите список через
                  минуту.
                </AppText>
              </AppCard>
            )}
          </AppSection>

          {(aiComments || commentsLoading) && (
            <AppSection title="AI комментарии" subtitle="Интерпретация отклонений и нормы">
              <AppCard variant="glass" style={{ gap: 8, borderColor: theme.colors.borderStrong }}>
                {commentsLoading ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <ActivityIndicator size="small" />
                    <AppText variant="caption" color="mutedText">
                      Генерируем комментарии…
                    </AppText>
                  </View>
                ) : (
                  <AppText variant="body" selectable>
                    {aiComments}
                  </AppText>
                )}
                <AppButton
                  title="Обновить комментарии"
                  variant="ai"
                  icon="sparkles"
                  size="sm"
                  loading={commentsLoading}
                  onPress={() => loadComments(item.id, true)}
                />
              </AppCard>
            </AppSection>
          )}

          {item.notes && !item.notes.includes(AI_MARKER) ? (
            <AppSection title="Заключение / примечания">
              <AppCard variant="glass">
                <AppText variant="body" selectable>
                  {item.notes}
                </AppText>
              </AppCard>
            </AppSection>
          ) : null}

          <AppButton
            title="Удалить анализ"
            variant="danger"
            loading={deleting}
            onPress={() => {
              Alert.alert('Удалить анализ', `Удалить «${item.title}»? Действие необратимо.`, [
                { text: 'Отмена', style: 'cancel' },
                {
                  text: 'Удалить',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      setDeleting(true);
                      await deleteAnalysis(item.id);
                      router.back();
                    } catch (e: any) {
                      Alert.alert('Ошибка', e?.message || 'Не удалось удалить');
                    } finally {
                      setDeleting(false);
                    }
                  },
                },
              ]);
            }}
          />

          <AppSection title="Дополнительно">
            <View style={{ gap: theme.spacing.sm }}>
              <AppButton
                title="Обновить оценку риска"
                variant="ai"
                icon="sparkles"
                loading={riskLoading}
                onPress={() => loadRisk(item.id)}
              />
              <AppButton
                title="Интерпретация тренда"
                variant="secondary"
                icon="chart.bar.fill"
                loading={aiLoading}
                onPress={async () => {
                  const trendIndicator =
                    indicators.find(
                      (ind) =>
                        ind.isNormal === false || ind.flag === 'high' || ind.flag === 'low'
                    ) || indicators[0];
                  if (!trendIndicator?.name) {
                    Alert.alert(
                      'Нет показателей',
                      'В этом анализе нет числовых показателей для интерпретации тренда.'
                    );
                    return;
                  }
                  try {
                    setAiLoading(true);
                    const r = await fetchAnalysisTrend(item.id, trendIndicator.name);
                    const text =
                      r.interpretation ||
                      r.summary ||
                      r.text ||
                      (r.result && typeof r.result === 'object' && 'tldr' in r.result
                        ? String((r.result as { tldr?: string }).tldr)
                        : null);
                    setAiNote(
                      text
                        ? `Показатель: ${r.indicatorName || trendIndicator.name}\n\n${text}`
                        : JSON.stringify(r)
                    );
                  } catch (e: any) {
                    Alert.alert('Ошибка', e?.message || 'ИИ недоступен');
                  } finally {
                    setAiLoading(false);
                  }
                }}
              />
              <AppButton
                title="План действий"
                variant="secondary"
                icon="checkmark.circle.fill"
                loading={aiLoading}
                onPress={async () => {
                  try {
                    setAiLoading(true);
                    const r = await generateCarePlanFromAnalysis(item.id);
                    Alert.alert('Готово', r.message || 'Задачи добавлены в план');
                  } catch (e: any) {
                    Alert.alert('Ошибка', e?.message || 'ИИ недоступен');
                  } finally {
                    setAiLoading(false);
                  }
                }}
              />
            </View>
            {aiNote ? (
              <AppCard variant="glass" style={{ marginTop: theme.spacing.md }}>
                <AppText variant="body" selectable>
                  {aiNote}
                </AppText>
              </AppCard>
            ) : null}
          </AppSection>
        </View>
      </AppSection>
    </AppScreen>
  );
}
