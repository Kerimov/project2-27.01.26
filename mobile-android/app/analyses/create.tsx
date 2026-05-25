import React, { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { createAnalysis } from '../../api/analyses';
import { useAppTheme } from '@/design/tokens';
import { AppScreen } from '@/components/ui/AppScreen';
import { AppCard } from '@/components/ui/AppCard';
import { AppInput } from '@/components/ui/AppInput';
import { AppButton } from '@/components/ui/AppButton';
import { AppText } from '@/components/ui/AppText';
import { AppChip } from '@/components/ui/AppChip';

const TYPES = [
  'Общий анализ крови',
  'Биохимический анализ крови',
  'Общий анализ мочи',
  'Гормональные исследования',
  'Другие',
];

export default function CreateAnalysisScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const [title, setTitle] = useState('');
  const [type, setType] = useState(TYPES[0]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [laboratory, setLaboratory] = useState('');
  const [indName, setIndName] = useState('');
  const [indValue, setIndValue] = useState('');
  const [indUnit, setIndUnit] = useState('');
  const [results, setResults] = useState<Record<string, { value: string; unit?: string; normal?: boolean }>>({});
  const [loading, setLoading] = useState(false);

  const addIndicator = () => {
    if (!indName.trim() || !indValue.trim()) return;
    setResults((r) => ({
      ...r,
      [indName.trim()]: { value: indValue.trim(), unit: indUnit.trim() || undefined, normal: true },
    }));
    setIndName('');
    setIndValue('');
    setIndUnit('');
  };

  const onSave = async () => {
    if (!title.trim() || Object.keys(results).length === 0) {
      Alert.alert('Ошибка', 'Укажите название и хотя бы один показатель');
      return;
    }
    try {
      setLoading(true);
      await createAnalysis({
        title: title.trim(),
        type,
        date,
        laboratory: laboratory.trim() || undefined,
        results,
        status: 'normal',
      });
      router.back();
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message || 'Не удалось сохранить');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppScreen>
      <ScrollView contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: 32 }}>
        <AppCard style={{ gap: theme.spacing.md, padding: theme.spacing.lg }}>
          <AppInput label="Название" value={title} onChangeText={setTitle} />
          <AppText variant="caption" color="mutedText">
            Тип
          </AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {TYPES.map((t) => (
              <AppChip key={t} label={t} tone={type === t ? 'primary' : 'neutral'} onPress={() => setType(t)} />
            ))}
          </View>
          <AppInput label="Дата" value={date} onChangeText={setDate} />
          <AppInput label="Лаборатория" value={laboratory} onChangeText={setLaboratory} />
        </AppCard>
        <AppCard style={{ gap: theme.spacing.sm, padding: theme.spacing.lg }}>
          <AppText variant="h3">Показатели</AppText>
          <AppInput label="Название" value={indName} onChangeText={setIndName} />
          <AppInput label="Значение" value={indValue} onChangeText={setIndValue} />
          <AppInput label="Ед." value={indUnit} onChangeText={setIndUnit} />
          <AppButton title="Добавить показатель" variant="secondary" onPress={addIndicator} />
          {Object.keys(results).map((k) => (
            <AppText key={k} variant="caption">
              {k}: {results[k].value} {results[k].unit || ''}
            </AppText>
          ))}
        </AppCard>
        <AppButton title="Сохранить анализ" loading={loading} onPress={onSave} fullWidth />
      </ScrollView>
    </AppScreen>
  );
}
