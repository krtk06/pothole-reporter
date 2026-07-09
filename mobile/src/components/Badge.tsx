import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { dark, typography } from '../constants/theme';

const variantStyles: Record<string, { bg: string; text: string; border?: string }> = {
  default: { bg: dark.primary, text: '#fff' },
  secondary: { bg: 'rgba(251,191,36,0.15)', text: '#fbbf24' },
  destructive: { bg: dark.destructiveBg, text: dark.destructive },
  outline: { bg: 'transparent', text: dark.textPrimary, border: dark.border },
};

interface BadgeProps {
  children: string;
  variant?: keyof typeof variantStyles;
}

export function Badge({ children, variant = 'default' }: BadgeProps) {
  const style = variantStyles[variant];
  return (
    <View style={[styles.badge, { backgroundColor: style.bg }, style.border ? { borderWidth: 1, borderColor: style.border } : {}]}>
      <Text style={[styles.text, { color: style.text }]}>{children}</Text>
    </View>
  );
}

const statusVariants: Record<string, keyof typeof variantStyles> = {
  pending: 'secondary',
  verified: 'default',
  rejected: 'destructive',
  fixed: 'outline',
  open: 'default',
  assigned: 'secondary',
  completed: 'outline',
};

export function StatusBadge({ status }: { status: string }) {
  const variant = statusVariants[status] || 'outline';
  return <Badge variant={variant}>{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>;
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9999,
    alignSelf: 'flex-start',
  },
  text: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: typography.sizes.xs,
  },
});
