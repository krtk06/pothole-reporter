import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { dark, typography, radii } from '../constants/theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  padding?: number;
}

export function Card({ children, style, padding = 16 }: CardProps) {
  return (
    <View style={[styles.card, { padding }, style]}>
      {children}
    </View>
  );
}

export function CardHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.header}>
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: dark.surface,
    borderWidth: 1,
    borderColor: dark.border,
    borderRadius: radii.xl,
  },
  header: {
    marginBottom: 12,
  },
  title: {
    fontFamily: typography.fontFamilyBold,
    fontSize: typography.sizes.xl,
    color: dark.heading,
  },
  subtitle: {
    fontFamily: typography.fontFamilyRegular,
    fontSize: typography.sizes.sm,
    color: dark.textSecondary,
    marginTop: 4,
  },
});
