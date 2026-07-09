import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, KeyboardAvoidingView, Platform, Image, Dimensions,
} from 'react-native';
import { Eye, EyeOff, MapPin } from 'lucide-react-native';
import { dark, typography, radii } from '../constants/theme';
import { api, setTokens } from '../lib/api';
import { useStore } from '../lib/store';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';

const { width } = Dimensions.get('window');

export function LoginScreen({ navigation }: any) {
  const [isRegister, setIsRegister] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const setUser = useStore((s) => s.setUser);

  const handleSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      const endpoint = isRegister ? '/auth/register' : '/auth/login';
      const body = isRegister
        ? { name, email, phone: phone || undefined, password }
        : { email, password };
      const data = await api(endpoint, { method: 'POST', body });
      await setTokens(data.accessToken, data.refreshToken);
      setUser(data.user);
    } catch (e: any) {
      setError(e.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.mapContainer}>
          <MapView
            style={styles.map}
            provider={PROVIDER_DEFAULT}
            initialRegion={{ latitude: 20, longitude: 0, latitudeDelta: 40, longitudeDelta: 40 }}
            zoomEnabled={false}
            scrollEnabled={false}
            rotateEnabled={false}
          >
            <Marker coordinate={{ latitude: 20, longitude: 0 }}>
              <View style={styles.mapMarker} />
            </Marker>
          </MapView>
          <View style={styles.mapOverlay} />
        </View>

        <View style={styles.formContainer}>
          <View style={styles.formHeader}>
            <View style={styles.logoContainer}>
              <MapPin size={24} color={dark.primary} />
            </View>
            <Text style={styles.title}>Pothole Reporter</Text>
            <Text style={styles.subtitle}>
              {isRegister ? 'Create your account' : 'Sign in to your account'}
            </Text>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.formFields}>
            {isRegister && (
              <TextInput
                style={styles.input}
                placeholder="Full name"
                placeholderTextColor={dark.textSecondary}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
            )}
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={dark.textSecondary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            {isRegister && (
              <TextInput
                style={styles.input}
                placeholder="Phone (optional)"
                placeholderTextColor={dark.textSecondary}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
            )}
            <View style={styles.passwordContainer}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                placeholder="Password"
                placeholderTextColor={dark.textSecondary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={20} color={dark.textSecondary} /> : <Eye size={20} color={dark.textSecondary} />}
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text style={styles.submitText}>
              {loading ? 'Please wait...' : isRegister ? 'Create Account' : 'Sign In'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => { setIsRegister(!isRegister); setError(''); }}>
            <Text style={styles.switchText}>
              {isRegister ? 'Already have an account? Sign in' : "Don't have an account? Register"}
            </Text>
          </TouchableOpacity>

          {!isRegister && (
            <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
              <Text style={styles.switchText}>Forgot your password?</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: dark.background },
  scroll: { flexGrow: 1 },
  mapContainer: { height: 220, width: '100%' },
  map: { flex: 1 },
  mapOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 60,
    backgroundColor: 'transparent',
  },
  mapMarker: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: dark.mapMarkerBlue,
    borderWidth: 3, borderColor: '#fff',
    shadowColor: dark.mapMarkerBlue, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8, shadowRadius: 10, elevation: 8,
  },
  formContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: dark.surface,
    borderWidth: 1,
    borderColor: dark.border,
    marginTop: -20,
    paddingHorizontal: 32,
    paddingVertical: 40,
    flex: 1,
  },
  formHeader: { alignItems: 'center', marginBottom: 32 },
  logoContainer: {
    width: 48, height: 48, borderRadius: radii.lg,
    backgroundColor: dark.mutedSurface,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  title: {
    fontFamily: typography.fontFamilyBold,
    fontSize: typography.sizes['3xl'],
    color: dark.heading,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: typography.fontFamilyRegular,
    fontSize: typography.sizes.base,
    color: dark.textSecondary,
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
  formFields: { gap: 12, marginBottom: 24 },
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
  passwordContainer: { position: 'relative' },
  passwordInput: { paddingRight: 48 },
  eyeButton: {
    position: 'absolute', right: 12, top: 14,
  },
  submitButton: {
    height: 48,
    borderRadius: radii.md,
    backgroundColor: dark.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  submitDisabled: { opacity: 0.6 },
  submitText: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: typography.sizes.base,
    color: '#fff',
  },
  switchText: {
    fontFamily: typography.fontFamilyRegular,
    fontSize: typography.sizes.sm,
    color: dark.textSecondary,
    textAlign: 'center',
  },
});
