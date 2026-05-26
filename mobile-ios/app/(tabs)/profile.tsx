import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import { useRouter } from 'expo-router';
 
import { getProfile, updateProfile, type PatientProfile, type Sex } from '../../api/profile';
import { me } from '../../api/me';
import {
  getAdminAiSettings,
  updateAdminAiSettings,
  type AdminAiSettingsResponse,
  type AiProviderId,
} from '../../api/admin-ai';
import { useAuthStore } from '../../state/authStore';
import { useThemeStore } from '../../state/themeStore';
import { setAuthToken } from '../../api/client';
 
import { useAppTheme } from '@/design/tokens';
import { AppScreen } from '@/components/ui/AppScreen';
import { AppSection } from '@/components/ui/AppSection';
import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { AppInput } from '@/components/ui/AppInput';
import { AppDateField } from '@/components/ui/AppDateField';
import { AppButton } from '@/components/ui/AppButton';
import { AppChip } from '@/components/ui/AppChip';
import { AppStatusBadge } from '@/components/ui/AppStatusBadge';
import { useBreakpoint } from '@/design/responsive';
 
export default function ProfileScreen() {
  const router = useRouter();
  const { logout, token } = useAuthStore();
  const themeScheme = useThemeStore((s) => s.scheme);
  const setThemeScheme = useThemeStore((s) => s.setScheme);
  const theme = useAppTheme();
  const bp = useBreakpoint();
 
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [aiData, setAiData] = useState<AdminAiSettingsResponse | null>(null);
  const [aiProvider, setAiProvider] = useState<AiProviderId>('deepseek');
  const [aiModel, setAiModel] = useState('');
  const [aiSaving, setAiSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
 
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
    if (token) setAuthToken(token);
  }, [token]);
 
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
          conditions: Array.isArray(profileData.conditions) ? profileData.conditions.join(', ') : '',
          allergies: Array.isArray(profileData.allergies) ? profileData.allergies.join(', ') : '',
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
    if (token) loadData();
  }, [token, loadData]);

  useEffect(() => {
    if (!token && !loading) {
      router.replace('/index' as any);
    }
  }, [token, loading, router]);

  const loadAiSettings = useCallback(async () => {
    if (!token || user?.role !== 'ADMIN') return;
    try {
      setAiLoading(true);
      setAuthToken(token);
      const data = await getAdminAiSettings();
      setAiData(data);
      setAiProvider(data.settings.provider);
      setAiModel(data.settings.model);
    } catch (e: any) {
      console.warn('AI settings load:', e?.message);
    } finally {
      setAiLoading(false);
    }
  }, [token, user?.role]);

  useEffect(() => {
    if (user?.role === 'ADMIN') loadAiSettings();
  }, [user?.role, loadAiSettings]);

  const handleSaveAi = async () => {
    if (!token || !aiModel) return;
    try {
      setAiSaving(true);
      setAuthToken(token);
      const res = await updateAdminAiSettings(aiProvider, aiModel);
      Alert.alert('Готово', res.message || 'Модель AI обновлена');
      await loadAiSettings();
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message || 'Не удалось сохранить');
    } finally {
      setAiSaving(false);
    }
  };
 
  const toOptionalInt = (v: string): number | null => {
    const s = (v || '').trim();
    if (!s) return null;
    const n = Number(s);
    if (!Number.isFinite(n)) return null;
    return Math.trunc(n);
  };
 
  const toOptionalFloat = (v: string): number | null => {
    const s = (v || '').trim().replace(',', '.');
    if (!s) return null;
    const n = Number(s);
    if (!Number.isFinite(n)) return null;
    return n;
  };
 
  const toOptionalIsoDate = (v: string): string | null => {
    const s = (v || '').trim();
    if (!s) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return null;
    return s;
  };
 
  const displayName = useMemo(() => {
    if (user?.name) return String(user.name);
    return user?.email ? String(user.email) : 'Пользователь';
  }, [user?.name, user?.email]);
 
  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
 
      if (!token) {
        Alert.alert('Ошибка', 'Необходима авторизация');
        return;
      }
 
      setAuthToken(token);
 
      const conditions = form.conditions.split(',').map((s) => s.trim()).filter(Boolean);
      const allergies = form.allergies.split(',').map((s) => s.trim()).filter(Boolean);
      const goals = form.goals.split(',').map((s) => s.trim()).filter(Boolean);
 
      const profileData = {
        sex: (form.sex as Sex) || null,
        birthDate: toOptionalIsoDate(form.birthDate),
        heightCm: toOptionalInt(form.heightCm),
        weightKg: toOptionalFloat(form.weightKg),
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
 
  const performLogout = async () => {
    try {
      await logout();
    } finally {
      (router as any).dismissAll?.();
      router.replace('/index' as any);
      setTimeout(() => router.replace('/index' as any), 50);
    }
  };

  const handleLogout = () => {
    Alert.alert('Выход', 'Вы уверены, что хотите выйти из аккаунта?', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Выйти',
        style: 'destructive',
        onPress: () => {
          void performLogout();
        },
      },
    ]);
  };
 
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: theme.colors.background }}>
        <ActivityIndicator />
        <AppText variant="caption" color="mutedText" style={{ marginTop: theme.spacing.sm }}>
          Загружаем профиль…
        </AppText>
      </View>
    );
  }

  return (
    <AppScreen contentContainerStyle={{ paddingBottom: 220 }}>
      <AppSection title="Профиль" subtitle={displayName}>
        <View style={{ gap: theme.spacing.lg }}>
          <AppCard variant="hero">
            <View style={{ gap: theme.spacing.sm }}>
              <AppStatusBadge label="AI-персонализация" tone="ai" />
              <AppText variant="h2">{displayName}</AppText>
              <AppText variant="caption" color="mutedText">
                Чем точнее профиль, тем полезнее рекомендации, план ухода и интерпретация анализов.
              </AppText>
            </View>
          </AppCard>

          <AppCard variant="glass">
            <AppSection title="Основное" subtitle="Заполните минимум — это усилит рекомендации и ИИ‑функции">
              <View style={{ gap: theme.spacing.md }}>
                <AppText variant="caption" color="mutedText">
                  Пол
                </AppText>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  <AppChip label="Мужской" tone={form.sex === 'MALE' ? 'ai' : 'neutral'} onPress={() => setForm({ ...form, sex: 'MALE' })} />
                  <AppChip
                    label="Женский"
                    tone={form.sex === 'FEMALE' ? 'ai' : 'neutral'}
                    onPress={() => setForm({ ...form, sex: 'FEMALE' })}
                  />
                  <AppChip
                    label="Не указывать"
                    tone={form.sex === '' ? 'ai' : 'neutral'}
                    onPress={() => setForm({ ...form, sex: '' })}
                  />
                </View>
 
                <AppDateField
                  label="Дата рождения"
                  value={form.birthDate}
                  onChange={(text) => setForm({ ...form, birthDate: text })}
                  maximumDate={new Date()}
                />
 
                <View style={{ flexDirection: bp === 'phone' ? 'column' : 'row', gap: theme.spacing.md }}>
                  <AppInput
                    label="Рост (см)"
                    placeholder="170"
                    keyboardType="numeric"
                    value={form.heightCm}
                    onChangeText={(text) => setForm({ ...form, heightCm: text })}
                    containerStyle={{ flex: 1 }}
                  />
                  <AppInput
                    label="Вес (кг)"
                    placeholder="70"
                    keyboardType="numeric"
                    value={form.weightKg}
                    onChangeText={(text) => setForm({ ...form, weightKg: text })}
                    containerStyle={{ flex: 1 }}
                  />
                </View>
              </View>
            </AppSection>
          </AppCard>
 
          <AppCard variant="glass">
            <AppSection title="История и цели" subtitle="Через запятую — приложение сохранит как список">
              <View style={{ gap: theme.spacing.md }}>
                <AppInput
                  label="Хронические заболевания"
                  placeholder="Гипертония, астма…"
                  value={form.conditions}
                  onChangeText={(text) => setForm({ ...form, conditions: text })}
                />
                <AppInput
                  label="Аллергии"
                  placeholder="Пенициллин, пыльца…"
                  value={form.allergies}
                  onChangeText={(text) => setForm({ ...form, allergies: text })}
                />
                <AppInput
                  label="Цели здоровья"
                  placeholder="Снизить вес, нормализовать давление…"
                  value={form.goals}
                  onChangeText={(text) => setForm({ ...form, goals: text })}
                />
                <AppInput
                  label="Заметки"
                  placeholder="Дополнительная информация…"
                  value={form.notes}
                  onChangeText={(text) => setForm({ ...form, notes: text })}
                  multiline
                  numberOfLines={4}
                  style={{ minHeight: 100, textAlignVertical: 'top' as any }}
                />
              </View>
            </AppSection>
          </AppCard>
 
          {user?.role === 'ADMIN' ? (
            <AppCard variant="glass">
              <AppSection
                title="AI-модель (админ)"
                subtitle={
                  aiData?.settings.modelLabel
                    ? `Активная: ${aiData.settings.modelLabel}`
                    : 'Выберите активную модель для всего приложения'
                }
              >
                {aiLoading ? (
                  <ActivityIndicator style={{ marginVertical: theme.spacing.md }} />
                ) : (
                  <View style={{ gap: theme.spacing.md }}>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {(aiData?.models ?? []).map((m) => {
                        const active = aiProvider === m.provider && aiModel === m.model;
                        return (
                          <AppChip
                            key={`${m.provider}-${m.model}`}
                            label={active ? `✓ ${m.label}` : m.label}
                            tone={active ? 'ai' : 'neutral'}
                            onPress={() => {
                              setAiProvider(m.provider);
                              setAiModel(m.model);
                            }}
                          />
                        );
                      })}
                    </View>
                    {aiData?.vision ? (
                      <AppText variant="caption" color="mutedText">
                        OCR фото: {aiData.vision.label} (отдельно, из .env)
                      </AppText>
                    ) : null}
                    <AppButton
                      title="Применить"
                      icon="sparkles"
                      variant="ai"
                      loading={aiSaving}
                      onPress={handleSaveAi}
                      fullWidth
                    />
                  </View>
                )}
              </AppSection>
            </AppCard>
          ) : null}

          <AppCard variant="glass">
            <AppSection title="Оформление" subtitle="Светлая или тёмная тема интерфейса">
              <View style={{ gap: theme.spacing.md }}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  <AppChip
                    label="Светлая"
                    tone={themeScheme === 'light' ? 'primary' : 'neutral'}
                    onPress={() => setThemeScheme('light')}
                  />
                  <AppChip
                    label="Тёмная"
                    tone={themeScheme === 'dark' ? 'primary' : 'neutral'}
                    onPress={() => setThemeScheme('dark')}
                  />
                </View>
                <AppText variant="caption" color="mutedText">
                  Выбор сохраняется на этом устройстве.
                </AppText>
              </View>
            </AppSection>
          </AppCard>

          <AppCard variant="glass">
            <AppSection title="Сервисы" subtitle="Как на веб-версии">
              <View style={{ gap: theme.spacing.sm }}>
                <AppButton title="Аналитика" icon="chart.bar.fill" variant="secondary" onPress={() => router.push('/analytics' as any)} fullWidth />
                <AppButton title="База знаний" icon="book.closed.fill" variant="secondary" onPress={() => router.push('/knowledge' as any)} fullWidth />
                <AppButton title="Маркетплейс клиник" icon="building.2.fill" variant="secondary" onPress={() => router.push('/marketplace' as any)} fullWidth />
                <AppButton title="Помощь и FAQ" icon="questionmark.circle.fill" variant="secondary" onPress={() => router.push('/help' as any)} fullWidth />
              </View>
            </AppSection>
          </AppCard>

          <View style={{ flexDirection: bp === 'phone' ? 'column' : 'row', gap: theme.spacing.md }}>
            <AppButton
              title="Сохранить"
              icon="checkmark.circle.fill"
              variant="ai"
              loading={saving}
              onPress={handleSave}
              fullWidth
              style={{ flex: bp === 'phone' ? undefined : 1 }}
            />
            <AppButton
              title="Кураторский доступ"
              icon="person.fill"
              variant="secondary"
              onPress={() => router.push('/caretaker' as any)}
              fullWidth
              style={{ flex: bp === 'phone' ? undefined : 1 }}
            />
          </View>
 
          <AppButton title="Выйти" variant="danger" onPress={handleLogout} fullWidth />
 
          {error ? (
            <AppCard variant="surface2">
              <AppText variant="body" color="danger" style={{ textAlign: 'center' }}>
                {error}
              </AppText>
            </AppCard>
          ) : null}
        </View>
      </AppSection>
    </AppScreen>
  );
}

