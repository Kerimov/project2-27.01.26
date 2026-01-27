import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  getCareLinks,
  createCareLink,
  deleteCareLink,
  type CareLinksResponse,
} from '../api/caretaker';

export default function CaretakerScreen() {
  const [links, setLinks] = useState<CareLinksResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadLinks();
  }, []);

  const loadLinks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getCareLinks();
      setLinks(data);
    } catch (e: any) {
      setError(e?.message || 'Не удалось загрузить связи');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleAdd = async () => {
    if (!newEmail.trim()) {
      Alert.alert('Ошибка', 'Введите email');
      return;
    }

    try {
      setCreating(true);
      await createCareLink(newEmail.trim().toLowerCase());
      Alert.alert('Успех', 'Доступ предоставлен');
      setNewEmail('');
      await loadLinks();
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message || 'Не удалось предоставить доступ');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    Alert.alert(
      'Удалить доступ',
      `Вы уверены, что хотите удалить доступ для ${name}?`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCareLink(id);
              Alert.alert('Успех', 'Доступ удален');
              await loadLinks();
            } catch (e: any) {
              Alert.alert('Ошибка', e?.message || 'Не удалось удалить доступ');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.hint}>Загружаем связи…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Кураторский доступ</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Добавить куратора</Text>
        <Text style={styles.hint}>Введите email пользователя, которому хотите предоставить доступ</Text>
        <View style={styles.addRow}>
          <TextInput
            style={styles.emailInput}
            placeholder="email@example.com"
            value={newEmail}
            onChangeText={setNewEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TouchableOpacity
            style={[styles.addButton, creating && styles.addButtonDisabled]}
            onPress={handleAdd}
            disabled={creating}>
            {creating ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.addButtonText}>Добавить</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {links && (
        <>
          {links.asPatient.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Мои кураторы</Text>
              <FlatList
                data={links.asPatient}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <View style={styles.linkCard}>
                    <View style={styles.linkInfo}>
                      <Text style={styles.linkName}>{item.caretaker.name}</Text>
                      <Text style={styles.linkEmail}>{item.caretaker.email}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleDelete(item.id, item.caretaker.name)}>
                      <Text style={styles.deleteButtonText}>Удалить</Text>
                    </TouchableOpacity>
                  </View>
                )}
                scrollEnabled={false}
              />
            </View>
          )}

          {links.asCaretaker.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Пациенты, к которым у меня есть доступ</Text>
              <FlatList
                data={links.asCaretaker}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <View style={styles.linkCard}>
                    <View style={styles.linkInfo}>
                      <Text style={styles.linkName}>{item.patient.name}</Text>
                      <Text style={styles.linkEmail}>{item.patient.email}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleDelete(item.id, item.patient.name)}>
                      <Text style={styles.deleteButtonText}>Удалить</Text>
                    </TouchableOpacity>
                  </View>
                )}
                scrollEnabled={false}
              />
            </View>
          )}

          {links.asPatient.length === 0 && links.asCaretaker.length === 0 && (
            <View style={styles.center}>
              <Text style={styles.hint}>Нет активных связей</Text>
            </View>
          )}
        </>
      )}

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
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  hint: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  addRow: {
    flexDirection: 'row',
    gap: 8,
  },
  emailInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    backgroundColor: 'white',
  },
  addButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#0066cc',
    justifyContent: 'center',
  },
  addButtonDisabled: {
    opacity: 0.6,
  },
  addButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  linkCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'white',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  linkInfo: {
    flex: 1,
  },
  linkName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  linkEmail: {
    fontSize: 12,
    color: '#666',
  },
  deleteButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#f44336',
  },
  deleteButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  errorContainer: {
    padding: 16,
    backgroundColor: '#ffebee',
    borderRadius: 8,
    marginTop: 8,
  },
  error: {
    color: '#f44336',
    textAlign: 'center',
  },
});
