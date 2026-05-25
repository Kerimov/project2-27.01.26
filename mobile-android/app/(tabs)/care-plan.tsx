import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';

import {
  getCarePlanTasks,
  updateCarePlanTask,
  deleteCarePlanTask,
  getPendingApprovals,
  decideApproval,
  type CarePlanTask,
  type CarePlanTaskStatus,
  type PendingApprovalTask,
} from '../../api/care-plan';
import { useAppTheme } from '@/design/tokens';
import { useContentPadding, useMaxContentWidth } from '@/design/responsive';
import { useFloatingTabBarInsets } from '@/design/tab-bar';
import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { AppChip } from '@/components/ui/AppChip';
import { AppButton } from '@/components/ui/AppButton';
import { AppFAB } from '@/components/ui/AppFAB';
import { AppScreen } from '@/components/ui/AppScreen';

export default function CarePlanScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const pad = useContentPadding();
  const { listPaddingBottom } = useFloatingTabBarInsets();
  const { maxWidth } = useMaxContentWidth();

  const [tasks, setTasks] = useState<CarePlanTask[]>([]);
  const [pending, setPending] = useState<PendingApprovalTask[]>([]);
  const [busyApprovalId, setBusyApprovalId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<CarePlanTaskStatus | null>(null);

  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [data, approvals] = await Promise.all([
        getCarePlanTasks(filter || undefined, true),
        getPendingApprovals().catch(() => []),
      ]);
      setTasks(data);
      setPending(approvals);
    } catch (e: any) {
      setError(e?.message || 'Не удалось загрузить задачи');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleComplete = async (task: CarePlanTask) => {
    try {
      await updateCarePlanTask(task.id, 'complete');
      Alert.alert('Успех', 'Задача выполнена');
      await loadTasks();
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message || 'Не удалось обновить задачу');
    }
  };

  const handleSnooze = async (task: CarePlanTask) => {
    Alert.prompt(
      'Отложить задачу',
      'Укажите причину отложения (минимум 3 символа):',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Отложить',
          onPress: async (reason?: string) => {
            if (!reason || reason.trim().length < 3) {
              Alert.alert('Ошибка', 'Причина должна содержать минимум 3 символа');
              return;
            }
            try {
              const snoozedUntil = new Date();
              snoozedUntil.setDate(snoozedUntil.getDate() + 1); // Отложить на день
              await updateCarePlanTask(task.id, 'snooze', {
                reason: reason.trim(),
                snoozedUntil: snoozedUntil.toISOString(),
              });
              Alert.alert('Успех', 'Задача отложена');
              await loadTasks();
            } catch (e: any) {
              Alert.alert('Ошибка', e?.message || 'Не удалось отложить задачу');
            }
          },
        },
      ],
      'plain-text'
    );
  };

  const handleReopen = async (task: CarePlanTask) => {
    try {
      await updateCarePlanTask(task.id, 'reopen');
      Alert.alert('Успех', 'Задача возобновлена');
      await loadTasks();
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message || 'Не удалось возобновить задачу');
    }
  };

  const handleApproval = async (taskId: string, decision: 'approve' | 'reject', reason?: string) => {
    try {
      setBusyApprovalId(taskId);
      await decideApproval(taskId, decision, reason);
      Alert.alert('Готово', decision === 'approve' ? 'План принят' : 'План отклонён');
      await loadTasks();
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message || 'Не удалось обработать');
    } finally {
      setBusyApprovalId(null);
    }
  };

  const handleDelete = async (task: CarePlanTask) => {
    Alert.alert(
      'Удалить задачу',
      `Вы уверены, что хотите удалить задачу "${task.title}"?`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCarePlanTask(task.id);
              Alert.alert('Успех', 'Задача удалена');
              await loadTasks();
            } catch (e: any) {
              Alert.alert('Ошибка', e?.message || 'Не удалось удалить задачу');
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return 'Без срока';
    return new Date(dateStr).toLocaleDateString();
  };

  const renderItem = ({ item }: { item: CarePlanTask }) => (
    <AppCard style={{ padding: theme.spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <AppText variant="h3">{item.title}</AppText>
          {item.description ? (
            <AppText variant="body" color="mutedText" style={{ marginTop: theme.spacing.xs }}>
              {item.description}
            </AppText>
          ) : null}
        </View>
        <AppChip
          label={item.status === 'ACTIVE' ? 'Активна' : item.status === 'SNOOZED' ? 'Отложена' : 'Выполнена'}
          tone={item.status === 'ACTIVE' ? 'primary' : 'neutral'}
        />
      </View>

      <View style={{ marginTop: theme.spacing.md, gap: 4 }}>
        <AppText variant="caption" color="mutedText">
          Срок: {formatDate(item.dueAt)}
        </AppText>
        {item.snoozedUntil ? (
          <AppText variant="caption" color="mutedText">
            Отложено до: {formatDate(item.snoozedUntil)}
          </AppText>
        ) : null}
      </View>

      {item.analysis ? (
        <Pressable onPress={() => item.analysis && router.push(`/analysis/${item.analysis.id}` as any)} style={{ marginTop: theme.spacing.md }}>
          {({ pressed }) => (
            <AppText variant="caption" color="primary" style={{ opacity: pressed ? 0.8 : 1 }}>
              Связанный анализ: {item.analysis?.title}
            </AppText>
          )}
        </Pressable>
      ) : null}
      {item.document ? (
        <Pressable onPress={() => item.document && router.push(`/document/${item.document.id}` as any)} style={{ marginTop: 6 }}>
          {({ pressed }) => (
            <AppText variant="caption" color="primary" style={{ opacity: pressed ? 0.8 : 1 }}>
              Связанный документ: {item.document?.fileName}
            </AppText>
          )}
        </Pressable>
      ) : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: theme.spacing.lg }}>
        {item.status === 'ACTIVE' ? (
          <>
            <AppButton title="Выполнить" size="sm" onPress={() => handleComplete(item)} />
            <AppButton title="Отложить" size="sm" variant="secondary" onPress={() => handleSnooze(item)} />
          </>
        ) : null}
        {item.status === 'COMPLETED' ? (
          <AppButton title="Возобновить" size="sm" variant="secondary" onPress={() => handleReopen(item)} />
        ) : null}
        {item.status === 'SNOOZED' ? (
          <>
            <AppButton title="Возобновить" size="sm" variant="secondary" onPress={() => handleReopen(item)} />
            <AppButton title="Выполнить" size="sm" onPress={() => handleComplete(item)} />
          </>
        ) : null}
        <AppButton title="Удалить" size="sm" variant="danger" onPress={() => handleDelete(item)} />
      </View>
    </AppCard>
  );

  if (loading && !tasks.length) {
    return (
      <AppScreen
        scroll={false}
        contentContainerStyle={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.sm }}>
        <ActivityIndicator />
        <AppText variant="caption" color="mutedText">
          Загружаем задачи…
        </AppText>
      </AppScreen>
    );
  }

  return (
    <AppScreen scroll={false} contentContainerStyle={{ flex: 1 }}>
      <View
        style={{
          paddingBottom: theme.spacing.sm,
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 8,
        }}>
        <AppChip label="Все" tone={filter === null ? 'primary' : 'neutral'} onPress={() => setFilter(null)} />
        <AppChip label="Активные" tone={filter === 'ACTIVE' ? 'primary' : 'neutral'} onPress={() => setFilter('ACTIVE')} />
        <AppChip label="Отложенные" tone={filter === 'SNOOZED' ? 'primary' : 'neutral'} onPress={() => setFilter('SNOOZED')} />
        <AppChip label="Выполненные" tone={filter === 'COMPLETED' ? 'primary' : 'neutral'} onPress={() => setFilter('COMPLETED')} />
      </View>

      <FlatList
        data={tasks}
        keyExtractor={(item) => item.id}
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingVertical: theme.spacing.sm,
          gap: theme.spacing.md,
          paddingBottom: listPaddingBottom,
        }}
        ListHeaderComponent={
          pending.length > 0 ? (
            <View style={{ gap: theme.spacing.sm, marginBottom: theme.spacing.md }}>
              <AppText variant="h3">Согласование от врача</AppText>
              {pending.map((p) => (
                <AppCard key={p.id} style={{ padding: theme.spacing.lg, gap: 8 }}>
                  <AppText variant="bodyStrong">{p.title}</AppText>
                  {p.doctorName ? (
                    <AppText variant="caption" color="mutedText">
                      Доктор: {p.doctorName}
                    </AppText>
                  ) : null}
                  {p.description ? (
                    <AppText variant="caption" color="mutedText">
                      {p.description}
                    </AppText>
                  ) : null}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                    <AppButton
                      title="Принять"
                      size="sm"
                      disabled={busyApprovalId === p.id}
                      onPress={() => handleApproval(p.id, 'approve')}
                    />
                    <AppButton
                      title="Отклонить"
                      size="sm"
                      variant="secondary"
                      disabled={busyApprovalId === p.id}
                      onPress={() => {
                        Alert.prompt('Отклонение', 'Причина (мин. 3 символа)', [
                          { text: 'Отмена', style: 'cancel' },
                          {
                            text: 'Отклонить',
                            style: 'destructive',
                            onPress: (reason?: string) => {
                              if (!reason || reason.trim().length < 3) {
                                Alert.alert('Ошибка', 'Укажите причину');
                                return;
                              }
                              handleApproval(p.id, 'reject', reason.trim());
                            },
                          },
                        ]);
                      }}
                    />
                  </View>
                </AppCard>
              ))}
            </View>
          ) : null
        }
        renderItem={renderItem}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <AppText variant="body" color="mutedText">
              Задачи не найдены.
            </AppText>
          </View>
        }
        refreshing={loading}
        onRefresh={loadTasks}
      />
      {error ? (
        <View style={{ paddingBottom: pad.vertical }}>
          <AppCard variant="surface2">
            <AppText variant="body" color="danger" style={{ textAlign: 'center' }}>
              {error}
            </AppText>
          </AppCard>
        </View>
      ) : null}
      <AppFAB icon="plus" onPress={() => router.push('/care-plan/create' as any)} />
    </AppScreen>
  );
}
