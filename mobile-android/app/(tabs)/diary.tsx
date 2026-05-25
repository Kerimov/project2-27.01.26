import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { useAppTheme } from '@/design/tokens';
import { AppScreen } from '@/components/ui/AppScreen';
import { AppText } from '@/components/ui/AppText';
import { AppChip } from '@/components/ui/AppChip';
import { DiaryEntriesSection } from '../../components/diary/DiaryEntriesSection';
import { MedicationsSection } from '../../components/diary/MedicationsSection';
import { CarePlanSection } from '../../components/diary/CarePlanSection';

type DiarySection = 'entries' | 'medications' | 'plan';

function parseSection(raw: string | string[] | undefined): DiarySection {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v === 'medications' || v === 'plan') return v;
  return 'entries';
}

export default function DiaryScreen() {
  const theme = useAppTheme();
  const params = useLocalSearchParams<{ section?: string }>();
  const [section, setSection] = useState<DiarySection>(() => parseSection(params.section));

  useEffect(() => {
    setSection(parseSection(params.section));
  }, [params.section]);

  const chips: { id: DiarySection; label: string }[] = [
    { id: 'entries', label: 'Записи' },
    { id: 'medications', label: 'Лекарства' },
    { id: 'plan', label: 'План' },
  ];

  return (
    <AppScreen scroll={false} contentContainerStyle={{ flex: 1 }}>
      <AppText variant="h2" style={{ marginBottom: theme.spacing.xs }}>
        Дневник
      </AppText>
      <AppText variant="caption" color="mutedText" style={{ marginBottom: theme.spacing.sm }}>
        Записи, лекарства и план действий
      </AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: theme.spacing.sm }}>
        {chips.map((c) => (
          <AppChip
            key={c.id}
            label={c.label}
            tone={section === c.id ? 'primary' : 'neutral'}
            onPress={() => setSection(c.id)}
          />
        ))}
      </View>
      <View style={{ flex: 1 }}>
        {section === 'entries' && <DiaryEntriesSection />}
        {section === 'medications' && <MedicationsSection />}
        {section === 'plan' && <CarePlanSection />}
      </View>
    </AppScreen>
  );
}
