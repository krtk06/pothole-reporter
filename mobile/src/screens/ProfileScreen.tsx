import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { CheckCircle, Clock, Mail, MapPin, Phone, RefreshCw, ShieldCheck, TrendingUp } from 'lucide-react-native';
import { dark, typography, radii } from '../constants/theme';
import { api } from '../lib/api';
import { useStore } from '../lib/store';
import { Card } from '../components/Card';
import { StatusBadge } from '../components/Badge';
import type { PotholeReport } from '../types';

export function ProfileScreen() {
  const user = useStore((s) => s.user);
  const reportsVersion = useStore((s) => s.reportsVersion);
  const [reports, setReports] = useState<PotholeReport[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadProfile = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    setError(null);
    try {
      const [profileData, reportsData] = await Promise.all([
        api('/auth/me'),
        api('/reports'),
      ]);
      useStore.getState().setUser(profileData.user || profileData);
      setReports(reportsData.reports || []);
      setLastUpdated(new Date());
    } catch (err) {
      console.warn('Failed to refresh profile', err);
      setError(err instanceof Error ? err.message : 'Could not refresh profile');
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadProfile(false);
    }, [loadProfile, reportsVersion])
  );

  const totalReports = reports.length;
  const pendingReports = reports.filter((r) => r.status === 'pending').length;
  const resolvedReports = reports.filter((r) => r.status === 'fixed' || r.status === 'verified').length;
  const latestReport = reports[0];
  const completionRate = totalReports > 0 ? Math.round((resolvedReports / totalReports) * 100) : 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={(
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => loadProfile(true)}
          tintColor={dark.primary}
          colors={[dark.primary]}
        />
      )}
    >
      <Card style={styles.profileCard}>
        <View style={styles.profileTop}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.name?.charAt(0)?.toUpperCase() || '?'}
            </Text>
          </View>
          <View style={styles.identity}>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1}>{user?.name || 'User'}</Text>
              <View style={styles.rolePill}>
                <ShieldCheck size={12} color={dark.primary} />
                <Text style={styles.roleText}>{user?.role || 'public'}</Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <Mail size={14} color={dark.textSecondary} />
              <Text style={styles.infoText} numberOfLines={1}>{user?.email}</Text>
            </View>
            {user?.phone && (
              <View style={styles.infoRow}>
                <Phone size={14} color={dark.textSecondary} />
                <Text style={styles.infoText}>{user.phone}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <MapPin size={16} color={dark.primary} />
            <Text style={styles.statValue}>{totalReports}</Text>
            <Text style={styles.statLabel}>Reports</Text>
          </View>
          <View style={styles.statItem}>
            <Clock size={16} color={dark.secondary} />
            <Text style={styles.statValue}>{pendingReports}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={styles.statItem}>
            <CheckCircle size={16} color={dark.success} />
            <Text style={styles.statValue}>{completionRate}%</Text>
            <Text style={styles.statLabel}>Progress</Text>
          </View>
        </View>

        <View style={styles.syncRow}>
          <Text style={styles.syncText}>
            {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Waiting for latest data'}
          </Text>
          <TouchableOpacity style={styles.refreshBtn} onPress={() => loadProfile(true)} activeOpacity={0.7}>
            <RefreshCw size={14} color={dark.textPrimary} />
            <Text style={styles.refreshText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      </Card>

      {latestReport && (
        <Card style={styles.activityCard}>
          <View style={styles.activityIcon}>
            <TrendingUp size={18} color={dark.primary} />
          </View>
          <View style={styles.activityCopy}>
            <Text style={styles.activityTitle}>Latest report is {latestReport.status}</Text>
            <Text style={styles.activityMeta}>
              {Number(latestReport.latitude).toFixed(4)}, {Number(latestReport.longitude).toFixed(4)}
            </Text>
          </View>
          <StatusBadge status={latestReport.status} />
        </Card>
      )}

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Reports</Text>
          {initialLoading && <Text style={styles.loadingText}>Loading...</Text>}
        </View>
        {!initialLoading && reports.length === 0 ? (
          <Card style={styles.emptyCard}>
            <MapPin size={28} color={dark.textSecondary} />
            <Text style={styles.emptyText}>No reports yet</Text>
          </Card>
        ) : (
          <View style={styles.reportList}>
            {reports.map((r) => (
              <Card key={r.id} style={styles.reportCard}>
                <View style={styles.reportHeader}>
                  <StatusBadge status={r.status} />
                  <Text style={styles.reportDate}>
                    {new Date(r.created_at).toLocaleDateString()}
                  </Text>
                </View>
                <Text style={styles.coords}>
                  {Number(r.latitude).toFixed(4)}, {Number(r.longitude).toFixed(4)}
                </Text>
                {r.block_id && <Text style={styles.mono}>Block: {r.block_id}</Text>}
              </Card>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: dark.background },
  content: { padding: 16, paddingBottom: 40, gap: 14 },
  profileCard: {
    gap: 18,
  },
  profileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: dark.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: {
    fontFamily: typography.fontFamilyBold,
    fontSize: typography.sizes['2xl'], color: '#fff',
  },
  identity: { flex: 1, gap: 6 },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    fontFamily: typography.fontFamilyBold,
    fontSize: typography.sizes['2xl'],
    color: dark.heading,
    flex: 1,
  },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    height: 24,
    borderRadius: radii.full,
    backgroundColor: dark.mutedSurface,
    borderWidth: 1,
    borderColor: dark.border,
  },
  roleText: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: typography.sizes.xs,
    color: dark.primary,
    textTransform: 'capitalize',
  },
  infoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  infoText: {
    fontFamily: typography.fontFamilyRegular,
    fontSize: typography.sizes.sm,
    color: dark.textSecondary,
    flex: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  statItem: {
    flex: 1,
    minHeight: 88,
    borderRadius: radii.lg,
    backgroundColor: dark.mutedSurface,
    borderWidth: 1,
    borderColor: dark.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  statValue: {
    fontFamily: typography.fontFamilyBold,
    fontSize: typography.sizes.xl,
    color: dark.heading,
  },
  statLabel: {
    fontFamily: typography.fontFamilyRegular,
    fontSize: typography.sizes.xs,
    color: dark.textSecondary,
  },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  syncText: {
    fontFamily: typography.fontFamilyRegular,
    fontSize: typography.sizes.xs,
    color: dark.textSecondary,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    paddingHorizontal: 10,
    borderRadius: radii.md,
    backgroundColor: dark.mutedSurface,
  },
  refreshText: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: typography.sizes.xs,
    color: dark.textPrimary,
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: dark.mutedSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityCopy: { flex: 1, gap: 2 },
  activityTitle: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: typography.sizes.sm,
    color: dark.textPrimary,
  },
  activityMeta: {
    fontFamily: typography.monoFamily,
    fontSize: typography.sizes.xs,
    color: dark.textSecondary,
  },
  errorBanner: {
    padding: 12,
    borderRadius: radii.md,
    backgroundColor: dark.destructiveBg,
    borderWidth: 1,
    borderColor: dark.border,
  },
  errorText: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: typography.sizes.sm,
    color: dark.destructive,
  },
  section: { gap: 12 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontFamily: typography.fontFamilyBold,
    fontSize: typography.sizes.xl,
    color: dark.heading,
  },
  loadingText: {
    fontFamily: typography.fontFamilyRegular,
    fontSize: typography.sizes.xs,
    color: dark.textSecondary,
  },
  emptyCard: {
    padding: 40, alignItems: 'center', gap: 12,
    borderStyle: 'dashed', borderWidth: 2,
  },
  emptyText: {
    fontFamily: typography.fontFamilyRegular,
    fontSize: typography.sizes.base,
    color: dark.textSecondary,
  },
  reportList: { gap: 12 },
  reportCard: { gap: 8 },
  reportHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  reportDate: {
    fontFamily: typography.fontFamilyRegular,
    fontSize: typography.sizes.xs,
    color: dark.textSecondary,
  },
  coords: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: typography.sizes.sm,
    color: dark.textPrimary,
  },
  mono: {
    fontFamily: typography.monoFamily,
    fontSize: typography.sizes.xs,
    color: dark.textSecondary,
  },
});
