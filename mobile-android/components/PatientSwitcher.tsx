import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { getCareLinks } from '../api/caretaker';
import { useCaretakerStore } from '../state/caretakerStore';
import { useAuthStore } from '../state/authStore';
import { useAppTheme } from '@/design/tokens';
import { AppText } from '@/components/ui/AppText';
import { AppChip } from '@/components/ui/AppChip';

/** Переключатель пациента для куратора (как на веб: дневник / лекарства / напоминания). */
export function PatientSwitcher() {
  const theme = useAppTheme();
  const { user } = useAuthStore();
  const { selectedPatientId, selectedPatientName, setPatient } = useCaretakerStore();
  const [links, setLinks] = useState<Array<{ id: string; name: string }>>([]);

  const load = useCallback(async () => {
    try {
      const data = await getCareLinks();
      setLinks(
        data.asCaretaker.map((l) => ({
          id: l.patient.id,
          name: l.patient.name || l.patient.email,
        }))
      );
    } catch {
      setLinks([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, user?.id]);

  if (links.length === 0) return null;

  return (
    <View style={{ gap: theme.spacing.sm, marginBottom: theme.spacing.md }}>
      <AppText variant="caption" color="mutedText">
        Пациент
        {selectedPatientId ? `: ${selectedPatientName || 'выбран'}` : ': вы (свои данные)'}
      </AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <AppChip
          label="Я"
          tone={!selectedPatientId ? 'primary' : 'neutral'}
          onPress={() => setPatient(null, null)}
        />
        {links.map((p) => (
          <AppChip
            key={p.id}
            label={p.name}
            tone={selectedPatientId === p.id ? 'primary' : 'neutral'}
            onPress={() => setPatient(p.id, p.name)}
          />
        ))}
      </View>
    </View>
  );
}
