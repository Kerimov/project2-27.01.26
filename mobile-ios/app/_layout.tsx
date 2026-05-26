import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { GlobalAIChat } from '@/components/GlobalAIChat';
import { useAppTheme } from '@/design/tokens';
import { useThemeStore } from '@/state/themeStore';

export default function RootLayout() {
  const bootstrapTheme = useThemeStore((s) => s.bootstrap);
  const appTheme = useAppTheme();
  const isDark = appTheme.scheme === 'dark';
  const baseNav = isDark ? DarkTheme : DefaultTheme;

  useEffect(() => {
    bootstrapTheme();
  }, [bootstrapTheme]);

  const navTheme = {
    ...baseNav,
    colors: {
      ...baseNav.colors,
      background: appTheme.colors.background,
      card: appTheme.colors.surfaceGlass,
      text: appTheme.colors.text,
      border: appTheme.colors.border,
      primary: appTheme.colors.primary,
    },
  };

  return (
    <SafeAreaProvider>
      <ThemeProvider value={navTheme}>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: appTheme.colors.surfaceGlass },
            headerTintColor: appTheme.colors.text,
            headerShadowVisible: false,
            headerTitleStyle: { fontWeight: '800' },
            contentStyle: { backgroundColor: appTheme.colors.background },
          }}>
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
        <GlobalAIChat />
        <StatusBar style={isDark ? 'light' : 'dark'} />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}