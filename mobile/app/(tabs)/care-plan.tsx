import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';

import {
  getCarePlanTasks,
  updateCarePlanTask,
  deleteCarePlanTask,
  type CarePlanTask,
  type CarePlanTaskStatus,
} from '../../api/care-plan';

export default function CarePlanScreen() {
  const router = useRouter();

  const [tasks, setTasks] = useState<CarePlanTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<CarePlanTaskStatus | null>(null);

  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getCarePlanTasks(filter || undefined);
      setTasks(data);
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
          onPress: async (reason) => {
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
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.title}>{item.title}</Text>
        <View style={[styles.statusBadge, styles[`status${item.status}`]]}>
          <Text style={styles.statusText}>
            {item.status === 'ACTIVE' ? 'Активна' : item.status === 'SNOOZED' ? 'Отложена' : 'Выполнена'}
          </Text>
        </View>
      </View>
      {item.description ? <Text style={styles.description}>{item.description}</Text> : null}
      <Text style={styles.meta}>Срок: {formatDate(item.dueAt)}</Text>
      {item.snoozedUntil ? (
        <Text style={styles.meta}>Отложено до: {formatDate(item.snoozedUntil)}</Text>
      ) : null}
      {item.analysis ? (
        <TouchableOpacity
          onPress={() => router.push(`/analysis/${item.analysis!.id}` as any)}
          style={styles.link}>
          <Text style={styles.linkText}>Связанный анализ: {item.analysis.title}</Text>
        </TouchableOpacity>
      ) : null}
      {item.document ? (
        <TouchableOpacity
          onPress={() => router.push(`/document/${item.document!.id}` as any)}
          style={styles.link}>
          <Text style={styles.linkText}>Связанный документ: {item.document.fileName}</Text>
        </TouchableOpacity>
      ) : null}

      <View style={styles.actions}>
        {item.status === 'ACTIVE' && (
          <>
            <TouchableOpacity
              style={[styles.actionButton, styles.completeButton]}
              onPress={() => handleComplete(item)}>
              <Text style={styles.actionButtonText}>Выполнить</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.snoozeButton]}
              onPress={() => handleSnooze(item)}>
              <Text style={styles.actionButtonText}>Отложить</Text>
            </TouchableOpacity>
          </>
        )}
        {item.status === 'COMPLETED' && (
          <TouchableOpacity
            style={[styles.actionButton, styles.reopenButton]}
            onPress={() => handleReopen(item)}>
            <Text style={styles.actionButtonText}>Возобновить</Text>
          </TouchableOpacity>
        )}
        {item.status === 'SNOOZED' && (
          <>
            <TouchableOpacity
              style={[styles.actionButton, styles.reopenButton]}
              onPress={() => handleReopen(item)}>
              <Text style={styles.actionButtonText}>Возобновить</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.completeButton]}
              onPress={() => handleComplete(item)}>
              <Text style={styles.actionButtonText}>Выполнить</Text>
            </TouchableOpacity>
          </>
        )}
        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => handleDelete(item)}>
          <Text style={styles.actionButtonText}>Удалить</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading && !tasks.length) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.hint}>Загружаем задачи…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.filters}>
        <TouchableOpacity
          style={[styles.filterButton, filter === null && styles.filterButtonActive]}
          onPress={() => setFilter(null)}>
          <Text style={[styles.filterText, filter === null && styles.filterTextActive]}>Все</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'ACTIVE' && styles.filterButtonActive]}
          onPress={() => setFilter('ACTIVE')}>
          <Text style={[styles.filterText, filter === 'ACTIVE' && styles.filterTextActive]}>
            Активные
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'SNOOZED' && styles.filterButtonActive]}
          onPress={() => setFilter('SNOOZED')}>
          <Text style={[styles.filterText, filter === 'SNOOZED' && styles.filterTextActive]}>
            Отложенные
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'COMPLETED' && styles.filterButtonActive]}
          onPress={() => setFilter('COMPLETED')}>
          <Text style={[styles.filterText, filter === 'COMPLETED' && styles.filterTextActive]}>
            Выполненные
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={tasks}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={renderItem}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text>Задачи не найдены.</Text>
          </View>
        }
        refreshing={loading}
        onRefresh={loadTasks}
      />
      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  hint: { marginTop: 8, color: '#666' },
  error: { color: 'red', textAlign: 'center' },
  errorContainer: {
    padding: 16,
    backgroundColor: '#ffebee',
  },
  filters: {
    flexDirection: 'row',
    padding: 8,
    backgroundColor: 'white',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  filterButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginHorizontal: 4,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#0066cc',
  },
  filterText: {
    fontSize: 12,
    color: '#666',
  },
  filterTextActive: {
    color: 'white',
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  card: {
    borderRadius: 12,
    padding: 12,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusACTIVE: {
    backgroundColor: '#e3f2fd',
  },
  statusSNOOZED: {
    backgroundColor: '#fff3e0',
  },
  statusCOMPLETED: {
    backgroundColor: '#e8f5e9',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#333',
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  meta: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  link: {
    marginTop: 8,
    paddingVertical: 4,
  },
  linkText: {
    fontSize: 12,
    color: '#0066cc',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    gap: 8,
  },
  actionButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  completeButton: {
    backgroundColor: '#4caf50',
  },
  snoozeButton: {
    backgroundColor: '#ff9800',
  },
  reopenButton: {
    backgroundColor: '#2196f3',
  },
  deleteButton: {
    backgroundColor: '#f44336',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
});
