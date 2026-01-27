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
  getAppointments,
  updateAppointment,
  type Appointment,
  type AppointmentStatus,
} from '../../api/appointments';

export default function AppointmentsScreen() {
  const router = useRouter();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('upcoming');

  const loadAppointments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAppointments();
      
      // Фильтруем по статусу
      let filtered = data;
      if (filter === 'upcoming') {
        const now = new Date();
        filtered = data.filter(
          (apt) => new Date(apt.scheduledAt) >= now && apt.status !== 'cancelled'
        );
      } else if (filter === 'past') {
        const now = new Date();
        filtered = data.filter(
          (apt) => new Date(apt.scheduledAt) < now || apt.status === 'completed'
        );
      }
      
      // Сортируем: предстоящие по дате возрастания, прошедшие по убыванию
      filtered.sort((a, b) => {
        const dateA = new Date(a.scheduledAt).getTime();
        const dateB = new Date(b.scheduledAt).getTime();
        return filter === 'upcoming' ? dateA - dateB : dateB - dateA;
      });
      
      setAppointments(filtered);
    } catch (e: any) {
      setError(e?.message || 'Не удалось загрузить записи');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  const handleCancel = async (appointment: Appointment) => {
    Alert.alert(
      'Отменить запись',
      `Вы уверены, что хотите отменить запись к ${appointment.doctor.user.name}?`,
      [
        { text: 'Нет', style: 'cancel' },
        {
          text: 'Да, отменить',
          style: 'destructive',
          onPress: async () => {
            try {
              await updateAppointment(appointment.id, 'cancelled');
              Alert.alert('Успех', 'Запись отменена');
              await loadAppointments();
            } catch (e: any) {
              Alert.alert('Ошибка', e?.message || 'Не удалось отменить запись');
            }
          },
        },
      ]
    );
  };

  const formatDateTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    return `${date.toLocaleDateString('ru-RU')} в ${date.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  };

  const getStatusText = (status: AppointmentStatus): string => {
    const statusMap: Record<AppointmentStatus, string> = {
      scheduled: 'Запланирована',
      confirmed: 'Подтверждена',
      completed: 'Завершена',
      cancelled: 'Отменена',
      no_show: 'Не явился',
    };
    return statusMap[status] || status;
  };

  const getStatusColor = (status: AppointmentStatus): string => {
    const colorMap: Record<AppointmentStatus, string> = {
      scheduled: '#2196f3',
      confirmed: '#4caf50',
      completed: '#9e9e9e',
      cancelled: '#f44336',
      no_show: '#ff9800',
    };
    return colorMap[status] || '#666';
  };

  const renderItem = ({ item }: { item: Appointment }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.doctorInfo}>
          <Text style={styles.doctorName}>{item.doctor.user.name}</Text>
          {item.doctor.specialization ? (
            <Text style={styles.specialization}>{item.doctor.specialization}</Text>
          ) : null}
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
        </View>
      </View>
      <Text style={styles.dateTime}>{formatDateTime(item.scheduledAt)}</Text>
      {item.appointmentType ? (
        <Text style={styles.type}>
          Тип: {item.appointmentType === 'consultation' ? 'Консультация' : item.appointmentType}
        </Text>
      ) : null}
      {item.notes ? <Text style={styles.notes}>Заметки: {item.notes}</Text> : null}
      {item.preVisit && item.preVisit.submittedAt ? (
        <Text style={styles.preVisit}>✓ Анкета заполнена</Text>
      ) : null}

      {item.status !== 'cancelled' &&
        item.status !== 'completed' &&
        new Date(item.scheduledAt) >= new Date() && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.cancelButton]}
              onPress={() => handleCancel(item)}>
              <Text style={styles.actionButtonText}>Отменить</Text>
            </TouchableOpacity>
          </View>
        )}
    </View>
  );

  if (loading && !appointments.length) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.hint}>Загружаем записи…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.filters}>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}
          onPress={() => setFilter('all')}>
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
            Все
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'upcoming' && styles.filterButtonActive]}
          onPress={() => setFilter('upcoming')}>
          <Text style={[styles.filterText, filter === 'upcoming' && styles.filterTextActive]}>
            Предстоящие
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'past' && styles.filterButtonActive]}
          onPress={() => setFilter('past')}>
          <Text style={[styles.filterText, filter === 'past' && styles.filterTextActive]}>
            Прошедшие
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={appointments}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={renderItem}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text>Записи не найдены.</Text>
            <TouchableOpacity
              style={styles.createButton}
              onPress={() => router.push('/appointment/create' as any)}>
              <Text style={styles.createButtonText}>Создать запись</Text>
            </TouchableOpacity>
          </View>
        }
        refreshing={loading}
        onRefresh={loadAppointments}
      />
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/appointment/create' as any)}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
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
    paddingBottom: 80,
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
  doctorInfo: {
    flex: 1,
  },
  doctorName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  specialization: {
    fontSize: 12,
    color: '#666',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'white',
  },
  dateTime: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  type: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  notes: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
    fontStyle: 'italic',
  },
  preVisit: {
    fontSize: 12,
    color: '#4caf50',
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  actionButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  cancelButton: {
    backgroundColor: '#f44336',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0066cc',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  fabText: {
    fontSize: 32,
    color: 'white',
    fontWeight: '300',
  },
  createButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#0066cc',
    borderRadius: 8,
  },
  createButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
