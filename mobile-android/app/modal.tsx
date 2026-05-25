import React from 'react';
import { useRouter } from 'expo-router';

import { AppScreen } from '@/components/ui/AppScreen';
import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { AppButton } from '@/components/ui/AppButton';

export default function ModalScreen() {
  const router = useRouter();
  return (
    <AppScreen scroll={false} contentContainerStyle={{ flex: 1, justifyContent: 'center' }}>
      <AppCard style={{ gap: 12 }}>
        <AppText variant="h2">Модальное окно</AppText>
        <AppText color="mutedText">
          Это служебный экран. Если он открылся случайно — просто закройте.
        </AppText>
        <AppButton title="Закрыть" onPress={() => router.back()} />
      </AppCard>
    </AppScreen>
  );
}
