import React from 'react';

import { AppScreen } from '@/components/ui/AppScreen';
import { AppSection } from '@/components/ui/AppSection';
import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';

export default function ExploreScreen() {
  return (
    <AppScreen>
      <AppSection title="О приложении" subtitle="Справочная информация">
        <AppCard style={{ gap: 10 }}>
          <AppText>
            Это Android-приложение повторяет функционал веб-версии и использует единый адаптивный дизайн
            для телефонов и планшетов.
          </AppText>
          <AppText color="mutedText" variant="caption">
            Если вы видите этот экран — он служебный и может быть использован позже для раздела “Помощь”.
          </AppText>
        </AppCard>
      </AppSection>
    </AppScreen>
  );
}
