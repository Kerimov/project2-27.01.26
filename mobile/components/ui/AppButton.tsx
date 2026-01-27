import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  TextStyle,
  ViewStyle,
} from 'react-native';
 
import { useAppTheme } from '@/design/tokens';
import { AppText } from '@/components/ui/AppText';
 
export type AppButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type AppButtonSize = 'sm' | 'md' | 'lg';
 
export type AppButtonProps = Omit<PressableProps, 'style'> & {
  title: string;
  variant?: AppButtonVariant;
  size?: AppButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};
 
export function AppButton({
  title,
  variant = 'primary',
  size = 'md',
  loading,
  fullWidth,
  disabled,
  style,
  textStyle,
  ...rest
}: AppButtonProps) {
  const theme = useAppTheme();
  const isDisabled = disabled || loading;
 
  const paddingY = size === 'sm' ? 8 : size === 'lg' ? 14 : 11;
  const paddingX = size === 'sm' ? 12 : size === 'lg' ? 16 : 14;
  const radius = size === 'sm' ? theme.radius.sm : theme.radius.md;
 
  const bg =
    variant === 'primary'
      ? theme.colors.primary
      : variant === 'secondary'
        ? theme.colors.surface2
        : variant === 'danger'
          ? theme.colors.danger
          : 'transparent';
 
  const borderColor =
    variant === 'ghost' ? theme.colors.border : variant === 'secondary' ? theme.colors.border : 'transparent';
 
  const textColor =
    variant === 'primary' || variant === 'danger' ? '#fff' : variant === 'ghost' ? theme.colors.text : theme.colors.text;
 
  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: bg,
          borderColor,
          borderRadius: radius,
          paddingVertical: paddingY,
          paddingHorizontal: paddingX,
          opacity: isDisabled ? 0.55 : pressed ? 0.92 : 1,
          width: fullWidth ? '100%' : undefined,
        },
        style,
      ]}
      {...rest}>
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <AppText variant="bodyStrong" style={[{ color: textColor, textAlign: 'center' }, textStyle]}>
          {title}
        </AppText>
      )}
    </Pressable>
  );
}
 
const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
});

