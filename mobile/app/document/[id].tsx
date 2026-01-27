import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { getDocument, type DocumentDetail } from '../../api/documents';
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

export default function DocumentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { token } = useAuthStore();
  const theme = useAppTheme();

  const [document, setDocument] = useState<DocumentDetail | null>(null);
  const [linkedAnalyses, setLinkedAnalyses] = useState<AnalysisSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const handleOpenFile = () => {
    if (document?.fileUrl) {
      Linking.openURL(document.fileUrl).catch((err) =>
        console.error('Failed to open file:', err)
      );
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

  const uploadedAt = useMemo(
    () => (document?.uploadDate ? new Date(document.uploadDate).toLocaleDateString('ru-RU') : ''),
    [document?.uploadDate]
  );
  const studyAt = useMemo(
    () => (document?.studyDate ? new Date(document.studyDate).toLocaleDateString('ru-RU') : ''),
    [document?.studyDate]
  );

  return (
    <AppScreen>
      <AppSection
        title={document.fileName}
        subtitle={uploadedAt ? `Загружен: ${uploadedAt}` : undefined}
        headerRight={
          document.fileUrl ? <AppButton title="Открыть" variant="secondary" size="sm" onPress={handleOpenFile} /> : null
        }>
        <AppCard style={{ gap: theme.spacing.sm }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <AppChip label={document.parsed ? 'Обработан' : 'В обработке'} tone={document.parsed ? 'primary' : 'neutral'} />
            {typeof document.ocrConfidence === 'number' ? (
              <AppChip label={`OCR: ${Math.round(document.ocrConfidence * 100)}%`} />
            ) : null}
            {document.category ? <AppChip label={document.category} /> : null}
          </View>

          {document.studyType ? <AppText variant="caption" color="mutedText">Тип исследования: {document.studyType}</AppText> : null}
          {studyAt ? <AppText variant="caption" color="mutedText">Дата исследования: {studyAt}</AppText> : null}
          {document.laboratory ? <AppText variant="caption" color="mutedText">Лаборатория: {document.laboratory}</AppText> : null}
          {document.doctor ? <AppText variant="caption" color="mutedText">Врач: {document.doctor}</AppText> : null}
        </AppCard>

        {document.findings ? (
          <AppSection title="Заключение">
            <AppCard>
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
                  <AppCard key={`${ind.name}-${idx}`} style={{ gap: 6 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                      <View style={{ flex: 1 }}>
                        <AppText variant="bodyStrong">{ind.name}</AppText>
                        <AppText color="mutedText" variant="caption">
                          {value}
                        </AppText>
                      </View>
                      {ind.isNormal !== undefined ? (
                        <AppChip label={ind.isNormal ? 'Норма' : 'Отклонение'} tone={ind.isNormal ? 'primary' : 'neutral'} />
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
            <AppCard>
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
                    <AppCard style={{ gap: 6 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                        <AppText variant="bodyStrong" style={{ flex: 1 }}>
                          {analysis.title}
                        </AppText>
                        <AppChip label={status} />
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
            <AppCard>
              <AppText selectable>{document.notes}</AppText>
            </AppCard>
          </AppSection>
        ) : null}
      </AppSection>
    </AppScreen>
  );
}
