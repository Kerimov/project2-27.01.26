import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import { useRouter } from 'expo-router';

import { API_BASE_URL } from '../api/client';
import type { UserRole } from '../api/auth';
import { useAuthStore } from '../state/authStore';

function homeForRole(role?: UserRole): string {
  if (role === 'DOCTOR') return '/doctor';
  return '/(tabs)';
}
import { useAppTheme } from '@/design/tokens';
import { AppScreen } from '@/components/ui/AppScreen';
import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { AppInput } from '@/components/ui/AppInput';
import { AppButton } from '@/components/ui/AppButton';

export default function LoginScreen() {
  const router = useRouter();
  const { bootstrap, isBootstrapping, isLoading, error, login } = useAuthStore();
  const theme = useAppTheme();

  const [email, setEmail] = useState('seed@example.com');
  const [password, setPassword] = useState('seed1234');

  const baseUrlHint = useMemo(() => API_BASE_URL, []);

  useEffect(() => {
    // Автовосстановление сессии
    bootstrap().then((ok) => {
      if (!ok) return;
      const role = useAuthStore.getState().user?.role;
      if (role === 'ADMIN') {
        Alert.alert('Админ-панель', 'Управление доступно в веб-версии (http://localhost:3000/admin).');
        return;
      }
      router.replace(homeForRole(role) as any);
    });
  }, [bootstrap, router]);

  const onSubmit = async () => {
    const ok = await login(email.trim(), password);
    if (!ok) return;
    const role = useAuthStore.getState().user?.role;
    if (role === 'ADMIN') {
      Alert.alert('Админ-панель', 'Управление доступно в веб-версии (http://localhost:3000/admin).');
      return;
    }
    router.replace(homeForRole(role) as any);
  };

  if (isBootstrapping) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: theme.colors.background }}>
        <ActivityIndicator />
        <AppText variant="caption" color="mutedText" style={{ marginTop: theme.spacing.sm }}>
          Проверяем сессию…
        </AppText>
      </View>
    );
  }

  return (
    <AppScreen scroll={false} contentContainerStyle={{ flex: 1, justifyContent: 'center' }}>
      <AppCard>
        <AppText variant="title" style={{ textAlign: 'center' }}>
          Вход
        </AppText>
        <AppText variant="caption" color="mutedText" style={{ textAlign: 'center', marginTop: theme.spacing.sm }}>
          API: {baseUrlHint}
        </AppText>

        <View style={{ marginTop: theme.spacing.lg, gap: theme.spacing.md }}>
          <AppInput
            label="Email"
            placeholder="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <AppInput
            label="Пароль"
            placeholder="Пароль"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          {error ? (
            <AppText variant="caption" color="danger" style={{ textAlign: 'center' }}>
              {error}
            </AppText>
          ) : null}

          <AppButton title="Войти" loading={isLoading} onPress={onSubmit} fullWidth />
          <AppButton
            title="Регистрация"
            variant="ghost"
            onPress={() => router.push('/register' as any)}
            fullWidth
          />
        </View>
      </AppCard>
    </AppScreen>
  );
}