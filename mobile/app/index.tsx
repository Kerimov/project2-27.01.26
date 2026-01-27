import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Button, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { API_BASE_URL } from '../api/client';
import { useAuthStore } from '../state/authStore';

export default function LoginScreen() {
  const router = useRouter();
  const { bootstrap, isBootstrapping, isLoading, error, login } = useAuthStore();

  const [email, setEmail] = useState('seed@example.com');
  const [password, setPassword] = useState('seed1234');

  const baseUrlHint = useMemo(() => API_BASE_URL, []);

  useEffect(() => {
    // Автовосстановление сессии
    bootstrap().then((ok) => {
      if (ok) router.replace('/(tabs)');
    });
  }, [bootstrap, router]);

  const onSubmit = async () => {
    const ok = await login(email.trim(), password);
    if (ok) router.replace('/(tabs)');
  };

  if (isBootstrapping) {
    return (
      <View style={styles.container}>
        <ActivityIndicator />
        <Text style={styles.hint}>Проверяем сессию…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Вход</Text>

      <Text style={styles.baseUrl}>API: {baseUrlHint}</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Пароль"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {isLoading ? <ActivityIndicator /> : <Button title="Войти" onPress={onSubmit} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 24, fontWeight: '600', marginBottom: 12, textAlign: 'center' },
  baseUrl: { fontSize: 12, color: '#666', textAlign: 'center', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  error: { color: 'red', textAlign: 'center' },
  hint: { marginTop: 8, textAlign: 'center', color: '#666' },
});