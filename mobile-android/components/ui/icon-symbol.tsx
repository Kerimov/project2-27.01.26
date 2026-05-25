// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolWeight, SymbolViewProps } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type IconMapping = Record<SymbolViewProps['name'], ComponentProps<typeof MaterialIcons>['name']>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  // Tabs / common UI
  'waveform.path.ecg': 'show-chart',
  'doc.text.fill': 'description',
  'checkmark.circle.fill': 'check-circle',
  calendar: 'calendar-today',
  'pills.fill': 'medication',
  'book.fill': 'menu-book',
  'bell.fill': 'notifications',
  'person.fill': 'person',
  // Actions
  plus: 'add',
  // AI Chat
  sparkles: 'auto-awesome',
  paperclip: 'attach-file',
  'xmark.circle.fill': 'cancel',
  'doc.badge.plus': 'upload-file',
  'calendar.badge.plus': 'event-available',
  'calendar.badge.clock': 'event-note',
  'chart.bar.fill': 'bar-chart',
  'book.closed.fill': 'library-books',
  'building.2.fill': 'business',
  'questionmark.circle.fill': 'help',
  'moon.fill': 'bedtime',
  stethoscope: 'medical-services',
} as IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
