import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { useRouter } from 'expo-router';
 
import { createDiaryEntry, type CreateDiaryEntryData } from '../../api/diary';
import { setAuthToken } from '../../api/client';
import { useAuthStore } from '../../state/authStore';
 
import { useAppTheme } from '@/design/tokens';
import { useBreakpoint } from '@/design/responsive';
import { AppScreen } from '@/components/ui/AppScreen';
import { AppSection } from '@/components/ui/AppSection';
import { AppCard } from '@/components/ui/AppCard';
import { AppInput } from '@/components/ui/AppInput';
import { AppButton } from '@/components/ui/AppButton';
 
export default function CreateDiaryEntryScreen() {
  const router = useRouter();
  const { token } = useAuthStore();
  const theme = useAppTheme();
  const bp = useBreakpoint();
 
  const [form, setForm] = useState({
    entryDate: new Date().toISOString().slice(0, 16),
    mood: '',
    painScore: '',
    sleepHours: '',
    steps: '',
    temperature: '',
    weight: '',
    systolic: '',
    diastolic: '',
    pulse: '',
    symptoms: '',
    notes: '',
    tags: '',
  });
  const [creating, setCreating] = useState(false);
 
  const toOptionalNumber = (v: string): number | undefined => {
    const s = (v || '').trim();
    if (!s) return undefined;
    const n = Number(s);
    if (!Number.isFinite(n)) return undefined;
    return n;
  };
 
  const toOptionalInt = (v: string): number | undefined => {
    const n = toOptionalNumber(v);
    return n !== undefined ? Math.trunc(n) : undefined;
  };
 
  const handleCreate = async () => {
    if (!token) {
      Alert.alert('Ошибка', 'Необходима авторизация');
      return;
    }
 
    try {
      setCreating(true);
      setAuthToken(token);
 
      const tags = form.tags.split(',').map((s) => s.trim()).filter(Boolean);
 
      const entryData: CreateDiaryEntryData = {
        entryDate: form.entryDate || new Date().toISOString(),
        mood: toOptionalInt(form.mood),
        painScore: toOptionalInt(form.painScore),
        sleepHours: toOptionalNumber(form.sleepHours),
        steps: toOptionalInt(form.steps),
        temperature: toOptionalNumber(form.temperature),
        weight: toOptionalNumber(form.weight),
        systolic: toOptionalInt(form.systolic),
        diastolic: toOptionalInt(form.diastolic),
        pulse: toOptionalInt(form.pulse),
        symptoms: form.symptoms.trim() || undefined,
        notes: form.notes.trim() || undefined,
        tags: tags.length > 0 ? tags : undefined,
      };
 
      await createDiaryEntry(entryData);
      Alert.alert('Успех', 'Запись добавлена', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message || 'Не удалось добавить запись');
    } finally {
      setCreating(false);
    }
  };
 
  return (
    <AppScreen>
      <AppSection title="Новая запись" subtitle="Дневник здоровья">
        <AppCard>
          <View style={{ gap: theme.spacing.md }}>
            <AppInput
              label="Дата и время"
              value={form.entryDate}
              onChangeText={(text) => setForm({ ...form, entryDate: text })}
              hint="Формат: ГГГГ-ММ-ДДЧЧ:ММ"
            />
 
            <View style={{ flexDirection: bp === 'phone' ? 'column' : 'row', gap: theme.spacing.md }}>
              <AppInput
                label="Настроение (1-5)"
                placeholder="3"
                keyboardType="numeric"
                value={form.mood}
                onChangeText={(text) => setForm({ ...form, mood: text })}
                containerStyle={{ flex: 1 }}
              />
              <AppInput
                label="Боль (0-10)"
                placeholder="0"
                keyboardType="numeric"
                value={form.painScore}
                onChangeText={(text) => setForm({ ...form, painScore: text })}
                containerStyle={{ flex: 1 }}
              />
            </View>
 
            <View style={{ flexDirection: bp === 'phone' ? 'column' : 'row', gap: theme.spacing.md }}>
              <AppInput
                label="Сон (часы)"
                placeholder="8"
                keyboardType="numeric"
                value={form.sleepHours}
                onChangeText={(text) => setForm({ ...form, sleepHours: text })}
                containerStyle={{ flex: 1 }}
              />
              <AppInput
                label="Шаги"
                placeholder="10000"
                keyboardType="numeric"
                value={form.steps}
                onChangeText={(text) => setForm({ ...form, steps: text })}
                containerStyle={{ flex: 1 }}
              />
            </View>
 
            <View style={{ flexDirection: bp === 'phone' ? 'column' : 'row', gap: theme.spacing.md }}>
              <AppInput
                label="Температура (°C)"
                placeholder="36.6"
                keyboardType="numeric"
                value={form.temperature}
                onChangeText={(text) => setForm({ ...form, temperature: text })}
                containerStyle={{ flex: 1 }}
              />
              <AppInput
                label="Вес (кг)"
                placeholder="70"
                keyboardType="numeric"
                value={form.weight}
                onChangeText={(text) => setForm({ ...form, weight: text })}
                containerStyle={{ flex: 1 }}
              />
            </View>
 
            <View style={{ flexDirection: bp === 'phone' ? 'column' : 'row', gap: theme.spacing.md }}>
              <AppInput
                label="Давление (верхнее)"
                placeholder="120"
                keyboardType="numeric"
                value={form.systolic}
                onChangeText={(text) => setForm({ ...form, systolic: text })}
                containerStyle={{ flex: 1 }}
              />
              <AppInput
                label="Давление (нижнее)"
                placeholder="80"
                keyboardType="numeric"
                value={form.diastolic}
                onChangeText={(text) => setForm({ ...form, diastolic: text })}
                containerStyle={{ flex: 1 }}
              />
            </View>
 
            <AppInput
              label="Пульс (уд/мин)"
              placeholder="72"
              keyboardType="numeric"
              value={form.pulse}
              onChangeText={(text) => setForm({ ...form, pulse: text })}
            />
 
            <AppInput
              label="Симптомы"
              placeholder="Опишите симптомы…"
              value={form.symptoms}
              onChangeText={(text) => setForm({ ...form, symptoms: text })}
              multiline
              numberOfLines={3}
              style={{ minHeight: 90, textAlignVertical: 'top' as any }}
            />
 
            <AppInput
              label="Заметки"
              placeholder="Дополнительная информация…"
              value={form.notes}
              onChangeText={(text) => setForm({ ...form, notes: text })}
              multiline
              numberOfLines={4}
              style={{ minHeight: 110, textAlignVertical: 'top' as any }}
            />
 
            <AppInput
              label="Теги"
              placeholder="головная боль, усталость…"
              hint="Через запятую"
              value={form.tags}
              onChangeText={(text) => setForm({ ...form, tags: text })}
            />
 
            <AppButton title="Добавить" loading={creating} onPress={handleCreate} fullWidth />
          </View>
        </AppCard>
      </AppSection>
    </AppScreen>
  );
}

