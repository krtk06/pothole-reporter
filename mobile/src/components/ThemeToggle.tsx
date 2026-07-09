import React from 'react';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { Moon, Sun } from 'lucide-react-native';
import { dark, light } from '../constants/theme';

interface ThemeToggleProps {
  theme: 'light' | 'dark';
  onToggle: () => void;
}

export function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  const isDark = theme === 'dark';
  const knobPosition = isDark ? 2 : 34;

  return (
    <TouchableOpacity
      onPress={onToggle}
      activeOpacity={0.8}
      style={[styles.track, { backgroundColor: isDark ? '#18181b' : '#fff', borderColor: isDark ? '#27272a' : '#e4e4e7' }]}
    >
      <View style={[styles.knob, { transform: [{ translateX: knobPosition }], backgroundColor: isDark ? '#27272a' : '#e5e5e5' }]}>
        {isDark ? <Moon size={14} color="#fff" /> : <Sun size={14} color="#3f3f46" />}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  track: {
    width: 64,
    height: 32,
    borderRadius: 9999,
    padding: 4,
    borderWidth: 1,
    justifyContent: 'center',
  },
  knob: {
    width: 24,
    height: 24,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
