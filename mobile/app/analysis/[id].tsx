import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { getAnalysis, type AnalysisDetail } from '../../api/analyses';

export default function AnalysisDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [item, setItem] = useState<AnalysisDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getAnalysis(String(id));
        if (mounted) setItem(data);
      } catch (e: any) {
        if (mounted) setError(e?.message || 'Не удалось загрузить анализ');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id]);

  if (!id) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Некорректный идентификатор анализа</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.hint}>Загружаем анализ…</Text>
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

  if (!item) {
    return (
      <View style={styles.center}>
        <Text>Анализ не найден.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.meta}>
        {new Date(item.date).toLocaleDateString()} · {item.type || 'Без типа'}
      </Text>
      {item.laboratory ? <Text style={styles.meta}>Лаборатория: {item.laboratory}</Text> : null}
      {item.doctor ? <Text style={styles.meta}>Врач: {item.doctor}</Text> : null}
      {item.status ? <Text style={styles.status}>Статус: {item.status}</Text> : null}
      {item.normalRange ? (
        <Text style={styles.meta}>Нормальный диапазон: {item.normalRange}</Text>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Показатели</Text>
        {Array.isArray(item.results) && item.results.length ? (
          item.results.map((r, idx) => (
            <View key={idx} style={styles.resultRow}>
              <View style={styles.resultMain}>
                <Text style={styles.resultName}>{r.name}</Text>
                <Text style={styles.resultValue}>
                  {r.value} {r.unit || ''}
                </Text>
              </View>
              {r.reference ? <Text style={styles.resultRef}>Референс: {r.reference}</Text> : null}
              {r.flag ? <Text style={styles.resultFlag}>Флаг: {r.flag}</Text> : null}
            </View>
          ))
        ) : (
          <Text style={styles.hint}>Нет структурированных показателей.</Text>
        )}
      </View>

      {item.notes ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Заметки</Text>
          <Text>{item.notes}</Text>
        </View>
      ) : null}
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
  status: {
    marginTop: 4,
    fontSize: 12,
    color: '#0066cc',
    fontWeight: '600',
  },
  section: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  resultRow: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  resultMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  resultName: {
    fontSize: 14,
    fontWeight: '500',
  },
  resultValue: {
    fontSize: 14,
  },
  resultRef: {
    fontSize: 12,
    color: '#666',
  },
  resultFlag: {
    fontSize: 12,
    color: '#cc0000',
  },
  error: { color: 'red', textAlign: 'center' },
  hint: { marginTop: 8, textAlign: 'center', color: '#666' },
});

