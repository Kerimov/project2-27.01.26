import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

import { getDocuments, uploadDocument, deleteDocument, type DocumentSummary } from '../../api/documents';
import { useAuthStore } from '../../state/authStore';
import { useAppTheme } from '@/design/tokens';
import { useContentPadding, useMaxContentWidth } from '@/design/responsive';
import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { AppButton } from '@/components/ui/AppButton';
import { AppFAB } from '@/components/ui/AppFAB';
import { AppChip } from '@/components/ui/AppChip';
import { AppScreen } from '@/components/ui/AppScreen';

export default function DocumentsScreen() {
  const router = useRouter();
  const { token } = useAuthStore();
  const theme = useAppTheme();
  const pad = useContentPadding();
  const { maxWidth } = useMaxContentWidth();

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

  const handlePickPdf = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        await handleUpload(
          asset.uri,
          asset.name || 'document.pdf',
          asset.mimeType || 'application/pdf'
        );
      }
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message || 'Не удалось выбрать файл');
    }
  };

  const showUploadOptions = () => {
    Alert.alert(
      'Добавить документ',
      'Выберите источник',
      [
        { text: 'Камера', onPress: handleTakePhoto },
        { text: 'Галерея', onPress: handlePickImage },
        { text: 'PDF / файл', onPress: handlePickPdf },
        { text: 'Отмена', style: 'cancel' },
      ]
    );
  };

  const handleDelete = (item: DocumentSummary) => {
    Alert.alert('Удалить документ', `Удалить «${item.fileName}»? Действие необратимо.`, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDocument(item.id);
            await loadDocuments();
          } catch (e: any) {
            Alert.alert('Ошибка', e?.message || 'Не удалось удалить документ');
          }
        },
      },
    ]);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const renderItem = ({ item }: { item: DocumentSummary }) => (
    <AppCard style={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
      <Pressable onPress={() => router.push(`/document/${item.id}` as any)}>
        {({ pressed }) => (
          <View style={{ opacity: pressed ? 0.95 : 1 }}>
            <AppText variant="h3">{item.fileName}</AppText>
            <AppText variant="caption" color="mutedText" style={{ marginTop: theme.spacing.xs }}>
              {new Date(item.uploadDate).toLocaleDateString('ru-RU')} · {formatFileSize(item.fileSize)}
            </AppText>
            {item.studyType ? (
              <AppText variant="caption" color="mutedText" style={{ marginTop: theme.spacing.xs }}>
                {item.studyType}
              </AppText>
            ) : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: theme.spacing.md }}>
              {item.parsed ? <AppChip label="Обработан" tone="primary" /> : <AppChip label="Обрабатывается…" />}
              {typeof item.ocrConfidence === 'number' ? (
                <AppChip label={`OCR: ${Math.round(item.ocrConfidence * 100)}%`} />
              ) : null}
            </View>
          </View>
        )}
      </Pressable>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <AppButton
          title="Открыть"
          variant="secondary"
          size="sm"
          onPress={() => router.push(`/document/${item.id}` as any)}
        />
        <AppButton title="Удалить" variant="danger" size="sm" onPress={() => handleDelete(item)} />
      </View>
    </AppCard>
  );

  if (loading && !items.length) {
    return (
      <AppScreen
        scroll={false}
        contentContainerStyle={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.sm }}>
        <ActivityIndicator />
        <AppText variant="caption" color="mutedText">
          Загружаем документы…
        </AppText>
      </AppScreen>
    );
  }

  return (
    <AppScreen scroll={false} contentContainerStyle={{ flex: 1 }}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          gap: theme.spacing.md,
          paddingBottom: pad.vertical + 96,
        }}
        renderItem={renderItem}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <AppText variant="body" color="mutedText">
              Документы пока не найдены.
            </AppText>
          </View>
        }
        refreshing={loading}
        onRefresh={loadDocuments}
      />
      <AppFAB icon="plus" onPress={showUploadOptions} disabled={uploading} style={{ opacity: uploading ? 0.6 : 1 }} />
      {error ? (
        <View style={{ paddingBottom: pad.vertical }}>
          <AppCard variant="surface2">
            <AppText variant="body" color="danger" style={{ textAlign: 'center' }}>
              {error}
            </AppText>
          </AppCard>
        </View>
      ) : null}
    </AppScreen>
  );
}
