import React from 'react';
import { View } from 'react-native';

import { useAppTheme } from '@/design/tokens';
import { AppDateField } from '@/components/ui/AppDateField';
import { AppTimeField } from '@/components/ui/AppTimeField';
import { splitDateTimeLocal, toDateTimeLocalValue } from '@/lib/date-picker-format';

type AppDateTimeFieldProps = {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  minimumDate?: Date;
};

export function AppDateTimeField({ label, value, onChange, minimumDate }: AppDateTimeFieldProps) {
  const theme = useAppTheme();
  const { date, time } = splitDateTimeLocal(value);

  return (
    <View style={{ gap: theme.spacing.md }}>
      <AppDateField
        label={label ? `${label} — дата` : 'Дата'}
        value={date}
        minimumDate={minimumDate}
        onChange={(d) => onChange(toDateTimeLocalValue(d, time))}
      />
      <AppTimeField
        label={label ? `${label} — время` : 'Время'}
        value={time}
        onChange={(t) => onChange(toDateTimeLocalValue(date, t))}
      />
    </View>
  );
}
