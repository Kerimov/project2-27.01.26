import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import { useAuthStore } from '../state/authStore';
import { useAppTheme } from '@/design/tokens';
import { AppScreen } from '@/components/ui/AppScreen';
import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { AppInput } from '@/components/ui/AppInput';
import { AppButton } from '@/components/ui/AppButton';

export default function RegisterScreen() {
  const router = useRouter();
  const { register, isLoading, error } = useAuthStore();
  const theme = useAppTheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const onSubmit = async () => {
    if (password !== confirm) return;
    if (password.length < 6) return;
    const ok = await register(email.trim(), password, name.trim());
    if (ok) router.replace('/(tabs)');
  };

  const localError =
    password !== confirm && confirm.length > 0
      ? 'Пароли не совпадают'
      : password.length > 0 && password.length < 6
        ? 'Минимум 6 символов'
        : null;

  return (
    <AppScreen contentContainerStyle={{ flex: 1, justifyContent: 'center' }}>
      <AppCard>
        <AppText variant="title" style={{ textAlign: 'center' }}>
          Регистрация
        </AppText>
        <View style={{ marginTop: theme.spacing.lg, gap: theme.spacing.md }}>
          <AppInput label="Имя" value={name} onChangeText={setName} />
          <AppInput label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          <AppInput label="Пароль" value={password} onChangeText={setPassword} secureTextEntry />
          <AppInput label="Повтор пароля" value={confirm} onChangeText={setConfirm} secureTextEntry />
          {(error || localError) ? (
            <AppText variant="caption" color="danger" style={{ textAlign: 'center' }}>
              {localError || error}
            </AppText>
          ) : null}
          <AppButton title="Зарегистрироваться" loading={isLoading} onPress={onSubmit} fullWidth />
          <AppButton title="Уже есть аккаунт" variant="ghost" onPress={() => router.replace('/' as any)} fullWidth />
        </View>
      </AppCard>
    </AppScreen>
  );
}
