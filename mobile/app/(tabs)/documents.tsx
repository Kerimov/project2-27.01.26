import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';

import { getDocuments, uploadDocument, type DocumentSummary } from '../../api/documents';
import { useAuthStore } from '../../state/authStore';

export default function DocumentsScreen() {
  const router = useRouter();
  const { token } = useAuthStore();

  const [items, setItems] = useState<DocumentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pollingIds, setPollingIds] = useState<Set<string>>(new Set());
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const loadDocuments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getDocuments();
      setItems(data);
    } catch (e: any) {
      setError(e?.message || 'Не удалось загрузить документы');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  // Polling для документов в обработке
  useEffect(() => {
    if (pollingIds.size === 0) {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      return;
    }

    pollingIntervalRef.current = setInterval(async () => {
      try {
        const updated = await getDocuments();
        setItems(updated);
        
        // Убираем из polling те, что уже обработаны
        const stillProcessing = updated.filter(
          (doc) => pollingIds.has(doc.id) && !doc.parsed
        );
        if (stillProcessing.length === 0) {
          setPollingIds(new Set());
        }
      } catch (e) {
        console.error('Polling error:', e);
      }
    }, 3000); // Проверяем каждые 3 секунды

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [pollingIds]);

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Ошибка', 'Необходимо разрешение на доступ к галерее');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await handleUpload(
          result.assets[0].uri,
          result.assets[0].fileName || 'image.jpg',
          result.assets[0].mimeType || 'image/jpeg'
        );
      }
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message || 'Не удалось выбрать изображение');
    }
  };

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Ошибка', 'Необходимо разрешение на использование камеры');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await handleUpload(
          result.assets[0].uri,
          result.assets[0].fileName || 'photo.jpg',
          result.assets[0].mimeType || 'image/jpeg'
        );
      }
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message || 'Не удалось сделать фото');
    }
  };

  const handleUpload = async (uri: string, fileName: string, mimeType: string) => {
    try {
      setUploading(true);
      const result = await uploadDocument(uri, fileName, mimeType, token);
      
      // Добавляем в polling
      setPollingIds((prev) => new Set(prev).add(result.document.id));
      
      Alert.alert('Успех', 'Документ загружен. Обработка началась.');
      await loadDocuments();
    } catch (e: any) {
      Alert.alert('Ошибка загрузки', e?.message || 'Не удалось загрузить документ');
    } finally {
      setUploading(false);
    }
  };

  const showUploadOptions = () => {
    Alert.alert(
      'Добавить документ',
      'Выберите источник',
      [
        { text: 'Камера', onPress: handleTakePhoto },
        { text: 'Галерея', onPress: handlePickImage },
        { text: 'Отмена', style: 'cancel' },
      ]
    );
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const renderItem = ({ item }: { item: DocumentSummary }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/document/${item.id}` as any)}>
      <Text style={styles.title}>{item.fileName}</Text>
      <Text style={styles.subtitle}>
        {new Date(item.uploadDate).toLocaleDateString()} · {formatFileSize(item.fileSize)}
      </Text>
      {item.studyType ? <Text style={styles.studyType}>{item.studyType}</Text> : null}
      {item.parsed ? (
        <Text style={styles.parsed}>✓ Обработан</Text>
      ) : (
        <Text style={styles.processing}>⏳ Обрабатывается...</Text>
      )}
    </TouchableOpacity>
  );

  if (loading && !items.length) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.hint}>Загружаем документы…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={renderItem}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text>Документы пока не найдены.</Text>
          </View>
        }
        refreshing={loading}
        onRefresh={loadDocuments}
      />
      <TouchableOpacity
        style={[styles.fab, uploading && styles.fabDisabled]}
        onPress={showUploadOptions}
        disabled={uploading}>
        {uploading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.fabText}>+</Text>
        )}
      </TouchableOpacity>
      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  hint: { marginTop: 8, color: '#666' },
  error: { color: 'red', textAlign: 'center' },
  errorContainer: {
    padding: 16,
    backgroundColor: '#ffebee',
  },
  listContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 80,
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
  studyType: {
    fontSize: 12,
    color: '#444',
    marginBottom: 4,
  },
  parsed: {
    fontSize: 12,
    color: '#4caf50',
    fontWeight: '500',
  },
  processing: {
    fontSize: 12,
    color: '#ff9800',
    fontWeight: '500',
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0066cc',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  fabDisabled: {
    opacity: 0.6,
  },
  fabText: {
    fontSize: 32,
    color: 'white',
    fontWeight: '300',
  },
});
