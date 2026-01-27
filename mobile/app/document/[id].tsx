import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { getDocument, type DocumentDetail } from '../../api/documents';
import { getAnalyses, type AnalysisSummary } from '../../api/analyses';

export default function DocumentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

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
  }, [id]);

  const handleOpenFile = () => {
    if (document?.fileUrl) {
      Linking.openURL(document.fileUrl).catch((err) =>
        console.error('Failed to open file:', err)
      );
    }
  };

  if (!id) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Некорректный идентификатор документа</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.hint}>Загружаем документ…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  if (!document) {
    return (
      <View style={styles.center}>
        <Text>Документ не найден.</Text>
      </View>
    );
  }

  const isMedicalReport = document.category === 'medical_report';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{document.fileName}</Text>
      <Text style={styles.meta}>
        Загружен: {new Date(document.uploadDate).toLocaleDateString()}
      </Text>
      {document.studyType ? (
        <Text style={styles.meta}>Тип исследования: {document.studyType}</Text>
      ) : null}
      {document.studyDate ? (
        <Text style={styles.meta}>
          Дата исследования: {new Date(document.studyDate).toLocaleDateString()}
        </Text>
      ) : null}
      {document.laboratory ? (
        <Text style={styles.meta}>Лаборатория: {document.laboratory}</Text>
      ) : null}
      {document.doctor ? <Text style={styles.meta}>Врач: {document.doctor}</Text> : null}
      {document.category ? (
        <Text style={styles.meta}>Категория: {document.category}</Text>
      ) : null}
      {document.parsed ? (
        <Text style={styles.parsed}>✓ Обработан</Text>
      ) : (
        <Text style={styles.processing}>⏳ Обрабатывается...</Text>
      )}

      {document.rawText && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Текст документа</Text>
          <Text style={styles.textContent}>{document.rawText}</Text>
        </View>
      )}

      {document.indicators && Array.isArray(document.indicators) && document.indicators.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Показатели</Text>
          {document.indicators.map((ind, idx) => (
            <View key={idx} style={styles.indicatorRow}>
              <Text style={styles.indicatorName}>{ind.name}</Text>
              <Text style={styles.indicatorValue}>
                {ind.value} {ind.unit || ''}
              </Text>
              {ind.referenceMin !== undefined && ind.referenceMax !== undefined && (
                <Text style={styles.indicatorRef}>
                  Референс: {ind.referenceMin} - {ind.referenceMax} {ind.unit || ''}
                </Text>
              )}
              {ind.isNormal !== undefined && (
                <Text
                  style={[
                    styles.indicatorStatus,
                    ind.isNormal ? styles.normal : styles.abnormal,
                  ]}>
                  {ind.isNormal ? '✓ Норма' : '⚠ Отклонение'}
                </Text>
              )}
            </View>
          ))}
        </View>
      )}

      {document.findings && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Заключение</Text>
          <Text>{document.findings}</Text>
        </View>
      )}

      {linkedAnalyses.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Связанные анализы</Text>
          {linkedAnalyses.map((analysis) => (
            <TouchableOpacity
              key={analysis.id}
              style={styles.analysisLink}
              onPress={() => router.push(`/analysis/${analysis.id}` as any)}>
              <Text style={styles.analysisLinkText}>{analysis.title}</Text>
              <Text style={styles.analysisLinkMeta}>
                {new Date(analysis.date).toLocaleDateString()} · {analysis.status || 'normal'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {document.fileUrl && (
        <TouchableOpacity style={styles.openButton} onPress={handleOpenFile}>
          <Text style={styles.openButtonText}>Открыть файл</Text>
        </TouchableOpacity>
      )}

      {document.notes && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Заметки</Text>
          <Text>{document.notes}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 12,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  meta: {
    fontSize: 12,
    color: '#666',
  },
  parsed: {
    marginTop: 4,
    fontSize: 12,
    color: '#4caf50',
    fontWeight: '500',
  },
  processing: {
    marginTop: 4,
    fontSize: 12,
    color: '#ff9800',
    fontWeight: '500',
  },
  section: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  textContent: {
    fontSize: 14,
    lineHeight: 20,
  },
  indicatorRow: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  indicatorName: {
    fontSize: 14,
    fontWeight: '500',
  },
  indicatorValue: {
    fontSize: 14,
    marginTop: 2,
  },
  indicatorRef: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  indicatorStatus: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  normal: {
    color: '#4caf50',
  },
  abnormal: {
    color: '#f44336',
  },
  analysisLink: {
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginBottom: 8,
  },
  analysisLinkText: {
    fontSize: 14,
    fontWeight: '500',
  },
  analysisLinkMeta: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  openButton: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#0066cc',
    borderRadius: 8,
    alignItems: 'center',
  },
  openButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  error: { color: 'red', textAlign: 'center' },
  hint: { marginTop: 8, textAlign: 'center', color: '#666' },
});
