import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';

import {
  getMedications,
  deleteMedication,
  type PatientMedication,
} from '../../api/medications';
import { generateMedicationPlan } from '../../api/ai-medications';
import { useAppTheme } from '@/design/tokens';
import { useContentPadding, useMaxContentWidth } from '@/design/responsive';
import { useFloatingTabBarInsets } from '@/design/tab-bar';
import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { AppChip } from '@/components/ui/AppChip';
import { AppButton } from '@/components/ui/AppButton';
import { AppFAB } from '@/components/ui/AppFAB';
import { PatientSwitcher } from '../PatientSwitcher';
import { useCaretakerStore } from '../../state/caretakerStore';
import { normalizePhoneReminderItem, promptTransferCreatedItemsToPhone } from '../../lib/phone-reminders';


export function MedicationsSection() {
  const router = useRouter();
  const theme = useAppTheme();
  const pad = useContentPadding();
  const { listPaddingBottom } = useFloatingTabBarInsets();
  const { maxWidth } = useMaxContentWidth();

  const { selectedPatientId } = useCaretakerStore();
  const [medications, setMedications] = useState<PatientMedication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [planLoading, setPlanLoading] = useState(false);

  const loadMedications = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getMedications(selectedPatientId || undefined);
      setMedications(data);
    } catch (e: any) {
      setError(e?.message || 'Не удалось загрузить лекарства');
    } finally {
      setLoading(false);
    }
  }, [selectedPatientId]);

  useEffect(() => {
    loadMedications();
  }, [loadMedications]);

  const handleDelete = async (medication: PatientMedication) => {
    Alert.alert(
      'Удалить лекарство',
      `Вы уверены, что хотите удалить "${medication.name}"?`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMedication(medication.id);
              Alert.alert('Успех', 'Лекарство удалено');
              await loadMedications();
            } catch (e: any) {
              Alert.alert('Ошибка', e?.message || 'Не удалось удалить лекарство');
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('ru-RU');
  };

  const formatTimes = (times: string[] | null | undefined): string => {
    if (!times || times.length === 0) return '';
    return times.join(', ');
  };

  const renderItem = ({ item }: { item: PatientMedication }) => (
    <AppCard style={{ padding: theme.spacing.lg }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <AppText variant="h3">{item.name}</AppText>
          {item.dosage ? (
            <AppText variant="caption" color="mutedText" style={{ marginTop: theme.spacing.xs }}>
              {item.dosage}
            </AppText>
          ) : null}
          {item.form ? (
            <AppText variant="caption" color="mutedText" style={{ marginTop: 2 }}>
              {item.form}
            </AppText>
          ) : null}
        </View>
        {item.isSupplement ? <AppChip label="БАД" /> : null}
      </View>

      {item.frequencyPerDay ? (
        <AppText variant="caption" color="mutedText" style={{ marginTop: theme.spacing.md }}>
          Прием: {item.frequencyPerDay} раз(а) в день
          {item.times && item.times.length > 0 ? ` (${formatTimes(item.times)})` : ''}
        </AppText>
      ) : null}

      {item.startDate || item.endDate ? (
        <AppText variant="caption" color="mutedText" style={{ marginTop: theme.spacing.xs }}>
          {item.startDate ? `Начало: ${formatDate(item.startDate)}` : ''}
          {item.startDate && item.endDate ? ' · ' : ''}
          {item.endDate ? `Конец: ${formatDate(item.endDate)}` : ''}
        </AppText>
      ) : null}

      {item.notes ? (
        <AppText variant="caption" color="mutedText" style={{ marginTop: theme.spacing.sm }}>
          {item.notes}
        </AppText>
      ) : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: theme.spacing.lg }}>
        <AppButton title="Редактировать" size="sm" variant="secondary" onPress={() => router.push(`/medication/${item.id}` as any)} />
        <AppButton title="Удалить" size="sm" variant="danger" onPress={() => handleDelete(item)} />
      </View>
    </AppCard>
  );

  if (loading && !medications.length) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.sm }}>
        <ActivityIndicator />
        <AppText variant="caption" color="mutedText">
          Загружаем лекарства…
        </AppText>
      </View>
    );
  }

  const onAiPlan = async () => {
    try {
      setPlanLoading(true);
      const res = await generateMedicationPlan(selectedPatientId || undefined);
      const text = res.tldr || res.message || JSON.stringify(res.schedule || res, null, 2);
      const transferItems = Array.isArray(res.reminders) && res.reminders.length > 0
        ? res.reminders
        : Array.isArray(res.schedule)
          ? res.schedule
          : [];
      promptTransferCreatedItemsToPhone(
        transferItems.map((item: unknown) => normalizePhoneReminderItem(item as any, 'Приём лекарства')),
        {
          title: 'AI-план приёма',
          message: `${text}\n\nПеренести напоминания в календарь Android?`,
        }
      );
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message || 'Не удалось сгенерировать план');
    } finally {
      setPlanLoading(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <PatientSwitcher />
      <AppButton
        title="AI: план приёма лекарств"
        variant="secondary"
        loading={planLoading}
        onPress={onAiPlan}
        style={{ marginBottom: theme.spacing.sm }}
      />
      <FlatList
        data={medications}
        keyExtractor={(item) => item.id}
        style={{ flex: 1 }}
        contentContainerStyle={{
          gap: theme.spacing.md,
          paddingBottom: listPaddingBottom,
        }}
        renderItem={renderItem}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <AppText variant="body" color="mutedText">
              Лекарства не найдены.
            </AppText>
            <View style={{ marginTop: theme.spacing.md, width: 240 }}>
              <AppButton title="Добавить лекарство" onPress={() => router.push('/medication/create' as any)} />
            </View>
          </View>
        }
        refreshing={loading}
        onRefresh={loadMedications}
      />
      <AppFAB icon="plus" onPress={() => router.push('/medication/create' as any)} />
      {error ? (
        <View style={{ paddingBottom: pad.vertical }}>
          <AppCard variant="surface2">
            <AppText variant="body" color="danger" style={{ textAlign: 'center' }}>
              {error}
            </AppText>
          </AppCard>
        </View>
      ) : null}
    </View>
  );
}
