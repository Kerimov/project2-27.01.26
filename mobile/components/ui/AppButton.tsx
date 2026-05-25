import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
 
import { useAppTheme } from '@/design/tokens';
import { AppText } from '@/components/ui/AppText';
import { IconSymbol } from '@/components/ui/icon-symbol';
 
export type AppButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'ai';
export type AppButtonSize = 'sm' | 'md' | 'lg';
 
export type AppButtonProps = Omit<PressableProps, 'style'> & {
  title: string;
  variant?: AppButtonVariant;
  size?: AppButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: Parameters<typeof IconSymbol>[0]['name'];
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};
 
export function AppButton({
  title,
  variant = 'primary',
  size = 'md',
  loading,
  fullWidth,
  icon,
  disabled,
  style,
  textStyle,
  ...rest
}: AppButtonProps) {
  const theme = useAppTheme();
  const isDisabled = disabled || loading;
 
  const paddingY = size === 'sm' ? 9 : size === 'lg' ? 15 : 13;
  const paddingX = size === 'sm' ? 14 : size === 'lg' ? 20 : 17;
  const radius = size === 'sm' ? theme.radius.sm : theme.radius.pill;
 
  const bg =
    variant === 'primary'
      ? theme.colors.primary
      : variant === 'ai'
        ? theme.colors.ai
      : variant === 'secondary'
        ? theme.colors.surface2
        : variant === 'danger'
          ? theme.colors.danger
          : 'transparent';
 
  const borderColor =
    variant === 'ghost' ? theme.colors.border : variant === 'secondary' ? theme.colors.borderStrong : 'transparent';
 
  const textColor =
    variant === 'primary' || variant === 'danger' || variant === 'ai'
      ? '#fff'
      : variant === 'ghost'
        ? theme.colors.text
        : theme.colors.text;
 
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
          transform: [{ scale: pressed && !isDisabled ? 0.98 : 1 }],
          width: fullWidth ? '100%' : undefined,
        },
        style,
      ]}
      {...rest}>
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <View style={styles.content}>
          {icon ? <IconSymbol name={icon} size={size === 'sm' ? 15 : 18} color={textColor} /> : null}
        <AppText variant="bodyStrong" style={[{ color: textColor, textAlign: 'center' }, textStyle]}>
          {title}
        </AppText>
        </View>
      )}
    </Pressable>
  );
}
 
const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 48,
  },
  content: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
});

