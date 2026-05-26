import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { useRouter } from 'expo-router';
 
import { createMedication, type CreateMedicationData } from '../../api/medications';
import { setAuthToken } from '../../api/client';
import { useAuthStore } from '../../state/authStore';
 
import { useAppTheme } from '@/design/tokens';
import { useBreakpoint } from '@/design/responsive';
import { AppScreen } from '@/components/ui/AppScreen';
import { AppSection } from '@/components/ui/AppSection';
import { AppCard } from '@/components/ui/AppCard';
import { AppInput } from '@/components/ui/AppInput';
import { AppDateField } from '@/components/ui/AppDateField';
import { AppButton } from '@/components/ui/AppButton';
import { AppChip } from '@/components/ui/AppChip';
 
export default function CreateMedicationScreen() {
  const router = useRouter();
  const { token } = useAuthStore();
  const theme = useAppTheme();
  const bp = useBreakpoint();
 
  const [form, setForm] = useState({
    name: '',
    dosage: '',
    form: '',
    route: '',
    frequencyPerDay: '1',
    times: '',
    startDate: '',
    endDate: '',
    notes: '',
    isSupplement: false,
  });
  const [creating, setCreating] = useState(false);
 
  const handleCreate = async () => {
    if (!form.name.trim()) {
      Alert.alert('Ошибка', 'Введите название лекарства');
      return;
    }
    if (!token) {
      Alert.alert('Ошибка', 'Необходима авторизация');
      return;
    }
 
    try {
      setCreating(true);
      setAuthToken(token);
 
      const times = form.times.split(',').map((s) => s.trim()).filter(Boolean);
 
      const medicationData: CreateMedicationData = {
        name: form.name.trim(),
        dosage: form.dosage.trim() || undefined,
        form: form.form.trim() || undefined,
        route: form.route.trim() || undefined,
        frequencyPerDay: form.frequencyPerDay ? parseInt(form.frequencyPerDay, 10) : undefined,
        times: times.length > 0 ? times : undefined,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
        notes: form.notes.trim() || undefined,
        isSupplement: form.isSupplement,
      };
 
      await createMedication(medicationData);
      Alert.alert('Успех', 'Лекарство добавлено', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message || 'Не удалось добавить лекарство');
    } finally {
      setCreating(false);
    }
  };
 
  return (
    <AppScreen>
      <AppSection title="Новое лекарство" subtitle="Добавьте препарат или БАД">
        <AppCard>
          <View style={{ gap: theme.spacing.md }}>
            <AppInput
              label="Название *"
              placeholder="Например: Аспирин"
              value={form.name}
              onChangeText={(text) => setForm({ ...form, name: text })}
            />
            <AppInput
              label="Дозировка"
              placeholder="Например: 100 мг"
              value={form.dosage}
              onChangeText={(text) => setForm({ ...form, dosage: text })}
            />
 
            <View style={{ flexDirection: bp === 'phone' ? 'column' : 'row', gap: theme.spacing.md }}>
              <AppInput
                label="Форма"
                placeholder="Таблетка, капсула…"
                value={form.form}
                onChangeText={(text) => setForm({ ...form, form: text })}
                containerStyle={{ flex: 1 }}
              />
              <AppInput
                label="Способ приема"
                placeholder="Внутрь, ингаляция…"
                value={form.route}
                onChangeText={(text) => setForm({ ...form, route: text })}
                containerStyle={{ flex: 1 }}
              />
            </View>
 
            <AppInput
              label="Частота приема (раз в день)"
              placeholder="1"
              keyboardType="numeric"
              value={form.frequencyPerDay}
              onChangeText={(text) => setForm({ ...form, frequencyPerDay: text })}
            />
            <AppInput
              label="Время приема"
              hint="Через запятую, например: 08:00, 20:00"
              placeholder="08:00, 20:00"
              value={form.times}
              onChangeText={(text) => setForm({ ...form, times: text })}
            />
 
            <View style={{ flexDirection: bp === 'phone' ? 'column' : 'row', gap: theme.spacing.md }}>
              <View style={{ flex: 1 }}>
                <AppDateField
                  label="Дата начала"
                  value={form.startDate}
                  onChange={(text) => setForm({ ...form, startDate: text })}
                />
              </View>
              <View style={{ flex: 1 }}>
                <AppDateField
                  label="Дата окончания"
                  value={form.endDate}
                  onChange={(text) => setForm({ ...form, endDate: text })}
                />
              </View>
            </View>
 
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <AppInput
                  label="БАД"
                  hint="Отметьте, если это добавка"
                  editable={false}
                  value=""
                />
              </View>
              <AppChip
                label={form.isSupplement ? 'Да' : 'Нет'}
                tone={form.isSupplement ? 'primary' : 'neutral'}
                onPress={() => setForm({ ...form, isSupplement: !form.isSupplement })}
              />
            </View>
 
            <AppInput
              label="Заметки"
              placeholder="Дополнительная информация…"
              value={form.notes}
              onChangeText={(text) => setForm({ ...form, notes: text })}
              multiline
              numberOfLines={4}
              style={{ minHeight: 110, textAlignVertical: 'top' as any }}
            />
 
            <AppButton title="Добавить" loading={creating} onPress={handleCreate} fullWidth />
          </View>
        </AppCard>
      </AppSection>
    </AppScreen>
  );
}

