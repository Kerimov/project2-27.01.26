import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
 
import {
  getCareLinks,
  createCareLink,
  deleteCareLink,
  type CareLinksResponse,
} from '../api/caretaker';
 
import { useAppTheme } from '@/design/tokens';
import { AppScreen } from '@/components/ui/AppScreen';
import { AppSection } from '@/components/ui/AppSection';
import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { AppInput } from '@/components/ui/AppInput';
import { AppButton } from '@/components/ui/AppButton';
import { useBreakpoint } from '@/design/responsive';
 
export default function CaretakerScreen() {
  const theme = useAppTheme();
  const bp = useBreakpoint();
 
  const [links, setLinks] = useState<CareLinksResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [creating, setCreating] = useState(false);
 
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
 
  useEffect(() => {
    loadLinks();
  }, [loadLinks]);
 
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
    Alert.alert('Удалить доступ', `Вы уверены, что хотите удалить доступ для ${name}?`, [
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
    ]);
  };
 
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: theme.colors.background }}>
        <ActivityIndicator />
        <AppText variant="caption" color="mutedText" style={{ marginTop: theme.spacing.sm }}>
          Загружаем связи…
        </AppText>
      </View>
    );
  }
 
  const hasNoLinks = !links || (links.asPatient.length === 0 && links.asCaretaker.length === 0);
 
  return (
    <AppScreen>
      <AppSection title="Кураторский доступ" subtitle="Управляйте доступом к вашим данным">
        <View style={{ gap: theme.spacing.lg }}>
          <AppCard>
            <AppSection title="Добавить куратора" subtitle="Email пользователя, которому предоставляете доступ">
              <View style={{ flexDirection: bp === 'phone' ? 'column' : 'row', gap: theme.spacing.md }}>
                <AppInput
                  label="Email"
                  placeholder="email@example.com"
                  value={newEmail}
                  onChangeText={setNewEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  containerStyle={{ flex: 1 }}
                />
                <AppButton title="Добавить" loading={creating} onPress={handleAdd} fullWidth style={{ flex: bp === 'phone' ? undefined : 0.6 }} />
              </View>
            </AppSection>
          </AppCard>
 
          {links?.asPatient?.length ? (
            <AppSection title="Мои кураторы" subtitle="Пользователи, у которых есть доступ к вашим данным">
              <View style={{ gap: theme.spacing.md }}>
                {links.asPatient.map((l) => (
                  <AppCard key={l.id} padded={false} style={{ padding: theme.spacing.lg }}>
                    <AppText variant="h3">{l.caretaker.name}</AppText>
                    <AppText variant="caption" color="mutedText" style={{ marginTop: 4 }}>
                      {l.caretaker.email}
                    </AppText>
                    <View style={{ marginTop: theme.spacing.md }}>
                      <AppButton title="Удалить" size="sm" variant="danger" onPress={() => handleDelete(l.id, l.caretaker.name)} />
                    </View>
                  </AppCard>
                ))}
              </View>
            </AppSection>
          ) : null}
 
          {links?.asCaretaker?.length ? (
            <AppSection title="Доступ к пациентам" subtitle="Пациенты, к которым у вас есть доступ">
              <View style={{ gap: theme.spacing.md }}>
                {links.asCaretaker.map((l) => (
                  <AppCard key={l.id} padded={false} style={{ padding: theme.spacing.lg }}>
                    <AppText variant="h3">{l.patient.name}</AppText>
                    <AppText variant="caption" color="mutedText" style={{ marginTop: 4 }}>
                      {l.patient.email}
                    </AppText>
                    <View style={{ marginTop: theme.spacing.md }}>
                      <AppButton title="Удалить" size="sm" variant="danger" onPress={() => handleDelete(l.id, l.patient.name)} />
                    </View>
                  </AppCard>
                ))}
              </View>
            </AppSection>
          ) : null}
 
          {hasNoLinks ? (
            <AppCard variant="surface2">
              <AppText variant="body" color="mutedText" style={{ textAlign: 'center' }}>
                Нет активных связей
              </AppText>
            </AppCard>
          ) : null}
 
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

