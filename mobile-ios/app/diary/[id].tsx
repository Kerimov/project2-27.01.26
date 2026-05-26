import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import {
  getDiaryEntries,
  updateDiaryEntry,
  type DiaryEntry,
  type UpdateDiaryEntryData,
} from '../../api/diary';
import { setAuthToken } from '../../api/client';
import { useAuthStore } from '../../state/authStore';
import { useAppTheme } from '@/design/tokens';
import { useBreakpoint } from '@/design/responsive';
import { AppScreen } from '@/components/ui/AppScreen';
import { AppSection } from '@/components/ui/AppSection';
import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { AppInput } from '@/components/ui/AppInput';
import { AppDateTimeField } from '@/components/ui/AppDateTimeField';
import { AppButton } from '@/components/ui/AppButton';

export default function EditDiaryEntryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { token } = useAuthStore();
  const theme = useAppTheme();
  const bp = useBreakpoint();

  const [entry, setEntry] = useState<DiaryEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    entryDate: '',
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

  useEffect(() => {
    if (token) {
      setAuthToken(token);
    }
    loadEntry();
  }, [id, token]);

  const loadEntry = async () => {
    if (!id || !token) return;
    try {
      setLoading(true);
      setAuthToken(token);
      const entries = await getDiaryEntries();
      const found = entries.find((e) => e.id === id);
      if (!found) {
        Alert.alert('Ошибка', 'Запись не найдена');
        router.back();
        return;
      }
      setEntry(found);
      const entryDate = new Date(found.entryDate);
      setForm({
        entryDate: entryDate.toISOString().slice(0, 16),
        mood: found.mood?.toString() || '',
        painScore: found.painScore?.toString() || '',
        sleepHours: found.sleepHours?.toString() || '',
        steps: found.steps?.toString() || '',
        temperature: found.temperature?.toString() || '',
        weight: found.weight?.toString() || '',
        systolic: found.systolic?.toString() || '',
        diastolic: found.diastolic?.toString() || '',
        pulse: found.pulse?.toString() || '',
        symptoms: found.symptoms || '',
        notes: found.notes || '',
        tags: found.tags.map((t) => t.tag.name).join(', '),
      });
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message || 'Не удалось загрузить запись');
    } finally {
      setLoading(false);
    }
  };

  const toOptionalNumber = (v: string): number | null | undefined => {
    const s = (v || '').trim();
    if (!s) return null;
    const n = Number(s);
    if (!Number.isFinite(n)) return null;
    return n;
  };

  const toOptionalInt = (v: string): number | null | undefined => {
    const n = toOptionalNumber(v);
    return n !== null && n !== undefined ? Math.trunc(n) : null;
  };

  const handleSave = async () => {
    if (!id || !token || !entry) return;

    try {
      setSaving(true);
      setAuthToken(token);

      const tags = form.tags
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const entryData: UpdateDiaryEntryData = {
        entryDate: form.entryDate || undefined,
        mood: toOptionalInt(form.mood),
        painScore: toOptionalInt(form.painScore),
        sleepHours: toOptionalNumber(form.sleepHours),
        steps: toOptionalInt(form.steps),
        temperature: toOptionalNumber(form.temperature),
        weight: toOptionalNumber(form.weight),
        systolic: toOptionalInt(form.systolic),
        diastolic: toOptionalInt(form.diastolic),
        pulse: toOptionalInt(form.pulse),
        symptoms: form.symptoms.trim() || null,
        notes: form.notes.trim() || null,
        tags: tags.length > 0 ? tags : undefined,
      };

      await updateDiaryEntry(id, entryData);

      Alert.alert('Успех', 'Запись обновлена', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message || 'Не удалось обновить запись');
    } finally {
      setSaving(false);
    }
  };

  // ВСЕ хуки должны быть вызваны ДО любых условных возвратов
  const isWide = bp !== 'phone';
  const rowStyle = useMemo(
    () => ({
      flexDirection: isWide ? 'row' : 'column',
      gap: theme.spacing.md,
    } as const),
    [isWide, theme.spacing.md]
  );

  if (loading) {
    return (
      <AppScreen
        scroll={false}
        contentContainerStyle={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          gap: theme.spacing.sm,
        }}>
        <ActivityIndicator />
        <AppText variant="caption" color="mutedText">
          Загружаем запись…
        </AppText>
      </AppScreen>
    );
  }

  if (!entry) {
    return (
      <AppScreen scroll={false} contentContainerStyle={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <AppText>Запись не найдена.</AppText>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <AppSection title="Редактировать запись" subtitle="Дневник здоровья">
        <AppCard style={{ gap: theme.spacing.lg }}>
          <AppDateTimeField
            label="Дата и время"
            value={form.entryDate}
            onChange={(entryDate) => setForm({ ...form, entryDate })}
          />

          <View style={rowStyle}>
            <AppInput
              containerStyle={{ flex: 1 }}
              label="Настроение (1–5)"
              placeholder="3"
              keyboardType="numeric"
              value={form.mood}
              onChangeText={(text) => setForm({ ...form, mood: text })}
            />
            <AppInput
              containerStyle={{ flex: 1 }}
              label="Боль (0–10)"
              placeholder="0"
              keyboardType="numeric"
              value={form.painScore}
              onChangeText={(text) => setForm({ ...form, painScore: text })}
            />
          </View>

          <View style={rowStyle}>
            <AppInput
              containerStyle={{ flex: 1 }}
              label="Сон (часы)"
              placeholder="8"
              keyboardType="numeric"
              value={form.sleepHours}
              onChangeText={(text) => setForm({ ...form, sleepHours: text })}
            />
            <AppInput
              containerStyle={{ flex: 1 }}
              label="Шаги"
              placeholder="10000"
              keyboardType="numeric"
              value={form.steps}
              onChangeText={(text) => setForm({ ...form, steps: text })}
            />
          </View>

          <View style={rowStyle}>
            <AppInput
              containerStyle={{ flex: 1 }}
              label="Температура (°C)"
              placeholder="36.6"
              keyboardType="numeric"
              value={form.temperature}
              onChangeText={(text) => setForm({ ...form, temperature: text })}
            />
            <AppInput
              containerStyle={{ flex: 1 }}
              label="Вес (кг)"
              placeholder="70"
              keyboardType="numeric"
              value={form.weight}
              onChangeText={(text) => setForm({ ...form, weight: text })}
            />
          </View>

          <View style={rowStyle}>
            <AppInput
              containerStyle={{ flex: 1 }}
              label="Давление (верхнее)"
              placeholder="120"
              keyboardType="numeric"
              value={form.systolic}
              onChangeText={(text) => setForm({ ...form, systolic: text })}
            />
            <AppInput
              containerStyle={{ flex: 1 }}
              label="Давление (нижнее)"
              placeholder="80"
              keyboardType="numeric"
              value={form.diastolic}
              onChangeText={(text) => setForm({ ...form, diastolic: text })}
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
            style={{ minHeight: 96, textAlignVertical: 'top' as any }}
          />

          <AppInput
            label="Заметки"
            placeholder="Дополнительная информация…"
            value={form.notes}
            onChangeText={(text) => setForm({ ...form, notes: text })}
            multiline
            style={{ minHeight: 96, textAlignVertical: 'top' as any }}
          />

          <AppInput
            label="Теги"
            placeholder="головная боль, усталость…"
            hint="Через запятую"
            value={form.tags}
            onChangeText={(text) => setForm({ ...form, tags: text })}
          />
        </AppCard>

        <AppButton title="Сохранить" fullWidth loading={saving} disabled={saving} onPress={handleSave} />
      </AppSection>
    </AppScreen>
  );
}
