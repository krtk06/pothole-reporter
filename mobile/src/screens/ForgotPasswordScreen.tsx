import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { dark, typography, radii } from '../constants/theme';
import { api } from '../lib/api';

export function ForgotPasswordScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      await api('/auth/forgot-password', { method: 'POST', body: { email } });
      setSent(true);
    } catch (e: any) {
      setError(e.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Reset your password</Text>
        <Text style={styles.subtitle}>
          {sent
            ? 'If an account exists, we sent a reset link to your email.'
            : 'Enter your email and we\'ll send you a reset link.'}
        </Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {!sent && (
          <>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={dark.textSecondary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={[styles.button, loading && styles.disabled]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>{loading ? 'Sending...' : 'Send reset link'}</Text>
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backLink}>
          <Text style={styles.backText}>Back to login</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: dark.background, justifyContent: 'center', padding: 24 },
  card: {
    backgroundColor: dark.surface,
    borderWidth: 1,
    borderColor: dark.border,
    borderRadius: radii['2xl'],
    padding: 32,
  },
  title: {
    fontFamily: typography.fontFamilyBold,
    fontSize: typography.sizes['2xl'],
    color: dark.heading,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: typography.fontFamilyRegular,
    fontSize: typography.sizes.sm,
    color: dark.textSecondary,
    marginBottom: 24,
    textAlign: 'center',
  },
  error: {
    fontFamily: typography.fontFamilyRegular,
    fontSize: typography.sizes.sm,
    color: dark.destructive,
    textAlign: 'center',
    marginBottom: 16,
    padding: 8,
    backgroundColor: dark.destructiveBg,
    borderRadius: radii.md,
  },
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
    marginBottom: 16,
  },
  button: {
    height: 48,
    borderRadius: radii.md,
    backgroundColor: dark.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  disabled: { opacity: 0.6 },
  buttonText: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: typography.sizes.base,
    color: '#fff',
  },
  backLink: { alignItems: 'center' },
  backText: {
    fontFamily: typography.fontFamilyRegular,
    fontSize: typography.sizes.sm,
    color: dark.textSecondary,
  },
});
