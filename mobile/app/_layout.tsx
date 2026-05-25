import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/use-color-scheme';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <SafeAreaProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="register" options={{ title: 'Регистрация' }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="doctor" options={{ headerShown: false }} />
          <Stack.Screen name="reminder/create" options={{ title: 'Новое напоминание' }} />
          <Stack.Screen name="care-plan/create" options={{ title: 'Новая задача' }} />
          <Stack.Screen name="analyses/create" options={{ title: 'Новый анализ' }} />
          <Stack.Screen name="analysis/[id]" options={{ title: 'Анализ' }} />
          <Stack.Screen name="document/[id]" options={{ title: 'Документ' }} />
          <Stack.Screen name="appointment/create" options={{ title: 'Новая запись' }} />
          <Stack.Screen name="appointment/[id]" options={{ title: 'Запись' }} />
          <Stack.Screen name="pre-visit/[id]" options={{ title: 'Анкета' }} />
          <Stack.Screen name="medication/create" options={{ title: 'Новое лекарство' }} />
          <Stack.Screen name="medication/[id]" options={{ title: 'Лекарство' }} />
          <Stack.Screen name="diary/create" options={{ title: 'Запись дневника' }} />
          <Stack.Screen name="diary/[id]" options={{ title: 'Дневник' }} />
          <Stack.Screen name="caretaker" options={{ title: 'Куратор' }} />
          <Stack.Screen name="help" options={{ title: 'Помощь' }} />
          <Stack.Screen name="knowledge" options={{ title: 'База знаний' }} />
          <Stack.Screen name="analytics" options={{ title: 'Аналитика' }} />
          <Stack.Screen name="marketplace/index" options={{ title: 'Маркетплейс' }} />
          <Stack.Screen name="marketplace/[id]" options={{ title: 'Клиника' }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}