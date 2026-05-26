import React, { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getAppointments, updateAppointment, getAvailableSlots, type Appointment } from '../../api/appointments';
import { useAppTheme } from '@/design/tokens';
import { AppScreen } from '@/components/ui/AppScreen';
import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import { AppDateField } from '@/components/ui/AppDateField';
import { AppChip } from '@/components/ui/AppChip';

export default function AppointmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useAppTheme();
  const [apt, setApt] = useState<Appointment | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [slots, setSlots] = useState<{ timeString: string; time: string }[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const list = await getAppointments();
      const found = list.find((a) => a.id === id);
      setApt(found || null);
      setLoading(false);
    })();
  }, [id]);

  const loadSlots = async () => {
    if (!apt || !rescheduleDate.trim()) return;
    try {
      const res = await getAvailableSlots(apt.doctorId, rescheduleDate.trim());
      setSlots(
        res.availableSlots.filter((s) => s.available).map((s) => ({ timeString: s.timeString, time: s.time }))
      );
    } catch {
      setSlots([]);
    }
  };

  const onReschedule = async () => {
    if (!apt || !selectedSlot) return;
    try {
      await updateAppointment(apt.id, 'scheduled', selectedSlot);
      Alert.alert('Готово', 'Запись перенесена');
      router.back();
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message || 'Не удалось перенести');
    }
  };

  const onCancel = async () => {
    if (!apt) return;
    Alert.alert('Отмена', 'Отменить запись?', [
      { text: 'Нет', style: 'cancel' },
      {
        text: 'Да',
        style: 'destructive',
        onPress: async () => {
          await updateAppointment(apt.id, 'cancelled');
          router.back();
        },
      },
    ]);
  };

  if (loading || !apt) {
    return <AppText style={{ padding: 24 }}>Загрузка…</AppText>;
  }

  return (
    <AppScreen>
      <AppCard style={{ gap: 8, padding: 16 }}>
        <AppText variant="title">{apt.doctor.user.name}</AppText>
        <AppText variant="caption" color="mutedText">
          {new Date(apt.scheduledAt).toLocaleString('ru-RU')} · {apt.status}
        </AppText>
        {apt.notes ? <AppText variant="body">{apt.notes}</AppText> : null}
        <AppButton title="Анкета перед визитом" onPress={() => router.push(`/pre-visit/${apt.id}` as any)} />
        <AppButton title="Отменить запись" variant="danger" onPress={onCancel} />
      </AppCard>

      <AppCard style={{ gap: theme.spacing.md, padding: 16, marginTop: 16 }}>
        <AppText variant="h3">Перенести</AppText>
        <AppDateField
          label="Новая дата"
          value={rescheduleDate}
          onChange={setRescheduleDate}
          minimumDate={new Date()}
        />
        <AppButton title="Показать слоты" variant="secondary" onPress={loadSlots} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {slots.map((s) => (
            <AppChip
              key={s.time}
              label={s.timeString}
              tone={selectedSlot === s.time ? 'primary' : 'neutral'}
              onPress={() => setSelectedSlot(s.time)}
            />
          ))}
        </View>
        {selectedSlot ? <AppButton title="Перенести на выбранное время" onPress={onReschedule} /> : null}
      </AppCard>
    </AppScreen>
  );
}
