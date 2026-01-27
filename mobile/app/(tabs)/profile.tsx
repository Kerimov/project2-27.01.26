import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';

import { getProfile, updateProfile, type PatientProfile, type Sex } from '../../api/profile';
import { me } from '../../api/me';
import { useAuthStore } from '../../state/authStore';
import { setAuthToken } from '../../api/client';

export default function ProfileScreen() {
  const router = useRouter();
  const { logout, token } = useAuthStore();

  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    sex: '' as Sex | '',
    birthDate: '',
    heightCm: '',
    weightKg: '',
    conditions: '',
    allergies: '',
    goals: '',
    notes: '',
  });

  useEffect(() => {
    if (token) {
      setAuthToken(token);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      loadData();
    }
  }, [token, loadData]);

  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError(null);
      setAuthToken(token);
      const [userData, profileData] = await Promise.all([me(), getProfile()]);
      setUser(userData.user);
      setProfile(profileData);
      if (profileData) {
        setForm({
          sex: profileData.sex || '',
          birthDate: profileData.birthDate
            ? new Date(profileData.birthDate).toISOString().split('T')[0]
            : '',
          heightCm: profileData.heightCm?.toString() || '',
          weightKg: profileData.weightKg?.toString() || '',
          conditions: Array.isArray(profileData.conditions)
            ? profileData.conditions.join(', ')
            : '',
          allergies: Array.isArray(profileData.allergies)
            ? profileData.allergies.join(', ')
            : '',
          goals: Array.isArray(profileData.goals) ? profileData.goals.join(', ') : '',
          notes: profileData.notes || '',
        });
      }
    } catch (e: any) {
      setError(e?.message || 'Не удалось загрузить данные');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      loadData();
    }
  }, [token, loadData]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      if (!token) {
        Alert.alert('Ошибка', 'Необходима авторизация');
        return;
      }

      setAuthToken(token);

      const conditions = form.conditions
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const allergies = form.allergies
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const goals = form.goals
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const profileData = {
        sex: (form.sex as Sex) || null,
        birthDate: form.birthDate || null,
        heightCm: form.heightCm ? parseInt(form.heightCm, 10) : null,
        weightKg: form.weightKg ? parseFloat(form.weightKg) : null,
        conditions: conditions.length > 0 ? conditions : undefined,
        allergies: allergies.length > 0 ? allergies : undefined,
        goals: goals.length > 0 ? goals : undefined,
        notes: form.notes.trim() || null,
      };

      await updateProfile(profileData);

      Alert.alert('Успех', 'Профиль сохранен');
      await loadData();
    } catch (e: any) {
      const errorMessage = e?.payload?.error || e?.message || 'Не удалось сохранить профиль';
      setError(errorMessage);
      Alert.alert('Ошибка', errorMessage);
      console.error('Profile save error:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Выход', 'Вы уверены, что хотите выйти?', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Выйти',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/login' as any);
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.hint}>Загружаем профиль…</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Профиль</Text>
        {user && (
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user.name}</Text>
            <Text style={styles.userEmail}>{user.email}</Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Пол</Text>
        <View style={styles.sexButtons}>
          <TouchableOpacity
            style={[styles.sexButton, form.sex === 'MALE' && styles.sexButtonSelected]}
            onPress={() => setForm({ ...form, sex: 'MALE' })}>
            <Text
              style={[
                styles.sexButtonText,
                form.sex === 'MALE' && styles.sexButtonTextSelected,
              ]}>
              Мужской
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sexButton, form.sex === 'FEMALE' && styles.sexButtonSelected]}
            onPress={() => setForm({ ...form, sex: 'FEMALE' })}>
            <Text
              style={[
                styles.sexButtonText,
                form.sex === 'FEMALE' && styles.sexButtonTextSelected,
              ]}>
              Женский
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Дата рождения</Text>
        <TextInput
          style={styles.input}
          placeholder="ГГГГ-ММ-ДД"
          value={form.birthDate}
          onChangeText={(text) => setForm({ ...form, birthDate: text })}
        />
      </View>

      <View style={styles.row}>
        <View style={[styles.section, styles.halfWidth]}>
          <Text style={styles.label}>Рост (см)</Text>
          <TextInput
            style={styles.input}
            placeholder="170"
            keyboardType="numeric"
            value={form.heightCm}
            onChangeText={(text) => setForm({ ...form, heightCm: text })}
          />
        </View>
        <View style={[styles.section, styles.halfWidth]}>
          <Text style={styles.label}>Вес (кг)</Text>
          <TextInput
            style={styles.input}
            placeholder="70"
            keyboardType="numeric"
            value={form.weightKg}
            onChangeText={(text) => setForm({ ...form, weightKg: text })}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Хронические заболевания</Text>
        <Text style={styles.hint}>Через запятую</Text>
        <TextInput
          style={styles.textArea}
          multiline
          placeholder="Гипертония, астма..."
          value={form.conditions}
          onChangeText={(text) => setForm({ ...form, conditions: text })}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Аллергии</Text>
        <Text style={styles.hint}>Через запятую</Text>
        <TextInput
          style={styles.textArea}
          multiline
          placeholder="Пенициллин, пыльца..."
          value={form.allergies}
          onChangeText={(text) => setForm({ ...form, allergies: text })}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Цели здоровья</Text>
        <Text style={styles.hint}>Через запятую</Text>
        <TextInput
          style={styles.textArea}
          multiline
          placeholder="Снизить вес, нормализовать давление..."
          value={form.goals}
          onChangeText={(text) => setForm({ ...form, goals: text })}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Заметки</Text>
        <TextInput
          style={styles.textArea}
          multiline
          numberOfLines={4}
          placeholder="Дополнительная информация..."
          value={form.notes}
          onChangeText={(text) => setForm({ ...form, notes: text })}
        />
      </View>

      <TouchableOpacity
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={saving}>
        {saving ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.saveButtonText}>Сохранить</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.caretakerButton}
        onPress={() => router.push('/caretaker' as any)}>
        <Text style={styles.caretakerButtonText}>Управление кураторским доступом</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>Выйти</Text>
      </TouchableOpacity>

      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 16,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  header: {
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  userInfo: {
    marginTop: 8,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  section: {
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  hint: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    backgroundColor: '#f9f9f9',
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    backgroundColor: '#f9f9f9',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  sexButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  sexButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  sexButtonSelected: {
    backgroundColor: '#0066cc',
    borderColor: '#0066cc',
  },
  sexButtonText: {
    fontSize: 14,
    color: '#333',
  },
  sexButtonTextSelected: {
    color: 'white',
    fontWeight: '600',
  },
  saveButton: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#0066cc',
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  caretakerButton: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    marginTop: 8,
  },
  caretakerButtonText: {
    color: '#0066cc',
    fontSize: 16,
    fontWeight: '600',
  },
  logoutButton: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#f44336',
    alignItems: 'center',
    marginTop: 8,
  },
  logoutButtonText: {
    color: 'white',
    fontSize: 16,
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
