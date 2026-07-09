import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { dark, typography, radii } from '../constants/theme';

export function NotFoundScreen({ navigation }: any) {
  return (
    <View style={styles.container}>
      <View style={styles.tvContainer}>
        <View style={styles.antennaLeft} />
        <View style={styles.antennaRight} />
        <View style={styles.tvBody}>
          <View style={styles.screen}>
            <Text style={styles.notFoundText}>NOT FOUND</Text>
          </View>
          <View style={styles.controls}>
            {[...Array(4)].map((_, i) => (
              <View key={i} style={styles.button} />
            ))}
          </View>
          <View style={styles.speaker}>
            {[...Array(12)].map((_, i) => (
              <View key={i} style={styles.grillLine} />
            ))}
          </View>
        </View>
        <View style={styles.legs}>
          <View style={styles.leg} />
          <View style={[styles.leg, { marginLeft: 60 }]} />
        </View>
      </View>

      <Text style={styles.code}>404</Text>
      <Text style={styles.title}>Page Not Found</Text>
      <Text style={styles.subtitle}>The page you're looking for doesn't exist.</Text>

      <TouchableOpacity
        style={styles.homeBtn}
        onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Main' }] })}
        activeOpacity={0.7}
      >
        <Text style={styles.homeBtnText}>Go Home</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: dark.background,
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  tvContainer: { alignItems: 'center', marginBottom: 40 },
  antennaLeft: {
    width: 4, height: 40, backgroundColor: dark.border,
    transform: [{ rotate: '-25deg' }], marginBottom: -10, marginRight: 40,
  },
  antennaRight: {
    width: 4, height: 40, backgroundColor: dark.border,
    transform: [{ rotate: '25deg' }], marginBottom: -30, marginLeft: 40, marginTop: -30,
  },
  tvBody: {
    width: 140, backgroundColor: dark.surface,
    borderWidth: 2, borderColor: dark.border,
    borderRadius: 20, overflow: 'hidden',
  },
  screen: {
    margin: 12, height: 90, backgroundColor: dark.background,
    borderRadius: 12, borderWidth: 1, borderColor: dark.border,
    alignItems: 'center', justifyContent: 'center',
  },
  notFoundText: {
    fontFamily: typography.monoFamily,
    fontSize: 14, color: dark.destructive,
    letterSpacing: 4,
  },
  controls: {
    flexDirection: 'row', justifyContent: 'center', gap: 8, paddingBottom: 8,
  },
  button: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: dark.border,
  },
  speaker: {
    padding: 8, gap: 2, alignItems: 'center',
  },
  grillLine: {
    width: '100%', height: 2, backgroundColor: dark.border,
    borderRadius: 1,
  },
  legs: {
    flexDirection: 'row', justifyContent: 'space-between',
    width: 100, marginTop: -4,
  },
  leg: {
    width: 6, height: 16, backgroundColor: dark.border,
    borderBottomLeftRadius: 4, borderBottomRightRadius: 4,
  },
  code: {
    fontFamily: typography.fontFamilyBold,
    fontSize: typography.sizes['6xl'], color: dark.heading,
    marginBottom: 8,
  },
  title: {
    fontFamily: typography.fontFamilyBold,
    fontSize: typography.sizes.xl, color: dark.heading,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: typography.fontFamilyRegular,
    fontSize: typography.sizes.sm, color: dark.textSecondary,
    marginBottom: 32,
  },
  homeBtn: {
    borderWidth: 1, borderColor: dark.border,
    borderRadius: radii.full, paddingHorizontal: 24, paddingVertical: 12,
  },
  homeBtnText: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: typography.sizes.sm, color: dark.textPrimary,
  },
});
