import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
 
import {
  getMedications,
  updateMedication,
  type PatientMedication,
  type UpdateMedicationData,
} from '../../api/medications';
import { setAuthToken } from '../../api/client';
import { useAuthStore } from '../../state/authStore';
 
import { useAppTheme } from '@/design/tokens';
import { useBreakpoint } from '@/design/responsive';
import { AppScreen } from '@/components/ui/AppScreen';
import { AppSection } from '@/components/ui/AppSection';
import { AppCard } from '@/components/ui/AppCard';
import { AppInput } from '@/components/ui/AppInput';
import { AppButton } from '@/components/ui/AppButton';
import { AppChip } from '@/components/ui/AppChip';
 
export default function EditMedicationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { token } = useAuthStore();
  const theme = useAppTheme();
  const bp = useBreakpoint();
 
  const [medication, setMedication] = useState<PatientMedication | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
 
  const [form, setForm] = useState({
    name: '',
    dosage: '',
    form: '',
    route: '',
    frequencyPerDay: '',
    times: '',
    startDate: '',
    endDate: '',
    notes: '',
    isSupplement: false,
  });
 
  useEffect(() => {
    if (token) setAuthToken(token);
    void loadMedication();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token]);
 
  const loadMedication = async () => {
    if (!id || !token) return;
    try {
      setLoading(true);
      setAuthToken(token);
      const medications = await getMedications();
      const med = medications.find((m) => m.id === id);
      if (!med) {
        Alert.alert('Ошибка', 'Лекарство не найдено');
        router.back();
        return;
      }
      setMedication(med);
      setForm({
        name: med.name,
        dosage: med.dosage || '',
        form: med.form || '',
        route: med.route || '',
        frequencyPerDay: med.frequencyPerDay?.toString() || '',
        times: Array.isArray(med.times) ? med.times.join(', ') : '',
        startDate: med.startDate ? new Date(med.startDate).toISOString().split('T')[0] : '',
        endDate: med.endDate ? new Date(med.endDate).toISOString().split('T')[0] : '',
        notes: med.notes || '',
        isSupplement: med.isSupplement,
      });
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message || 'Не удалось загрузить лекарство');
    } finally {
      setLoading(false);
    }
  };
 
  const handleSave = async () => {
    if (!id || !token || !medication) return;
    if (!form.name.trim()) {
      Alert.alert('Ошибка', 'Введите название лекарства');
      return;
    }
 
    try {
      setSaving(true);
      setAuthToken(token);
 
      const times = form.times.split(',').map((s) => s.trim()).filter(Boolean);
 
      const medicationData: UpdateMedicationData = {
        name: form.name.trim(),
        dosage: form.dosage.trim() || null,
        form: form.form.trim() || null,
        route: form.route.trim() || null,
        frequencyPerDay: form.frequencyPerDay ? parseInt(form.frequencyPerDay, 10) : null,
        times: times.length > 0 ? times : null,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        notes: form.notes.trim() || null,
        isSupplement: form.isSupplement,
      };
 
      await updateMedication(id, medicationData);
      Alert.alert('Успех', 'Лекарство обновлено', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message || 'Не удалось обновить лекарство');
    } finally {
      setSaving(false);
    }
  };
 
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: theme.colors.background }}>
        <ActivityIndicator />
      </View>
    );
  }
 
  if (!medication) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: theme.colors.background }}>
        <AppChip label="Лекарство не найдено" />
      </View>
    );
  }
 
  return (
    <AppScreen>
      <AppSection title="Редактировать лекарство" subtitle={medication.name}>
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
              <AppInput
                label="Дата начала"
                placeholder="ГГГГ-ММ-ДД"
                value={form.startDate}
                onChangeText={(text) => setForm({ ...form, startDate: text })}
                containerStyle={{ flex: 1 }}
              />
              <AppInput
                label="Дата окончания"
                placeholder="ГГГГ-ММ-ДД"
                value={form.endDate}
                onChangeText={(text) => setForm({ ...form, endDate: text })}
                containerStyle={{ flex: 1 }}
              />
            </View>
 
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <AppInput label="БАД" hint="Отметьте, если это добавка" editable={false} value="" />
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
 
            <AppButton title="Сохранить" loading={saving} onPress={handleSave} fullWidth />
          </View>
        </AppCard>
      </AppSection>
    </AppScreen>
  );
}

