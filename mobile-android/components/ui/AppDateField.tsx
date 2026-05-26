import React, { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

import { useAppTheme } from '@/design/tokens';
import { AppText } from '@/components/ui/AppText';
import { AppButton } from '@/components/ui/AppButton';
import { formatRuDate, parseIsoDate, toIsoDate } from '@/lib/date-picker-format';

type AppDateFieldProps = {
  label?: string;
  value: string;
  onChange: (isoDate: string) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  placeholder?: string;
};

export function AppDateField({
  label,
  value,
  onChange,
  minimumDate,
  maximumDate,
  placeholder = 'Выберите дату',
}: AppDateFieldProps) {
  const theme = useAppTheme();
  const [show, setShow] = useState(false);
  const [draft, setDraft] = useState(() => parseIsoDate(value));

  const open = () => {
    setDraft(parseIsoDate(value));
    setShow(true);
  };

  const onAndroidChange = (event: DateTimePickerEvent, selected?: Date) => {
    setShow(false);
    if (event.type === 'dismissed' || !selected) return;
    onChange(toIsoDate(selected));
  };

  const confirmIos = () => {
    onChange(toIsoDate(draft));
    setShow(false);
  };

  const display = value ? formatRuDate(value) : placeholder;

  return (
    <View>
      {label ? (
        <AppText variant="bodyStrong" style={{ marginBottom: theme.spacing.xs }}>
          {label}
        </AppText>
      ) : null}
      <Pressable
        onPress={open}
        style={[
          styles.field,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.borderStrong,
            borderRadius: theme.radius.lg,
          },
        ]}
      >
        <AppText color={value ? undefined : 'mutedText'}>{display}</AppText>
      </Pressable>

      {show && Platform.OS === 'android' ? (
        <DateTimePicker
          value={parseIsoDate(value)}
          mode="date"
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={onAndroidChange}
        />
      ) : null}

      {show && Platform.OS === 'ios' ? (
        <Modal transparent animationType="slide" visible onRequestClose={() => setShow(false)}>
          <View style={styles.overlay}>
            <View style={[styles.sheet, { backgroundColor: theme.colors.surface }]}>
              <AppText variant="h3" style={{ marginBottom: theme.spacing.sm }}>
                {label || 'Дата'}
              </AppText>
              <DateTimePicker
                value={draft}
                mode="date"
                display="spinner"
                locale="ru-RU"
                minimumDate={minimumDate}
                maximumDate={maximumDate}
                onChange={(_, selected) => selected && setDraft(selected)}
              />
              <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.md }}>
                <AppButton title="Отмена" variant="secondary" onPress={() => setShow(false)} style={{ flex: 1 }} />
                <AppButton title="Готово" onPress={confirmIos} style={{ flex: 1 }} />
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    borderWidth: 1,
    minHeight: 58,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    paddingBottom: 28,
  },
});
