import React, { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

import { useAppTheme } from '@/design/tokens';
import { AppText } from '@/components/ui/AppText';
import { AppButton } from '@/components/ui/AppButton';
import { parseTimeString, toTimeString } from '@/lib/date-picker-format';

type AppTimeFieldProps = {
  label?: string;
  value: string;
  onChange: (time: string) => void;
  placeholder?: string;
};

export function AppTimeField({
  label,
  value,
  onChange,
  placeholder = 'Выберите время',
}: AppTimeFieldProps) {
  const theme = useAppTheme();
  const [show, setShow] = useState(false);
  const [draft, setDraft] = useState(() => parseTimeString(value));

  const open = () => {
    setDraft(parseTimeString(value));
    setShow(true);
  };

  const onAndroidChange = (event: DateTimePickerEvent, selected?: Date) => {
    setShow(false);
    if (event.type === 'dismissed' || !selected) return;
    onChange(toTimeString(selected));
  };

  const confirmIos = () => {
    onChange(toTimeString(draft));
    setShow(false);
  };

  const display = value ? value : placeholder;

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
        <DateTimePicker value={parseTimeString(value)} mode="time" is24Hour onChange={onAndroidChange} />
      ) : null}

      {show && Platform.OS === 'ios' ? (
        <Modal transparent animationType="slide" visible onRequestClose={() => setShow(false)}>
          <View style={styles.overlay}>
            <View style={[styles.sheet, { backgroundColor: theme.colors.surface }]}>
              <AppText variant="h3" style={{ marginBottom: theme.spacing.sm }}>
                {label || 'Время'}
              </AppText>
              <DateTimePicker
                value={draft}
                mode="time"
                display="spinner"
                locale="ru-RU"
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
