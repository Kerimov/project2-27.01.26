import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';

import { getDoctors, type Doctor } from '../../api/doctors';
import {
  createAppointment,
  getAvailableSlots,
  type AvailableSlot,
  type AppointmentType,
} from '../../api/appointments';
import { useAppTheme } from '@/design/tokens';
import { useBreakpoint } from '@/design/responsive';
import { AppScreen } from '@/components/ui/AppScreen';
import { AppSection } from '@/components/ui/AppSection';
import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import { AppDateField } from '@/components/ui/AppDateField';
import { parseIsoDate, toIsoDate } from '@/lib/date-picker-format';
import { AppChip } from '@/components/ui/AppChip';

export default function CreateAppointmentScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const bp = useBreakpoint();

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [appointmentType, setAppointmentType] = useState<AppointmentType>('consultation');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [creating, setCreating] = useState(false);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  useEffect(() => {
    loadDoctors();
  }, []);

  useEffect(() => {
    if (selectedDoctor) {
      loadAvailableSlots();
    }
  }, [selectedDoctor, selectedDate]);

  const loadDoctors = async () => {
    try {
      setLoading(true);
      const data = await getDoctors();
      setDoctors(data);
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message || 'Не удалось загрузить список врачей');
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableSlots = async () => {
    if (!selectedDoctor) return;
    try {
      setLoadingSlots(true);
      setAvailableSlots([]);
      const dateStr = selectedDate.toISOString().split('T')[0];
      const data = await getAvailableSlots(selectedDoctor.id, dateStr);
      setAvailableSlots(data.availableSlots.filter((slot) => slot.available));
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message || 'Не удалось загрузить доступные слоты');
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleDateChange = (iso: string) => {
    const date = parseIsoDate(iso);
    date.setHours(0, 0, 0, 0);
    setSelectedDate(date);
    setSelectedTime(null);
  };

  const handleCreate = async () => {
    if (!selectedDoctor) {
      Alert.alert('Ошибка', 'Выберите врача');
      return;
    }
    if (!selectedTime) {
      Alert.alert('Ошибка', 'Выберите время');
      return;
    }

    try {
      setCreating(true);
      const scheduledAt = new Date(selectedDate);
      const [hours, minutes] = selectedTime.split(':');
      scheduledAt.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);

      await createAppointment(selectedDoctor.id, scheduledAt.toISOString(), {
        appointmentType,
        notes: notes.trim() || undefined,
      });

      Alert.alert('Успех', 'Запись создана успешно', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message || 'Не удалось создать запись');
    } finally {
      setCreating(false);
    }
  };

  // ВСЕ хуки должны быть вызваны ДО любых условных возвратов

  if (loading) {
    return (
      <AppScreen scroll={false} contentContainerStyle={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: theme.spacing.sm }}>
        <ActivityIndicator />
        <AppText variant="caption" color="mutedText">
          Загружаем список врачей…
        </AppText>
      </AppScreen>
    );
  }

  const typeLabel = (type: AppointmentType) =>
    type === 'consultation' ? 'Консультация' : type === 'follow_up' ? 'Повторный' : 'Плановый';

  return (
    <AppScreen>
      <AppSection title="Новая запись к врачу" subtitle="Выберите врача, дату и время">
        <AppSection title="Врач" subtitle="Обязательное поле">
          <View style={{ gap: theme.spacing.sm }}>
            {doctors.length === 0 ? (
              <AppCard>
                <AppText color="mutedText">Список врачей пуст.</AppText>
              </AppCard>
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
                {doctors.map((doctor) => {
                  const isSelected = selectedDoctor?.id === doctor.id;
                  const widthStyle =
                    bp === 'phone'
                      ? { width: '100%' as const }
                      : bp === 'tablet'
                        ? { width: '48%' as const }
                        : { width: '32%' as const };
                  return (
                    <View key={doctor.id} style={widthStyle}>
                      <Pressable
                        onPress={() => {
                          setSelectedDoctor(doctor);
                          setSelectedTime(null);
                        }}>
                        <AppCard
                          variant={isSelected ? 'surface' : 'surface2'}
                          style={{
                            borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                          }}>
                          <AppText variant="bodyStrong">{doctor.name}</AppText>
                          {doctor.specialization ? (
                            <AppText variant="caption" color="mutedText" style={{ marginTop: 2 }}>
                              {doctor.specialization}
                            </AppText>
                          ) : null}
                        </AppCard>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </AppSection>

        {selectedDoctor ? (
          <>
            <AppSection title="Дата">
              <AppCard style={{ gap: theme.spacing.sm }}>
                <AppDateField
                  label="Дата приёма"
                  value={toIsoDate(selectedDate)}
                  minimumDate={today}
                  onChange={handleDateChange}
                />
              </AppCard>
            </AppSection>

            <AppSection title="Время">
              {loadingSlots ? (
                <AppCard style={{ alignItems: 'center' }}>
                  <ActivityIndicator />
                </AppCard>
              ) : availableSlots.length === 0 ? (
                <AppCard>
                  <AppText color="mutedText">Нет доступных слотов на эту дату.</AppText>
                </AppCard>
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
                  {availableSlots.map((slot) => {
                    const isSelected = selectedTime === slot.timeString;
                    return (
                      <AppButton
                        key={slot.time}
                        title={slot.timeString}
                        size="sm"
                        variant={isSelected ? 'primary' : 'secondary'}
                        onPress={() => setSelectedTime(slot.timeString)}
                      />
                    );
                  })}
                </View>
              )}
            </AppSection>

            <AppSection title="Тип приема">
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
                {(['consultation', 'follow_up', 'routine'] as AppointmentType[]).map((type) => (
                  <AppChip
                    key={type}
                    label={typeLabel(type)}
                    tone={appointmentType === type ? 'primary' : 'neutral'}
                    onPress={() => setAppointmentType(type)}
                  />
                ))}
              </View>
            </AppSection>

            <AppSection title="Заметки" subtitle="Необязательно">
              <AppInput
                placeholder="Дополнительная информация…"
                value={notes}
                onChangeText={setNotes}
                multiline
                style={{ minHeight: 96, textAlignVertical: 'top' as any }}
              />
            </AppSection>

            <AppButton
              title="Создать запись"
              fullWidth
              loading={creating}
              disabled={creating || !selectedDoctor || !selectedTime}
              onPress={handleCreate}
            />
          </>
        ) : null}
      </AppSection>
    </AppScreen>
  );
}
