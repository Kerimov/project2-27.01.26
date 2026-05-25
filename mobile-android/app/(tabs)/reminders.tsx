import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, View } from 'react-native';
import { useRouter } from 'expo-router';

import {
  getReminders,
  deleteReminder,
  type Reminder,
} from '../../api/reminders';
import { useCaretakerStore } from '../../state/caretakerStore';
import { PatientSwitcher } from '../../components/PatientSwitcher';
import { useAppTheme } from '@/design/tokens';
import { useContentPadding } from '@/design/responsive';
import { useFloatingTabBarInsets } from '@/design/tab-bar';
import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { AppButton } from '@/components/ui/AppButton';
import { AppFAB } from '@/components/ui/AppFAB';
import { AppScreen } from '@/components/ui/AppScreen';

export default function RemindersScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const pad = useContentPadding();
  const { listPaddingBottom } = useFloatingTabBarInsets();
  const { selectedPatientId } = useCaretakerStore();

  const [items, setItems] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getReminders(selectedPatientId || undefined);
      setItems(
        data.sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
      );
    } catch (e: any) {
      setError(e?.message || 'Не удалось загрузить напоминания');
    } finally {
      setLoading(false);
    }
  }, [selectedPatientId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = (item: Reminder) => {
    Alert.alert('Удалить', `Удалить «${item.title}»?`, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteReminder(item.id, selectedPatientId || undefined);
            await load();
          } catch (e: any) {
            Alert.alert('Ошибка', e?.message || 'Не удалось удалить');
          }
        },
      },
    ]);
  };

  const formatDue = (iso: string) =>
    new Date(iso).toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

  if (loading && !items.length) {
    return (
      <AppScreen scroll={false} contentContainerStyle={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator />
      </AppScreen>
    );
  }

  return (
    <AppScreen scroll={false} contentContainerStyle={{ flex: 1 }}>
      <PatientSwitcher />
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: listPaddingBottom, gap: theme.spacing.md }}
        refreshing={loading}
        onRefresh={load}
        renderItem={({ item }) => (
          <AppCard style={{ padding: theme.spacing.lg }}>
            <AppText variant="h3">{item.title}</AppText>
            {item.description ? (
              <AppText variant="caption" color="mutedText" style={{ marginTop: 4 }}>
                {item.description}
              </AppText>
            ) : null}
            <AppText variant="caption" color="mutedText" style={{ marginTop: 8 }}>
              {formatDue(item.dueAt)}
              {item.recurrence !== 'NONE' ? ` · ${item.recurrence}` : ''}
            </AppText>
            <View style={{ marginTop: theme.spacing.md }}>
              <AppButton title="Удалить" size="sm" variant="danger" onPress={() => handleDelete(item)} />
            </View>
          </AppCard>
        )}
        ListEmptyComponent={
          <AppText variant="body" color="mutedText" style={{ textAlign: 'center', padding: 24 }}>
            Напоминаний пока нет
          </AppText>
        }
      />
      {error ? (
        <AppText variant="caption" color="danger" style={{ textAlign: 'center' }}>
          {error}
        </AppText>
      ) : null}
      <AppFAB onPress={() => router.push('/reminder/create' as any)} />
    </AppScreen>
  );
}
