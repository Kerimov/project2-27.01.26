import { Redirect, Stack } from 'expo-router';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';

import { useAuthStore } from '../../state/authStore';

export default function DoctorLayout() {
  const { token, isBootstrapping, user } = useAuthStore();

  if (isBootstrapping) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!token) {
    return <Redirect href="/" />;
  }

  if (user?.role !== 'DOCTOR') {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Кабинет врача' }} />
      <Stack.Screen name="appointments" options={{ title: 'Записи' }} />
      <Stack.Screen name="patients" options={{ title: 'Пациенты' }} />
    </Stack>
  );
}
