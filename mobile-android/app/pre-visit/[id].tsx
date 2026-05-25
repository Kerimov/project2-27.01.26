import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
 
import {
  getPreVisitQuestionnaire,
  updatePreVisitQuestionnaire,
  generateDoctorReport,
  type PreVisitAnswers,
} from '../../api/pre-visit';
import { setAuthToken } from '../../api/client';
import { useAuthStore } from '../../state/authStore';
 
import { useAppTheme } from '@/design/tokens';
import { useBreakpoint } from '@/design/responsive';
import { AppScreen } from '@/components/ui/AppScreen';
import { AppSection } from '@/components/ui/AppSection';
import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { AppInput } from '@/components/ui/AppInput';
import { AppButton } from '@/components/ui/AppButton';
 
export default function PreVisitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { token } = useAuthStore();
  const theme = useAppTheme();
  const bp = useBreakpoint();
 
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [answers, setAnswers] = useState<PreVisitAnswers>({});
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
 
  useEffect(() => {
    if (token) setAuthToken(token);
    void loadQuestionnaire();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token]);
 
  const loadQuestionnaire = async () => {
    if (!id || !token) return;
    try {
      setLoading(true);
      setMessage(null);
      setAuthToken(token);
      const questionnaire = await getPreVisitQuestionnaire(id);
      if (questionnaire) {
        setAnswers(questionnaire.answers || {});
        setSubmittedAt(questionnaire.submittedAt || null);
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e?.message || 'Не удалось загрузить анкету' });
    } finally {
      setLoading(false);
    }
  };
 
  const handleSave = async (submit: boolean) => {
    if (!id || !token) return;
    try {
      setSaving(true);
      setMessage(null);
      setAuthToken(token);
      await updatePreVisitQuestionnaire(id, { answers, submitted: submit });
      if (submit) {
        setSubmittedAt(new Date().toISOString());
        setMessage({ type: 'success', text: 'Анкета отправлена' });
      } else {
        setMessage({ type: 'success', text: 'Черновик сохранён' });
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e?.message || 'Не удалось сохранить анкету' });
    } finally {
      setSaving(false);
    }
  };
 
  const handleGenerateReport = async () => {
    if (!id || !token) return;
    try {
      setSaving(true);
      setMessage(null);
      setAuthToken(token);
      const docId = await generateDoctorReport(id);
      setDocumentId(docId);
      setMessage({ type: 'success', text: 'Сводка для врача сформирована' });
    } catch (e: any) {
      setMessage({ type: 'error', text: e?.message || 'Не удалось сформировать сводку' });
    } finally {
      setSaving(false);
    }
  };
 
  const isSubmitted = !!submittedAt;
 
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: theme.colors.background }}>
        <ActivityIndicator />
        <AppText variant="caption" color="mutedText" style={{ marginTop: theme.spacing.sm }}>
          Загружаем анкету…
        </AppText>
      </View>
    );
  }
 
  return (
    <AppScreen>
      <AppSection
        title="Анкета перед визитом"
        subtitle="Заполни кратко — это ляжет в сводку для врача"
        headerRight={
          submittedAt ? (
            <AppText variant="caption" color="success">
              Отправлено: {new Date(submittedAt).toLocaleString('ru-RU')}
            </AppText>
          ) : null
        }>
        <View style={{ gap: theme.spacing.lg }}>
          {message ? (
            <AppCard variant="surface2">
              <AppText variant="body" color={message.type === 'success' ? 'success' : 'danger'} style={{ textAlign: 'center' }}>
                {message.text}
              </AppText>
            </AppCard>
          ) : null}
 
          <AppCard>
            <View style={{ gap: theme.spacing.md }}>
              <AppInput
                label="Цель визита"
                placeholder="Напр. разобрать анализы, подобрать терапию, контроль…"
                value={answers.goal || ''}
                onChangeText={(text) => setAnswers({ ...answers, goal: text })}
                editable={!isSubmitted}
              />
              <AppInput
                label="Жалобы / что беспокоит"
                placeholder="Коротко: что, где, как давно, что ухудшает/улучшает"
                value={answers.complaints || ''}
                onChangeText={(text) => setAnswers({ ...answers, complaints: text })}
                editable={!isSubmitted}
                multiline
                numberOfLines={4}
                style={{ minHeight: 120, textAlignVertical: 'top' as any }}
              />
 
              <View style={{ flexDirection: bp === 'phone' ? 'column' : 'row', gap: theme.spacing.md }}>
                <AppInput
                  label="Длительность / динамика"
                  placeholder="Напр. 2 недели, усиливается вечером"
                  value={answers.duration || ''}
                  onChangeText={(text) => setAnswers({ ...answers, duration: text })}
                  editable={!isSubmitted}
                  containerStyle={{ flex: 1 }}
                />
                <AppInput
                  label="Показатели (если есть)"
                  placeholder="АД/пульс/температура/вес…"
                  value={answers.vitals || ''}
                  onChangeText={(text) => setAnswers({ ...answers, vitals: text })}
                  editable={!isSubmitted}
                  containerStyle={{ flex: 1 }}
                />
              </View>
 
              <AppInput
                label="Лекарства / БАДы сейчас"
                placeholder="Название — дозировка — как принимаете"
                value={answers.currentMedications || ''}
                onChangeText={(text) => setAnswers({ ...answers, currentMedications: text })}
                editable={!isSubmitted}
                multiline
                numberOfLines={4}
                style={{ minHeight: 120, textAlignVertical: 'top' as any }}
              />
 
              <View style={{ flexDirection: bp === 'phone' ? 'column' : 'row', gap: theme.spacing.md }}>
                <AppInput
                  label="Аллергии"
                  placeholder="Если нет — оставьте пустым"
                  value={answers.allergies || ''}
                  onChangeText={(text) => setAnswers({ ...answers, allergies: text })}
                  editable={!isSubmitted}
                  containerStyle={{ flex: 1 }}
                />
                <AppInput
                  label="Хронические состояния"
                  placeholder="Напр. гипертония, диабет…"
                  value={answers.chronicConditions || ''}
                  onChangeText={(text) => setAnswers({ ...answers, chronicConditions: text })}
                  editable={!isSubmitted}
                  containerStyle={{ flex: 1 }}
                />
              </View>
 
              <AppInput
                label="Вопросы врачу"
                placeholder="Что важно обсудить на приёме?"
                value={answers.questionsForDoctor || ''}
                onChangeText={(text) => setAnswers({ ...answers, questionsForDoctor: text })}
                editable={!isSubmitted}
                multiline
                numberOfLines={4}
                style={{ minHeight: 120, textAlignVertical: 'top' as any }}
              />
              <AppInput
                label="Дополнительно"
                placeholder="Любые детали, которые помогут врачу"
                value={answers.otherNotes || ''}
                onChangeText={(text) => setAnswers({ ...answers, otherNotes: text })}
                editable={!isSubmitted}
                multiline
                numberOfLines={4}
                style={{ minHeight: 120, textAlignVertical: 'top' as any }}
              />
 
              {!isSubmitted ? (
                <View style={{ flexDirection: bp === 'phone' ? 'column' : 'row', gap: theme.spacing.md }}>
                  <AppButton title="Сохранить черновик" variant="secondary" onPress={() => handleSave(false)} loading={saving} fullWidth style={{ flex: 1 }} />
                  <AppButton title="Отправить анкету" onPress={() => handleSave(true)} loading={saving} fullWidth style={{ flex: 1 }} />
                </View>
              ) : (
                <AppCard variant="surface2">
                  <AppText variant="caption" color="mutedText" style={{ textAlign: 'center' }}>
                    Анкета отправлена. Редактирование отключено.
                  </AppText>
                </AppCard>
              )}
 
              <View style={{ flexDirection: bp === 'phone' ? 'column' : 'row', gap: theme.spacing.md }}>
                <AppButton title="Сформировать сводку для врача" variant="secondary" onPress={handleGenerateReport} loading={saving} fullWidth style={{ flex: 1 }} />
                {documentId ? (
                  <AppButton title="Открыть сводку" onPress={() => router.push(`/document/${documentId}` as any)} fullWidth style={{ flex: 1 }} />
                ) : null}
              </View>
            </View>
          </AppCard>
        </View>
      </AppSection>
    </AppScreen>
  );
}

