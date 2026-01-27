import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';

import { getDoctors, type Doctor } from '../../api/doctors';
import {
  createAppointment,
  getAvailableSlots,
  type AvailableSlot,
  type AppointmentType,
} from '../../api/appointments';

export default function CreateAppointmentScreen() {
  const router = useRouter();

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
  const [showDateModal, setShowDateModal] = useState(false);
  const [tempDate, setTempDate] = useState<string>('');

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
      const dateStr = selectedDate.toISOString().split('T')[0];
      const data = await getAvailableSlots(selectedDoctor.id, dateStr);
      setAvailableSlots(data.availableSlots.filter((slot) => slot.available));
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message || 'Не удалось загрузить доступные слоты');
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleDateSelect = () => {
    if (!tempDate) {
      Alert.alert('Ошибка', 'Введите дату в формате ДД.ММ.ГГГГ');
      return;
    }
    const [day, month, year] = tempDate.split('.');
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
    if (isNaN(date.getTime())) {
      Alert.alert('Ошибка', 'Некорректная дата');
      return;
    }
    if (date < new Date()) {
      Alert.alert('Ошибка', 'Дата не может быть в прошлом');
      return;
    }
    setSelectedDate(date);
    setSelectedTime(null);
    setShowDateModal(false);
    setTempDate('');
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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.hint}>Загружаем список врачей…</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Новая запись к врачу</Text>

      <View style={styles.section}>
        <Text style={styles.label}>Врач *</Text>
        {doctors.map((doctor) => (
          <TouchableOpacity
            key={doctor.id}
            style={[
              styles.doctorCard,
              selectedDoctor?.id === doctor.id && styles.doctorCardSelected,
            ]}
            onPress={() => {
              setSelectedDoctor(doctor);
              setSelectedTime(null);
            }}>
            <Text style={styles.doctorName}>{doctor.name}</Text>
            {doctor.specialization ? (
              <Text style={styles.doctorSpecialization}>{doctor.specialization}</Text>
            ) : null}
          </TouchableOpacity>
        ))}
      </View>

      {selectedDoctor && (
        <>
          <View style={styles.section}>
            <Text style={styles.label}>Дата *</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => {
                setTempDate(selectedDate.toLocaleDateString('ru-RU'));
                setShowDateModal(true);
              }}>
              <Text style={styles.dateButtonText}>
                {selectedDate.toLocaleDateString('ru-RU')}
              </Text>
            </TouchableOpacity>
            <Modal visible={showDateModal} transparent animationType="slide">
              <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>Выберите дату</Text>
                  <Text style={styles.modalHint}>Формат: ДД.ММ.ГГГГ (например, 15.02.2026)</Text>
                  <TextInput
                    style={styles.dateInput}
                    placeholder="ДД.ММ.ГГГГ"
                    value={tempDate}
                    onChangeText={setTempDate}
                    keyboardType="numeric"
                  />
                  <View style={styles.modalActions}>
                    <TouchableOpacity
                      style={[styles.modalButton, styles.modalButtonCancel]}
                      onPress={() => {
                        setShowDateModal(false);
                        setTempDate('');
                      }}>
                      <Text style={styles.modalButtonText}>Отмена</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalButton, styles.modalButtonConfirm]}
                      onPress={handleDateSelect}>
                      <Text style={[styles.modalButtonText, styles.modalButtonTextConfirm]}>
                        Выбрать
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Время *</Text>
            {loadingSlots ? (
              <ActivityIndicator />
            ) : availableSlots.length === 0 ? (
              <Text style={styles.hint}>Нет доступных слотов на эту дату</Text>
            ) : (
              <View style={styles.slotsGrid}>
                {availableSlots.map((slot) => (
                  <TouchableOpacity
                    key={slot.time}
                    style={[
                      styles.slotButton,
                      selectedTime === slot.timeString && styles.slotButtonSelected,
                    ]}
                    onPress={() => setSelectedTime(slot.timeString)}>
                    <Text
                      style={[
                        styles.slotButtonText,
                        selectedTime === slot.timeString && styles.slotButtonTextSelected,
                      ]}>
                      {slot.timeString}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Тип приема</Text>
            <View style={styles.typeButtons}>
              {(['consultation', 'follow_up', 'routine'] as AppointmentType[]).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.typeButton,
                    appointmentType === type && styles.typeButtonSelected,
                  ]}
                  onPress={() => setAppointmentType(type)}>
                  <Text
                    style={[
                      styles.typeButtonText,
                      appointmentType === type && styles.typeButtonTextSelected,
                    ]}>
                    {type === 'consultation'
                      ? 'Консультация'
                      : type === 'follow_up'
                      ? 'Повторный'
                      : 'Плановый'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Заметки (необязательно)</Text>
            <TextInput
              style={styles.notesInput}
              multiline
              numberOfLines={4}
              placeholder="Дополнительная информация..."
              value={notes}
              onChangeText={setNotes}
            />
          </View>

          <TouchableOpacity
            style={[styles.createButton, creating && styles.createButtonDisabled]}
            onPress={handleCreate}
            disabled={creating || !selectedDoctor || !selectedTime}>
            {creating ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.createButtonText}>Создать запись</Text>
            )}
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 16,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  section: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  hint: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
  },
  doctorCard: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  doctorCardSelected: {
    borderColor: '#0066cc',
    backgroundColor: '#e3f2fd',
  },
  doctorName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  doctorSpecialization: {
    fontSize: 12,
    color: '#666',
  },
  dateButton: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  dateButtonText: {
    fontSize: 16,
    color: '#333',
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  slotButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  slotButtonSelected: {
    backgroundColor: '#0066cc',
    borderColor: '#0066cc',
  },
  slotButtonText: {
    fontSize: 14,
    color: '#333',
  },
  slotButtonTextSelected: {
    color: 'white',
    fontWeight: '600',
  },
  typeButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  typeButtonSelected: {
    backgroundColor: '#0066cc',
    borderColor: '#0066cc',
  },
  typeButtonText: {
    fontSize: 12,
    color: '#333',
  },
  typeButtonTextSelected: {
    color: 'white',
    fontWeight: '600',
  },
  notesInput: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    fontSize: 14,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  createButton: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#0066cc',
    alignItems: 'center',
    marginTop: 8,
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '80%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  modalHint: {
    fontSize: 12,
    color: '#666',
    marginBottom: 12,
  },
  dateInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#f5f5f5',
  },
  modalButtonConfirm: {
    backgroundColor: '#0066cc',
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  modalButtonTextConfirm: {
    color: 'white',
  },
});
