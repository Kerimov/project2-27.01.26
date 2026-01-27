import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';

import { getAnalyses, type AnalysisSummary } from '../../api/analyses';

export default function AnalysesScreen() {
  const router = useRouter();

  const [items, setItems] = useState<AnalysisSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getAnalyses();
        if (mounted) setItems(data);
      } catch (e: any) {
        if (mounted) setError(e?.message || 'Не удалось загрузить анализы');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const renderItem = ({ item }: { item: AnalysisSummary }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/analysis/${item.id}` as any)}>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.subtitle}>
        {new Date(item.date).toLocaleDateString()} · {item.type || 'Без типа'}
      </Text>
      {item.laboratory ? <Text style={styles.laboratory}>{item.laboratory}</Text> : null}
      {item.status ? <Text style={styles.status}>Статус: {item.status}</Text> : null}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.hint}>Загружаем анализы…</Text>
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

  if (!items.length) {
    return (
      <View style={styles.center}>
        <Text>Анализы пока не найдены.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      renderItem={renderItem}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  hint: { marginTop: 8, color: '#666' },
  error: { color: 'red', textAlign: 'center' },
  listContent: {
    padding: 16,
    gap: 12,
  },
  card: {
    borderRadius: 12,
    padding: 12,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  laboratory: {
    fontSize: 12,
    color: '#444',
    marginBottom: 4,
  },
  status: {
    fontSize: 12,
    color: '#0066cc',
    fontWeight: '500',
  },
});

