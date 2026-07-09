import React from 'react';
import { TextInput, StyleSheet, ViewStyle } from 'react-native';
import { dark, typography, radii } from '../constants/theme';

interface InputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  multiline?: boolean;
  numberOfLines?: number;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  style?: ViewStyle;
}

export function Input({
  value, onChangeText, placeholder, secureTextEntry, multiline, numberOfLines,
  keyboardType, autoCapitalize, style,
}: InputProps) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={dark.textSecondary}
      secureTextEntry={secureTextEntry}
      multiline={multiline}
      numberOfLines={numberOfLines}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize}
      style={[styles.input, multiline && styles.multiline, style]}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    height: 48,
    borderWidth: 2,
    borderColor: dark.border,
    borderRadius: radii.md,
    backgroundColor: dark.inputBg,
    paddingHorizontal: 16,
    fontFamily: typography.fontFamilyRegular,
    fontSize: typography.sizes.base,
    color: dark.textPrimary,
  },
  multiline: {
    height: 80,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
});
