import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';

import { sendAIMessage, type AIMessage, type AIChatRequest } from '../api/ai';
import { getDocuments, type DocumentSummary } from '../api/documents';
import { useAuthStore } from '../state/authStore';
import { setAuthToken } from '../api/client';
import { useAppTheme } from '@/design/tokens';
import { AppScreen } from '@/components/ui/AppScreen';
import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { AppButton } from '@/components/ui/AppButton';
import { AppChip } from '@/components/ui/AppChip';
import { AppFAB } from '@/components/ui/AppFAB';
import { IconSymbol } from '@/components/ui/icon-symbol';

type AttachedDocument = {
  id: string;
  fileName: string;
  studyType?: string;
};

type AIChatProps = {
  initialDocumentIds?: string[];
  autoOpen?: boolean;
};

export function AIChat({ initialDocumentIds, autoOpen }: AIChatProps = {}) {
  const router = useRouter();
  const { token } = useAuthStore();
  const theme = useAppTheme();

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<AIMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content:
        'Здравствуйте! 👋 Я ваш персональный медицинский ассистент. Я могу помочь вам:\n\n• 📅 Записаться на прием к врачу\n• 📊 Показать результаты анализов\n• 💡 Дать персональные рекомендации\n• 👨‍⚕️ Найти подходящего врача\n• 📋 Показать ваши записи на приемы\n\nПросто скажите, что вам нужно!',
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [availableDocuments, setAvailableDocuments] = useState<AttachedDocument[]>([]);
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [showDocumentSelector, setShowDocumentSelector] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (token) {
      setAuthToken(token);
    }
  }, [token]);

  useEffect(() => {
    if (initialDocumentIds?.length) {
      setSelectedDocuments(initialDocumentIds);
      if (autoOpen) setIsOpen(true);
    }
  }, [initialDocumentIds, autoOpen]);

  useEffect(() => {
    if (isOpen && availableDocuments.length === 0 && token) {
      fetchDocuments();
    }
  }, [isOpen, token]);

  const fetchDocuments = useCallback(async () => {
    if (!token) return;
    try {
      setAuthToken(token);
      const docs = await getDocuments();
      setAvailableDocuments(
        docs.map((doc) => ({
          id: doc.id,
          fileName: doc.fileName,
          studyType: doc.studyType || undefined,
        }))
      );
    } catch (error) {
      console.error('Failed to fetch documents:', error);
    }
  }, [token]);

  const toggleDocumentSelection = (documentId: string) => {
    setSelectedDocuments((prev) =>
      prev.includes(documentId) ? prev.filter((id) => id !== documentId) : [...prev, documentId]
    );
  };

  const removeSelectedDocument = (documentId: string) => {
    setSelectedDocuments((prev) => prev.filter((id) => id !== documentId));
  };

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading || !token) return;

    const attachedDocs = selectedDocuments
      .map((id) => availableDocuments.find((doc) => doc.id === id)!)
      .filter(Boolean);

    const userMessage: AIMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
      attachedDocuments: attachedDocs.length > 0 ? attachedDocs : undefined,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setSelectedDocuments([]);
    setShowDocumentSelector(false);
    setIsLoading(true);

    try {
      setAuthToken(token);

      const request: AIChatRequest = {
        message: userMessage.content,
        history: messages.slice(-10), // Последние 10 сообщений для контекста
        documentIds: selectedDocuments.length > 0 ? selectedDocuments : undefined,
        ragScope: selectedDocuments.length > 0 ? 'attached' : 'all', // RAG по прикрепленным или по всем данным
      };

      const data = await sendAIMessage(request);

      const assistantMessage: AIMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response,
        timestamp: data.timestamp,
        functionResult: data.functionResult,
        functionName: data.functionName,
        sources: Array.isArray(data.sources) ? data.sources : undefined,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
      const errorMessage: AIMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Извините, произошла ошибка: ${error?.message || 'Неизвестная ошибка'}. Пожалуйста, попробуйте еще раз.`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, token, selectedDocuments, availableDocuments, messages]);

  const clearChat = () => {
    setMessages([
      {
        id: '1',
        role: 'assistant',
        content:
          'Здравствуйте! 👋 Я ваш персональный медицинский ассистент. Я могу помочь вам:\n\n• 📅 Записаться на прием к врачу\n• 📊 Показать результаты анализов\n• 💡 Дать персональные рекомендации\n• 👨‍⚕️ Найти подходящего врача\n• 📋 Показать ваши записи на приемы\n\nПросто скажите, что вам нужно!',
        timestamp: new Date().toISOString(),
      },
    ]);
    setSelectedDocuments([]);
    setShowDocumentSelector(false);
  };

  const getFunctionLabel = (functionName?: string): string => {
    switch (functionName) {
      case 'book_appointment':
        return '📅 Запись на прием';
      case 'get_analysis_results':
        return '📊 Результаты анализов';
      case 'get_recommendations':
        return '💡 Рекомендации';
      case 'get_doctors':
        return '👨‍⚕️ Список врачей';
      case 'get_appointments':
        return '📋 Записи на приемы';
      default:
        return 'Функция выполнена';
    }
  };

  const renderMessage = ({ item }: { item: AIMessage }) => {
    const isUser = item.role === 'user';
    const time = new Date(item.timestamp).toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    });

    return (
      <View
        style={{
          flexDirection: 'row',
          gap: theme.spacing.sm,
          justifyContent: isUser ? 'flex-end' : 'flex-start',
          marginBottom: theme.spacing.md,
        }}>
        {!isUser && (
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: theme.colors.surface2,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <IconSymbol name="sparkles" size={18} color={theme.colors.primary} />
          </View>
        )}

        <View style={{ maxWidth: '75%', gap: 6 }}>
          {item.attachedDocuments && item.attachedDocuments.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
              {item.attachedDocuments.map((doc) => (
                <AppChip key={doc.id} label={doc.studyType || doc.fileName} tone="neutral" />
              ))}
            </View>
          )}

          <AppCard
            variant={isUser ? 'surface' : 'surface2'}
            style={{
              backgroundColor: isUser ? theme.colors.primary : theme.colors.surface2,
              padding: theme.spacing.md,
            }}>
            <AppText
              variant="body"
              style={{
                color: isUser ? '#fff' : theme.colors.text,
              }}>
              {item.content}
            </AppText>

            {item.functionResult && item.functionName && (
              <View
                style={{
                  marginTop: theme.spacing.sm,
                  padding: theme.spacing.sm,
                  backgroundColor: isUser ? 'rgba(255,255,255,0.2)' : theme.colors.surface,
                  borderRadius: theme.radius.md,
                  gap: 4,
                }}>
                <AppText variant="caption" style={{ color: isUser ? '#fff' : theme.colors.success }}>
                  {getFunctionLabel(item.functionName)}
                </AppText>
                {item.functionName === 'book_appointment' && (
                  <AppText variant="caption" style={{ color: isUser ? '#fff' : theme.colors.text }}>
                    Запись успешно создана! Проверьте раздел "Записи".
                  </AppText>
                )}
              </View>
            )}

            {!isUser && Array.isArray(item.sources) && item.sources.length > 0 && (
              <View style={{ marginTop: theme.spacing.sm, gap: 4 }}>
                <AppText variant="caption" color="mutedText" style={{ marginBottom: 4 }}>
                  Источники:
                </AppText>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                  {(() => {
                    const seen = new Set<string>();
                    const unique = item.sources.filter((s) => {
                      const key = String(s.url || `${s.sourceType || 'src'}:${s.id || s.label || ''}`);
                      if (seen.has(key)) return false;
                      seen.add(key);
                      return true;
                    });
                    return unique.slice(0, 6);
                  })().map((s, idx) => {
                    const label = (s.label || s.sourceType || `SOURCE ${idx + 1}`).toString();
                    return (
                      <Pressable
                        key={`${s.id || idx}`}
                        onPress={() => {
                          if (s.url) {
                            if (s.url.startsWith('/documents/')) {
                              router.push(`/document/${s.url.split('/').pop()}` as any);
                            } else if (s.url.startsWith('/analyses/')) {
                              router.push(`/analysis/${s.url.split('/').pop()}` as any);
                            }
                          }
                        }}>
                        <AppChip
                          label={label}
                          tone={s.url ? 'primary' : 'neutral'}
                          style={{ opacity: s.url ? 1 : 0.7 }}
                        />
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            <AppText
              variant="caption"
              style={{
                marginTop: theme.spacing.xs,
                color: isUser ? 'rgba(255,255,255,0.7)' : theme.colors.mutedText,
              }}>
              {time}
            </AppText>
          </AppCard>

          {isUser && (
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: theme.colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
                alignSelf: 'flex-end',
              }}>
              <IconSymbol name="person.fill" size={18} color="#fff" />
            </View>
          )}
        </View>
      </View>
    );
  };

  if (!isOpen) {
    return <AppFAB icon="sparkles" onPress={() => setIsOpen(true)} />;
  }

  return (
    <Modal visible={isOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setIsOpen(false)}>
      <AppScreen scroll={false} contentContainerStyle={{ flex: 1 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingBottom: theme.spacing.md,
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.border,
            marginBottom: theme.spacing.md,
          }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: theme.colors.surface2,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <IconSymbol name="sparkles" size={24} color={theme.colors.primary} />
            </View>
            <View>
              <AppText variant="h3">AI Ассистент</AppText>
              <AppText variant="caption" color="mutedText">
                Персональный медицинский помощник
              </AppText>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <AppButton
              title="Очистить"
              variant="ghost"
              size="sm"
              onPress={clearChat}
              style={{ minWidth: 80 }}
            />
            <AppButton title="Закрыть" variant="ghost" size="sm" onPress={() => setIsOpen(false)} />
          </View>
        </View>

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={{ paddingBottom: theme.spacing.lg }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          ListFooterComponent={
            isLoading ? (
              <View style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'center' }}>
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: theme.colors.surface2,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <IconSymbol name="sparkles" size={18} color={theme.colors.primary} />
                </View>
                <AppCard variant="surface2" style={{ padding: theme.spacing.md }}>
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                </AppCard>
              </View>
            ) : null
          }
        />

        <View style={{ gap: theme.spacing.sm, paddingTop: theme.spacing.md, borderTopWidth: 1, borderTopColor: theme.colors.border }}>
          {selectedDocuments.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
              {selectedDocuments.map((docId) => {
                const doc = availableDocuments.find((d) => d.id === docId);
                return doc ? (
                  <View key={docId} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <AppChip label={doc.studyType || doc.fileName} tone="primary" />
                    <Pressable onPress={() => removeSelectedDocument(docId)}>
                      <IconSymbol name="xmark.circle.fill" size={16} color={theme.colors.danger} />
                    </Pressable>
                  </View>
                ) : null;
              })}
            </View>
          )}

          {showDocumentSelector && (
            <AppCard variant="surface2" style={{ maxHeight: 150 }}>
              <FlatList
                data={availableDocuments}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => toggleDocumentSelection(item.id)}
                    style={{
                      padding: theme.spacing.sm,
                      backgroundColor: selectedDocuments.includes(item.id)
                        ? theme.colors.primary + '20'
                        : 'transparent',
                      borderRadius: theme.radius.md,
                      marginBottom: theme.spacing.xs,
                    }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <AppText variant="caption">{item.studyType || item.fileName}</AppText>
                      {selectedDocuments.includes(item.id) && (
                        <IconSymbol name="checkmark.circle.fill" size={16} color={theme.colors.primary} />
                      )}
                    </View>
                  </Pressable>
                )}
                ListEmptyComponent={
                  <AppText variant="caption" color="mutedText" style={{ textAlign: 'center', padding: theme.spacing.md }}>
                    Нет загруженных документов
                  </AppText>
                }
              />
            </AppCard>
          )}

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs }}>
            <AppButton
              title="📅 Запись"
              variant="secondary"
              size="sm"
              onPress={() => setInput('Хочу записаться на прием')}
              disabled={isLoading}
            />
            <AppButton
              title="👨‍⚕️ Врачи"
              variant="secondary"
              size="sm"
              onPress={() => setInput('Покажи список врачей')}
              disabled={isLoading}
            />
            <AppButton
              title="📊 Анализы"
              variant="secondary"
              size="sm"
              onPress={() => setInput('Покажи мои результаты анализов')}
              disabled={isLoading}
            />
            <AppButton
              title="📋 Записи"
              variant="secondary"
              size="sm"
              onPress={() => setInput('Покажи мои записи на приемы')}
              disabled={isLoading}
            />
          </View>

          <View style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'center' }}>
            <Pressable
              onPress={() => setShowDocumentSelector(!showDocumentSelector)}
              disabled={isLoading}
              style={{
                width: 44,
                height: 44,
                borderRadius: theme.radius.md,
                backgroundColor: theme.colors.surface2,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: selectedDocuments.length > 0 ? 2 : 0,
                borderColor: theme.colors.primary,
              }}>
              <IconSymbol
                name="paperclip"
                size={20}
                color={selectedDocuments.length > 0 ? theme.colors.primary : theme.colors.text}
              />
            </Pressable>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Напишите ваш вопрос..."
              placeholderTextColor={theme.colors.mutedText}
              multiline
              style={{
                flex: 1,
                minHeight: 44,
                maxHeight: 100,
                paddingHorizontal: theme.spacing.md,
                paddingVertical: theme.spacing.sm,
                backgroundColor: theme.colors.surface2,
                borderRadius: theme.radius.md,
                color: theme.colors.text,
                fontSize: 14,
                borderWidth: 1,
                borderColor: theme.colors.border,
              }}
              editable={!isLoading}
            />
            <AppButton
              title={isLoading ? '' : 'Отправить'}
              onPress={handleSend}
              disabled={!input.trim() || isLoading}
              loading={isLoading}
              style={{ minWidth: isLoading ? 44 : 100 }}
            />
          </View>

          <AppText variant="caption" color="mutedText" style={{ textAlign: 'center', marginTop: theme.spacing.xs }}>
            AI может ошибаться. Проверяйте важную информацию.
          </AppText>
        </View>
      </AppScreen>
    </Modal>
  );
}
