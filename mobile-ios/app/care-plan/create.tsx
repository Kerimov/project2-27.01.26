import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { useRouter } from 'expo-router';

import { createCarePlanTask } from '../../api/care-plan';
import { useAppTheme } from '@/design/tokens';
import { AppScreen } from '@/components/ui/AppScreen';
import { AppCard } from '@/components/ui/AppCard';
import { AppInput } from '@/components/ui/AppInput';
import { AppButton } from '@/components/ui/AppButton';

export default function CreateCarePlanTaskScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(false);

  const onSave = async () => {
    if (!title.trim()) {
      Alert.alert('Ошибка', 'Укажите название задачи');
      return;
    }
    try {
      setLoading(true);
      await createCarePlanTask(title.trim(), {
        description: description.trim() || undefined,
        dueAt: dueDate.trim() ? new Date(`${dueDate.trim()}T12:00:00`).toISOString() : undefined,
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
      <AppCard style={{ gap: theme.spacing.md, padding: theme.spacing.lg }}>
        <AppInput label="Задача" value={title} onChangeText={setTitle} />
        <AppInput label="Описание" value={description} onChangeText={setDescription} multiline />
        <AppInput label="Срок (ГГГГ-ММ-ДД)" value={dueDate} onChangeText={setDueDate} />
        <View style={{ gap: 8 }}>
          <AppButton title="Добавить" loading={loading} onPress={onSave} fullWidth />
          <AppButton title="Отмена" variant="secondary" onPress={() => router.back()} fullWidth />
        </View>
      </AppCard>
    </AppScreen>
  );
}
