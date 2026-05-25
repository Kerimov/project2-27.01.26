import { Redirect, Tabs } from 'expo-router';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { FLOATING_TAB_BAR } from '@/design/tab-bar';
import { useAppTheme } from '@/design/tokens';
import { useAuthStore } from '../../state/authStore';

export default function TabLayout() {
  const theme = useAppTheme();
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

  if (user?.role === 'DOCTOR') {
    return <Redirect href="/doctor" />;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.tabIconDefault,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '700',
        },
        tabBarStyle: {
          position: 'absolute',
          left: 10,
          right: 10,
          bottom: FLOATING_TAB_BAR.marginBottom,
          height: FLOATING_TAB_BAR.height,
          paddingTop: 9,
          paddingBottom: 11,
          borderRadius: 24,
          borderWidth: 1,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surfaceGlass,
          shadowColor: '#000',
          shadowOpacity: theme.scheme === 'dark' ? 0.22 : 0.08,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 8 },
          elevation: 6,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Главная',
          tabBarIcon: ({ color, focused }) => <IconSymbol size={focused ? 27 : 24} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="analyses"
        options={{
          title: 'Анализы',
          tabBarIcon: ({ color, focused }) => <IconSymbol size={focused ? 27 : 24} name="waveform.path.ecg" color={color} />,
        }}
      />
      <Tabs.Screen
        name="documents"
        options={{
          title: 'Документы',
          tabBarIcon: ({ color, focused }) => <IconSymbol size={focused ? 27 : 24} name="doc.text.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="care-plan"
        options={{
          title: 'План',
          tabBarIcon: ({ color, focused }) => <IconSymbol size={focused ? 27 : 24} name="checkmark.circle.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="appointments"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="medications"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="diary"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="reminders"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Профиль',
          tabBarIcon: ({ color, focused }) => <IconSymbol size={focused ? 27 : 24} name="person.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
