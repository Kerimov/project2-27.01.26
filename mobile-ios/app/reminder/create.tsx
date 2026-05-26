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
import { AppDateField } from '@/components/ui/AppDateField';
import { AppTimeField } from '@/components/ui/AppTimeField';
import { toIsoDate } from '@/lib/date-picker-format';
import { AppButton } from '@/components/ui/AppButton';
import { AppText } from '@/components/ui/AppText';
import {
  buildDueAtFromForm,
  promptAddToPhoneAfterReminderSaved,
} from '../../lib/phone-reminders';

export default function CreateReminderScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { selectedPatientId } = useCaretakerStore();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState(() => toIsoDate(new Date()));
  const [dueTime, setDueTime] = useState('09:00');
  const [loading, setLoading] = useState(false);

  const finish = () => router.back();

  const onSave = async () => {
    if (!title.trim()) {
      Alert.alert('Ошибка', 'Укажите название');
      return;
    }
    const dueAtDate = buildDueAtFromForm(dueDate, dueTime);
    const dueAt = dueAtDate.toISOString();
    try {
      setLoading(true);
      await createReminder(title.trim(), dueAt, {
        description: description.trim() || undefined,
        patientId: selectedPatientId || undefined,
        channels: ['PUSH'],
      });

      promptAddToPhoneAfterReminderSaved(
        {
          title: title.trim(),
          notes: description.trim() || undefined,
          dueAt: dueAtDate,
        },
        finish
      );
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
        <AppText variant="caption" color="mutedText">
          После сохранения мы предложим перенести напоминание в «Напоминания» iPhone.
        </AppText>
        <AppInput label="Название" value={title} onChangeText={setTitle} />
        <AppInput
          label="Описание"
          value={description}
          onChangeText={setDescription}
          multiline
        />
        <AppDateField label="Дата" value={dueDate} onChange={setDueDate} minimumDate={new Date()} />
        <AppTimeField label="Время" value={dueTime} onChange={setDueTime} />
        <View style={{ gap: 8 }}>
          <AppButton title="Создать" loading={loading} onPress={onSave} fullWidth />
          <AppButton title="Отмена" variant="secondary" onPress={finish} fullWidth />
        </View>
      </AppCard>
    </AppScreen>
  );
}
