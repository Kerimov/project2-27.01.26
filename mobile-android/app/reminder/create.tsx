import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { useRouter } from 'expo-router';

import { createReminder } from '../../api/reminders';
import { useCaretakerStore } from '../../state/caretakerStore';
import { PatientSwitcher } from '../../components/PatientSwitcher';
import { useAppTheme } from '@/design/tokens';
import { AppScreen } from '@/components/ui/AppScreen';
import { AppCard } from '@/components/ui/AppCard';
import { AppInput } from '@/components/ui/AppInput';
import { AppButton } from '@/components/ui/AppButton';

export default function CreateReminderScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { selectedPatientId } = useCaretakerStore();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('09:00');
  const [loading, setLoading] = useState(false);

  const onSave = async () => {
    if (!title.trim()) {
      Alert.alert('Ошибка', 'Укажите название');
      return;
    }
    const datePart = dueDate.trim() || new Date().toISOString().slice(0, 10);
    const dueAt = new Date(`${datePart}T${dueTime || '09:00'}:00`).toISOString();
    try {
      setLoading(true);
      await createReminder(title.trim(), dueAt, {
        description: description.trim() || undefined,
        patientId: selectedPatientId || undefined,
        channels: ['PUSH'],
      });
      router.back();
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message || 'Не удалось создать');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppScreen>
      <PatientSwitcher />
      <AppCard style={{ gap: theme.spacing.md, padding: theme.spacing.lg }}>
        <AppInput label="Название" value={title} onChangeText={setTitle} />
        <AppInput
          label="Описание"
          value={description}
          onChangeText={setDescription}
          multiline
        />
        <AppInput label="Дата (ГГГГ-ММ-ДД)" value={dueDate} onChangeText={setDueDate} placeholder="2026-05-26" />
        <AppInput label="Время (ЧЧ:ММ)" value={dueTime} onChangeText={setDueTime} />
        <View style={{ gap: 8 }}>
          <AppButton title="Создать" loading={loading} onPress={onSave} fullWidth />
          <AppButton title="Отмена" variant="secondary" onPress={() => router.back()} fullWidth />
        </View>
      </AppCard>
    </AppScreen>
  );
}
