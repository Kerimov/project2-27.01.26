import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { useRouter } from 'expo-router';

import { createCarePlanTask } from '../../api/care-plan';
import { createReminder } from '../../api/reminders';
import { useCaretakerStore } from '../../state/caretakerStore';
import { useAppTheme } from '@/design/tokens';
import { AppScreen } from '@/components/ui/AppScreen';
import { AppCard } from '@/components/ui/AppCard';
import { AppInput } from '@/components/ui/AppInput';
import { AppButton } from '@/components/ui/AppButton';
import { AppText } from '@/components/ui/AppText';
import { promptAddReminderForCarePlanTask } from '../../lib/phone-reminders';

export default function CreateCarePlanTaskScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { selectedPatientId } = useCaretakerStore();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('09:00');
  const [loading, setLoading] = useState(false);

  const finish = () => router.back();

  const onSave = async () => {
    if (!title.trim()) {
      Alert.alert('Ошибка', 'Укажите название задачи');
      return;
    }

    const dueAtIso = dueDate.trim()
      ? new Date(`${dueDate.trim()}T${dueTime.trim() || '09:00'}:00`).toISOString()
      : undefined;

    try {
      setLoading(true);
      await createCarePlanTask(title.trim(), {
        description: description.trim() || undefined,
        dueAt: dueAtIso,
      });

      promptAddReminderForCarePlanTask(
        {
          title: title.trim(),
          description: description.trim() || undefined,
          dueAt: dueAtIso ?? null,
          createAppReminder: async () => {
            const due =
              dueAtIso ||
              (() => {
                const d = new Date();
                d.setDate(d.getDate() + 1);
                d.setHours(9, 0, 0, 0);
                return d.toISOString();
              })();
            await createReminder(`Задача: ${title.trim()}`, due, {
              description: description.trim() || `Напоминание к задаче плана`,
              patientId: selectedPatientId || undefined,
              channels: ['PUSH'],
            });
          },
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
      <AppCard style={{ gap: theme.spacing.md, padding: theme.spacing.lg }}>
        <AppText variant="caption" color="mutedText">
          После добавления задачи мы предложим создать напоминание и перенести его в «Напоминания» iPhone.
        </AppText>
        <AppInput label="Задача" value={title} onChangeText={setTitle} />
        <AppInput label="Описание" value={description} onChangeText={setDescription} multiline />
        <AppInput label="Срок — дата (ГГГГ-ММ-ДД)" value={dueDate} onChangeText={setDueDate} placeholder="2026-06-01" />
        <AppInput label="Срок — время (ЧЧ:ММ)" value={dueTime} onChangeText={setDueTime} />
        <View style={{ gap: 8 }}>
          <AppButton title="Добавить" loading={loading} onPress={onSave} fullWidth />
          <AppButton title="Отмена" variant="secondary" onPress={finish} fullWidth />
        </View>
      </AppCard>
    </AppScreen>
  );
}
