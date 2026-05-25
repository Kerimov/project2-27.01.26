import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';

import {
  getAppointments,
  updateAppointment,
  type Appointment,
  type AppointmentStatus,
} from '../../api/appointments';
import { useAppTheme } from '@/design/tokens';
import { useContentPadding, useMaxContentWidth } from '@/design/responsive';
import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { AppChip } from '@/components/ui/AppChip';
import { AppButton } from '@/components/ui/AppButton';
import { AppFAB } from '@/components/ui/AppFAB';
import { AppScreen } from '@/components/ui/AppScreen';

export default function AppointmentsScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const pad = useContentPadding();
  const { maxWidth } = useMaxContentWidth();

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
    <AppCard style={{ padding: theme.spacing.lg }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <AppText variant="h3">{item.doctor.user.name}</AppText>
          {item.doctor.specialization ? (
            <AppText variant="caption" color="mutedText" style={{ marginTop: theme.spacing.xs }}>
              {item.doctor.specialization}
            </AppText>
          ) : null}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <AppChip label={getStatusText(item.status)} tone={item.status === 'confirmed' ? 'primary' : 'neutral'} />
          {item.preVisit?.submittedAt ? <AppChip label="Анкета ✓" tone="primary" /> : null}
        </View>
      </View>

      <AppText variant="bodyStrong" style={{ marginTop: theme.spacing.md }}>
        {formatDateTime(item.scheduledAt)}
      </AppText>
      {item.appointmentType ? (
        <AppText variant="caption" color="mutedText" style={{ marginTop: theme.spacing.xs }}>
          Тип: {item.appointmentType === 'consultation' ? 'Консультация' : item.appointmentType}
        </AppText>
      ) : null}
      {item.notes ? (
        <AppText variant="caption" color="mutedText" style={{ marginTop: theme.spacing.xs }}>
          Заметки: {item.notes}
        </AppText>
      ) : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: theme.spacing.lg }}>
        <AppButton
          title="Подробнее"
          size="sm"
          variant="secondary"
          onPress={() => router.push(`/appointment/${item.id}` as any)}
        />
        {item.status !== 'cancelled' && item.status !== 'completed' && new Date(item.scheduledAt) >= new Date() ? (
          <>
            {!item.preVisit?.submittedAt ? (
              <AppButton
                title="Анкета"
                size="sm"
                variant="secondary"
                onPress={() => router.push(`/pre-visit/${item.id}` as any)}
              />
            ) : null}
            <AppButton title="Отменить" size="sm" variant="danger" onPress={() => handleCancel(item)} />
          </>
        ) : null}
      </View>
    </AppCard>
  );

  if (loading && !appointments.length) {
    return (
      <AppScreen
        scroll={false}
        contentContainerStyle={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.sm }}>
        <ActivityIndicator />
        <AppText variant="caption" color="mutedText">
          Загружаем записи…
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
        <AppChip label="Все" tone={filter === 'all' ? 'primary' : 'neutral'} onPress={() => setFilter('all')} />
        <AppChip label="Предстоящие" tone={filter === 'upcoming' ? 'primary' : 'neutral'} onPress={() => setFilter('upcoming')} />
        <AppChip label="Прошедшие" tone={filter === 'past' ? 'primary' : 'neutral'} onPress={() => setFilter('past')} />
      </View>
      <FlatList
        data={appointments}
        keyExtractor={(item) => item.id}
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingVertical: theme.spacing.sm,
          gap: theme.spacing.md,
          paddingBottom: pad.vertical + 96,
        }}
        renderItem={renderItem}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <AppText variant="body" color="mutedText">
              Записи не найдены.
            </AppText>
            <View style={{ marginTop: theme.spacing.md, width: 240 }}>
              <AppButton title="Создать запись" onPress={() => router.push('/appointment/create' as any)} />
            </View>
          </View>
        }
        refreshing={loading}
        onRefresh={loadAppointments}
      />
      <AppFAB icon="plus" onPress={() => router.push('/appointment/create' as any)} />
      {error ? (
        <View style={{ paddingBottom: pad.vertical }}>
          <AppCard variant="surface2">
            <AppText variant="body" color="danger" style={{ textAlign: 'center' }}>
              {error}
            </AppText>
          </AppCard>
        </View>
      ) : null}
    </AppScreen>
  );
}
