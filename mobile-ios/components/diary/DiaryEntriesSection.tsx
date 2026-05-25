import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';

import { getDiaryEntries, deleteDiaryEntry, type DiaryEntry } from '../../api/diary';
import { diaryWeeklyReview, diaryIndicatorLink } from '../../api/ai-diary';
import { setAuthToken } from '../../api/client';
import { useAuthStore } from '../../state/authStore';
import { useAppTheme } from '@/design/tokens';
import { useContentPadding, useMaxContentWidth } from '@/design/responsive';
import { useFloatingTabBarInsets } from '@/design/tab-bar';
import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { AppButton } from '@/components/ui/AppButton';
import { AppChip } from '@/components/ui/AppChip';
import { AppFAB } from '@/components/ui/AppFAB';
import { PatientSwitcher } from '../PatientSwitcher';
import { useCaretakerStore } from '../../state/caretakerStore';

export function DiaryEntriesSection() {
  const router = useRouter();
  const { token } = useAuthStore();
  const theme = useAppTheme();
  const pad = useContentPadding();
  const { listPaddingBottom } = useFloatingTabBarInsets();
  const { maxWidth } = useMaxContentWidth();

  const { selectedPatientId } = useCaretakerStore();
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);

  useEffect(() => {
    if (token) {
      setAuthToken(token);
    }
  }, [token]);

  const loadEntries = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError(null);
      setAuthToken(token);
      const data = await getDiaryEntries({
        order: 'desc',
        patientId: selectedPatientId || undefined,
      });
      setEntries(data);
    } catch (e: any) {
      setError(e?.message || 'Не удалось загрузить записи дневника');
    } finally {
      setLoading(false);
    }
  }, [token, selectedPatientId]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const handleDelete = async (entry: DiaryEntry) => {
    Alert.alert(
      'Удалить запись',
      `Вы уверены, что хотите удалить запись от ${new Date(entry.entryDate).toLocaleDateString('ru-RU')}?`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            try {
              setAuthToken(token!);
              await deleteDiaryEntry(entry.id);
              Alert.alert('Успех', 'Запись удалена');
              await loadEntries();
            } catch (e: any) {
              Alert.alert('Ошибка', e?.message || 'Не удалось удалить запись');
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderItem = ({ item }: { item: DiaryEntry }) => {
    const hasData =
      item.mood !== null ||
      item.painScore !== null ||
      item.sleepHours !== null ||
      item.steps !== null ||
      item.temperature !== null ||
      item.weight !== null ||
      item.systolic !== null ||
      item.diastolic !== null ||
      item.pulse !== null ||
      item.symptoms ||
      item.notes;

    return (
      <AppCard style={{ padding: theme.spacing.lg }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <AppText variant="h3">{formatDate(item.entryDate)}</AppText>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <AppButton
              title="Изменить"
              size="sm"
              variant="secondary"
              onPress={() => router.push(`/diary/${item.id}` as any)}
            />
            <AppButton title="Удалить" size="sm" variant="danger" onPress={() => handleDelete(item)} />
          </View>
        </View>

        {hasData ? (
          <View style={{ marginTop: theme.spacing.md, gap: 8 }}>
            {item.mood !== null ? <AppChip label={`Настроение: ${item.mood}/5`} /> : null}
            {item.painScore !== null ? <AppChip label={`Боль: ${item.painScore}/10`} /> : null}
            {item.sleepHours !== null ? <AppChip label={`Сон: ${item.sleepHours} ч`} /> : null}
            {item.steps !== null ? <AppChip label={`Шаги: ${item.steps}`} /> : null}
            {item.temperature !== null ? <AppChip label={`Температура: ${item.temperature}°C`} /> : null}
            {item.weight !== null ? <AppChip label={`Вес: ${item.weight} кг`} /> : null}
            {item.systolic !== null || item.diastolic !== null ? (
              <AppChip
                label={`Давление: ${
                  item.systolic !== null && item.diastolic !== null
                    ? `${item.systolic}/${item.diastolic}`
                    : item.systolic !== null
                      ? `${item.systolic}/-`
                      : `-/${item.diastolic}`
                }`}
              />
            ) : null}
            {item.pulse !== null ? <AppChip label={`Пульс: ${item.pulse} уд/мин`} /> : null}

            {item.symptoms ? (
              <AppText variant="caption" color="mutedText">
                Симптомы: {item.symptoms}
              </AppText>
            ) : null}
            {item.notes ? (
              <AppText variant="caption" color="mutedText">
                Заметки: {item.notes}
              </AppText>
            ) : null}

            {item.tags && item.tags.length > 0 ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                {item.tags.map((t) => (
                  <AppChip key={t.tag.id} label={t.tag.name} />
                ))}
              </View>
            ) : null}
          </View>
        ) : (
          <AppText variant="caption" color="mutedText" style={{ marginTop: theme.spacing.md }}>
            Нет данных
          </AppText>
        )}
      </AppCard>
    );
  };

  if (loading && !entries.length) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.sm }}>
        <ActivityIndicator />
        <AppText variant="caption" color="mutedText">
          Загружаем записи дневника…
        </AppText>
      </View>
    );
  }

  const runWeeklyReview = async () => {
    try {
      setAiBusy(true);
      const res = await diaryWeeklyReview({ patientId: selectedPatientId || undefined });
      const text = res.review || res.summary || res.text || 'Нет данных';
      Alert.alert('Обзор недели', text);
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message || 'Не удалось получить обзор');
    } finally {
      setAiBusy(false);
    }
  };

  const runIndicatorLink = () => {
    Alert.prompt('Связь с показателями', 'Название показателя (например, сон)', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Анализ',
        onPress: async (name?: string) => {
          if (!name?.trim()) return;
          try {
            setAiBusy(true);
            const res = await diaryIndicatorLink({
              indicatorName: name.trim(),
              patientId: selectedPatientId || undefined,
            });
            Alert.alert('Связь с анализами', res.summary || res.text || JSON.stringify(res.links || res));
          } catch (e: any) {
            Alert.alert('Ошибка', e?.message || 'Не удалось');
          } finally {
            setAiBusy(false);
          }
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1 }}>
      <PatientSwitcher />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: theme.spacing.sm }}>
        <AppButton title="AI: обзор недели" size="sm" variant="secondary" loading={aiBusy} onPress={runWeeklyReview} />
        <AppButton title="AI: связь показателей" size="sm" variant="secondary" disabled={aiBusy} onPress={runIndicatorLink} />
      </View>
      <FlatList
        data={entries}
        keyExtractor={(item) => item.id}
        style={{ flex: 1 }}
        contentContainerStyle={{
          gap: theme.spacing.md,
          paddingBottom: listPaddingBottom,
        }}
        renderItem={renderItem}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <AppText variant="body" color="mutedText">Записей пока нет.</AppText>
            <View style={{ marginTop: theme.spacing.md, width: 240 }}>
              <AppButton title="Добавить запись" onPress={() => router.push('/diary/create' as any)} />
            </View>
          </View>
        }
        refreshing={loading}
        onRefresh={loadEntries}
      />
      <AppFAB icon="plus" onPress={() => router.push('/diary/create' as any)} />
      {error ? (
        <View style={{ paddingBottom: pad.vertical }}>
          <AppCard variant="surface2">
            <AppText variant="body" color="danger" style={{ textAlign: 'center' }}>{error}</AppText>
          </AppCard>
        </View>
      ) : null}
    </View>
  );
}
