import React from 'react';
import {
  StyleProp,
  StyleSheet,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
 
import { useAppTheme } from '@/design/tokens';
import { AppText } from '@/components/ui/AppText';
 
export type AppInputProps = TextInputProps & {
  label?: string;
  hint?: string;
  error?: string;
  containerStyle?: StyleProp<ViewStyle>;
};
 
export function AppInput({ label, hint, error, containerStyle, style, ...rest }: AppInputProps) {
  const theme = useAppTheme();
 
  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <AppText variant="bodyStrong" style={{ marginBottom: theme.spacing.xs }}>
          {label}
        </AppText>
      ) : null}
      <TextInput
        placeholderTextColor={theme.colors.mutedText}
        style={[
          styles.input,
          {
            backgroundColor: theme.colors.surface,
            borderColor: error ? theme.colors.danger : theme.colors.borderStrong,
            borderRadius: theme.radius.lg,
            color: theme.colors.text,
            paddingHorizontal: theme.spacing.lg,
            paddingVertical: 16,
          },
          style,
        ]}
        {...rest}
      />
      {error ? (
        <AppText variant="caption" color="danger" style={{ marginTop: theme.spacing.xs }}>
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption" color="mutedText" style={{ marginTop: theme.spacing.xs }}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}
 
const styles = StyleSheet.create({
  container: {},
  input: {
    borderWidth: 1,
    fontSize: 17,
    lineHeight: 24,
    minHeight: 58,
  },
});

