import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { getDocument, deleteDocument, reviewDocument, type DocumentDetail, type MedicalIndicator } from '../../api/documents';
import { useAiChatLaunchStore } from '../../state/aiChatLaunchStore';
import { getAnalyses, type AnalysisSummary } from '../../api/analyses';
import { setAuthToken } from '../../api/client';
import { useAuthStore } from '../../state/authStore';
import { useAppTheme } from '@/design/tokens';
import { AppScreen } from '@/components/ui/AppScreen';
import { AppSection } from '@/components/ui/AppSection';
import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { AppButton } from '@/components/ui/AppButton';
import { AppChip } from '@/components/ui/AppChip';
import { AppInput } from '@/components/ui/AppInput';
import { AppDateField } from '@/components/ui/AppDateField';
import { AppStatusBadge } from '@/components/ui/AppStatusBadge';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { openDocumentFile, isImageFileUrl } from '../../utils/openDocumentFile';

export default function DocumentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { token } = useAuthStore();
  const theme = useAppTheme();

  const [document, setDocument] = useState<DocumentDetail | null>(null);
  const [linkedAnalyses, setLinkedAnalyses] = useState<AnalysisSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [openingFile, setOpeningFile] = useState(false);
  const setLaunch = useAiChatLaunchStore((s) => s.setLaunch);
  const clearLaunch = useAiChatLaunchStore((s) => s.clearLaunch);

  useEffect(() => {
    if (!id) return;
    setLaunch({ initialDocumentIds: [String(id)], autoOpen: false });
    return () => clearLaunch();
  }, [id, setLaunch, clearLaunch]);

  const [edits, setEdits] = useState<{
    studyType: string;
    studyDate: string;
    laboratory: string;
    doctor: string;
    indicators: MedicalIndicator[];
  }>({ studyType: '', studyDate: '', laboratory: '', doctor: '', indicators: [] });

  useEffect(() => {
    if (!id) return;
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        if (token) setAuthToken(token);
        const doc = await getDocument(String(id));
        if (mounted) {
          setDocument(doc);
          setEdits({
            studyType: doc.studyType || '',
            studyDate: doc.studyDate ? new Date(doc.studyDate).toISOString().slice(0, 10) : '',
            laboratory: doc.laboratory || '',
            doctor: doc.doctor || '',
            indicators: doc.indicators ? [...doc.indicators] : [],
          });

          // Загружаем анализы, связанные с этим документом
          const linked = await getAnalyses(doc.id);
          setLinkedAnalyses(linked);
        }
      } catch (e: any) {
        if (mounted) setError(e?.message || 'Не удалось загрузить документ');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id, token]);

  // ВСЕ хуки должны быть вызваны ДО любых условных возвратов
  const formatRuDate = (value: unknown): string => {
    if (!value) return '';
    const d = new Date(String(value));
    if (Number.isNaN(d.getTime())) return '';
    try {
      return d.toLocaleDateString('ru-RU');
    } catch {
      return '';
    }
  };
  const uploadedAt = useMemo(
    () => (document?.uploadDate ? formatRuDate(document.uploadDate) : ''),
    [document?.uploadDate]
  );
  const studyAt = useMemo(
    () => (document?.studyDate ? formatRuDate(document.studyDate) : ''),
    [document?.studyDate]
  );

  const handleOpenFile = async () => {
    if (!document?.fileUrl) return;
    try {
      setOpeningFile(true);
      await openDocumentFile(document.fileUrl, {
        fileName: document.fileName,
        documentId: document.id,
      });
    } catch (e: any) {
      Alert.alert('Не удалось открыть файл', e?.message || 'Попробуйте снова');
    } finally {
      setOpeningFile(false);
    }
  };

  if (!id) {
    return (
      <AppScreen scroll={false} contentContainerStyle={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <AppText color="danger" style={{ textAlign: 'center' }}>
          Некорректный идентификатор документа
        </AppText>
      </AppScreen>
    );
  }

  if (loading) {
    return (
      <AppScreen scroll={false} contentContainerStyle={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: theme.spacing.sm }}>
        <ActivityIndicator />
        <AppText variant="caption" color="mutedText">
          Загружаем документ…
        </AppText>
      </AppScreen>
    );
  }

  if (error) {
    return (
      <AppScreen scroll={false} contentContainerStyle={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <AppText color="danger" style={{ textAlign: 'center' }}>
          {error}
        </AppText>
      </AppScreen>
    );
  }

  if (!document) {
    return (
      <AppScreen scroll={false} contentContainerStyle={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <AppText>Документ не найден.</AppText>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <AppSection
        title={document.fileName}
        subtitle={uploadedAt ? `Загружен: ${uploadedAt}` : undefined}
        headerRight={
          document.fileUrl ? (
            <AppButton
              title={openingFile ? '…' : 'Открыть'}
              variant="secondary"
              size="sm"
              disabled={openingFile}
              onPress={handleOpenFile}
            />
          ) : null
        }>
        <AppCard variant="hero" style={{ gap: theme.spacing.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.md }}>
            <View style={{ flex: 1, gap: theme.spacing.xs }}>
              <AppStatusBadge label={document.parsed ? 'OCR готов' : 'OCR в процессе'} tone={document.parsed ? 'success' : 'warning'} />
              <AppText variant="h2">{document.studyType || 'Медицинский документ'}</AppText>
              <AppText variant="caption" color="mutedText">
                {uploadedAt ? `Загружен ${uploadedAt}` : 'Документ в архиве'} · {document.fileType}
              </AppText>
            </View>
            <View
              style={{
                width: 54,
                height: 54,
                borderRadius: theme.radius.pill,
                backgroundColor: theme.colors.aiSoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <IconSymbol name="doc.text.fill" size={24} color={theme.colors.ai} />
            </View>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <AppChip label={document.parsed ? 'AI готов к диалогу' : 'В обработке'} tone={document.parsed ? 'ai' : 'warning'} />
            {typeof document.ocrConfidence === 'number' ? (
              <AppChip label={`OCR: ${Math.round(document.ocrConfidence * 100)}%`} tone="info" />
            ) : null}
            {document.category ? <AppChip label={document.category} /> : null}
          </View>

          {document.studyType ? <AppText variant="caption" color="mutedText">Тип исследования: {document.studyType}</AppText> : null}
          {studyAt ? <AppText variant="caption" color="mutedText">Дата исследования: {studyAt}</AppText> : null}
          {document.laboratory ? <AppText variant="caption" color="mutedText">Лаборатория: {document.laboratory}</AppText> : null}
          {document.doctor ? <AppText variant="caption" color="mutedText">Врач: {document.doctor}</AppText> : null}
        </AppCard>

        {document.fileUrl && isImageFileUrl(document.fileUrl, document.fileType) ? (
          <AppSection title="Просмотр">
            <AppCard style={{ overflow: 'hidden', padding: 0 }}>
              <Image
                source={{ uri: document.fileUrl }}
                style={{ width: '100%', height: 320 }}
                contentFit="contain"
              />
            </AppCard>
          </AppSection>
        ) : null}

        {document.findings ? (
          <AppSection title="Заключение">
            <AppCard variant="glass">
              <AppText selectable>{document.findings}</AppText>
            </AppCard>
          </AppSection>
        ) : null}

        {document.indicators && Array.isArray(document.indicators) && document.indicators.length > 0 ? (
          <AppSection title="Показатели" subtitle="Извлечено из документа">
            <View style={{ gap: theme.spacing.sm }}>
              {document.indicators.map((ind, idx) => {
                const value = `${ind.value}${ind.unit ? ` ${ind.unit}` : ''}`;
                const ref =
                  ind.referenceMin !== undefined && ind.referenceMax !== undefined
                    ? `Референс: ${ind.referenceMin} - ${ind.referenceMax}${ind.unit ? ` ${ind.unit}` : ''}`
                    : null;
                return (
                  <AppCard
                    key={`${ind.name}-${idx}`}
                    variant={ind.isNormal === false ? 'glass' : 'surface'}
                    style={{
                      gap: 6,
                      borderLeftWidth: ind.isNormal === false ? 4 : 0,
                      borderLeftColor: ind.isNormal === false ? theme.colors.warning : 'transparent',
                      backgroundColor: ind.isNormal === false ? theme.colors.warningSoft : undefined,
                    }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                      <View style={{ flex: 1 }}>
                        <AppText variant="bodyStrong">{ind.name}</AppText>
                        <AppText color="mutedText" variant="caption">
                          {value}
                        </AppText>
                      </View>
                      {ind.isNormal !== undefined ? (
                        <AppChip label={ind.isNormal ? 'Норма' : 'Отклонение'} tone={ind.isNormal ? 'success' : 'warning'} />
                      ) : null}
                    </View>
                    {ref ? (
                      <AppText variant="caption" color="mutedText">
                        {ref}
                      </AppText>
                    ) : null}
                  </AppCard>
                );
              })}
            </View>
          </AppSection>
        ) : null}

        {document.rawText ? (
          <AppSection title="Текст документа" subtitle="Распознанный текст (OCR)">
            <AppCard variant="glass">
              <AppText variant="mono" color="mutedText" selectable>
                {document.rawText}
              </AppText>
            </AppCard>
          </AppSection>
        ) : null}

        {linkedAnalyses.length > 0 ? (
          <AppSection title="Связанные анализы">
            <View style={{ gap: theme.spacing.sm }}>
              {linkedAnalyses.map((analysis) => {
                const dateStr = analysis.date ? new Date(analysis.date).toLocaleDateString('ru-RU') : '';
                const status = analysis.status || 'normal';
                return (
                  <Pressable key={analysis.id} onPress={() => router.push(`/analysis/${analysis.id}` as any)}>
                    <AppCard variant="interactive" style={{ gap: 6 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                        <AppText variant="bodyStrong" style={{ flex: 1 }}>
                          {analysis.title}
                        </AppText>
                        <AppChip label={status} tone={status === 'normal' ? 'success' : status === 'critical' ? 'danger' : 'warning'} />
                      </View>
                      <AppText variant="caption" color="mutedText">
                        {dateStr}
                      </AppText>
                    </AppCard>
                  </Pressable>
                );
              })}
            </View>
          </AppSection>
        ) : null}

        {document.notes ? (
          <AppSection title="Заметки">
            <AppCard variant="glass">
              <AppText selectable>{document.notes}</AppText>
            </AppCard>
          </AppSection>
        ) : null}

        <AppSection
          title="Проверка OCR"
          subtitle="Исправьте распознанные поля и сохраните"
          headerRight={
            <AppButton
              title={editMode ? 'Отмена' : 'Редактировать'}
              variant="secondary"
              size="sm"
              onPress={() => setEditMode((v) => !v)}
            />
          }>
          {editMode ? (
            <AppCard variant="glass" style={{ gap: theme.spacing.md }}>
              <AppInput label="Тип исследования" value={edits.studyType} onChangeText={(t) => setEdits((e) => ({ ...e, studyType: t }))} />
              <AppDateField
                label="Дата исследования"
                value={edits.studyDate}
                onChange={(t) => setEdits((e) => ({ ...e, studyDate: t }))}
              />
              <AppInput label="Лаборатория" value={edits.laboratory} onChangeText={(t) => setEdits((e) => ({ ...e, laboratory: t }))} />
              <AppInput label="Врач" value={edits.doctor} onChangeText={(t) => setEdits((e) => ({ ...e, doctor: t }))} />
              {edits.indicators.map((ind, idx) => (
                <View key={`${ind.name}-${idx}`} style={{ gap: 8, borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: 8 }}>
                  <AppInput
                    label="Показатель"
                    value={String(ind.name)}
                    onChangeText={(t) => {
                      const next = [...edits.indicators];
                      next[idx] = { ...next[idx], name: t };
                      setEdits((e) => ({ ...e, indicators: next }));
                    }}
                  />
                  <AppInput
                    label="Значение"
                    value={String(ind.value)}
                    onChangeText={(t) => {
                      const next = [...edits.indicators];
                      next[idx] = { ...next[idx], value: t };
                      setEdits((e) => ({ ...e, indicators: next }));
                    }}
                  />
                </View>
              ))}
              <AppButton
                title="Сохранить исправления"
                loading={saving}
                onPress={async () => {
                  try {
                    setSaving(true);
                    const updated = await reviewDocument(String(id), {
                      studyType: edits.studyType || undefined,
                      studyDate: edits.studyDate || undefined,
                      laboratory: edits.laboratory || undefined,
                      doctor: edits.doctor || undefined,
                      indicators: edits.indicators,
                    });
                    setDocument(updated);
                    setEditMode(false);
                    Alert.alert('Готово', 'Документ обновлён');
                  } catch (e: any) {
                    Alert.alert('Ошибка', e?.message || 'Не удалось сохранить');
                  } finally {
                    setSaving(false);
                  }
                }}
              />
            </AppCard>
          ) : (
            <AppCard variant="glass">
              <AppText variant="caption" color="mutedText">
                Нажмите «Редактировать», чтобы поправить OCR перед созданием анализа.
              </AppText>
            </AppCard>
          )}
        </AppSection>

        <AppButton
          title="Удалить документ"
          variant="danger"
          onPress={() => {
            Alert.alert('Удалить документ', 'Действие необратимо.', [
              { text: 'Отмена', style: 'cancel' },
              {
                text: 'Удалить',
                style: 'destructive',
                onPress: async () => {
                  try {
                    await deleteDocument(String(id));
                    router.back();
                  } catch (e: any) {
                    Alert.alert('Ошибка', e?.message || 'Не удалось удалить');
                  }
                },
              },
            ]);
          }}
        />
      </AppSection>
    </AppScreen>
  );
}
