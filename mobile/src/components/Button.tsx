import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { dark, typography, radii } from '../constants/theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Button({ title, onPress, variant = 'primary', size = 'md', disabled, style, textStyle }: ButtonProps) {
  const height = { sm: 28, md: 36, lg: 48 }[size];
  const fontSize = { sm: 13, md: 14, lg: 16 }[size];
  const paddingH = { sm: 12, md: 16, lg: 24 }[size];

  const buttonStyles: ViewStyle[] = [styles.base, { height, paddingHorizontal: paddingH, borderRadius: radii.lg }];
  const textStyles: TextStyle[] = [styles.text, { fontSize }];

  switch (variant) {
    case 'primary':
      buttonStyles.push({ backgroundColor: dark.primary });
      textStyles.push({ color: '#fff' });
      break;
    case 'outline':
      buttonStyles.push({ borderWidth: 1, borderColor: dark.border, backgroundColor: 'transparent' });
      textStyles.push({ color: dark.textPrimary });
      break;
    case 'ghost':
      buttonStyles.push({ backgroundColor: 'transparent' });
      textStyles.push({ color: dark.textPrimary });
      break;
    case 'destructive':
      buttonStyles.push({ backgroundColor: dark.destructiveBg });
      textStyles.push({ color: dark.destructive });
      break;
  }

  if (disabled) {
    buttonStyles.push({ opacity: 0.5 });
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      style={[buttonStyles, style]}
    >
      <Text style={[textStyles, textStyle]}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  text: {
    fontFamily: typography.fontFamilyMedium,
    fontWeight: typography.weights.medium,
  },
});
