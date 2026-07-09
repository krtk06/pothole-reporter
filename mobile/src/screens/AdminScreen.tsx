import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert,
} from 'react-native';
import { Activity, CheckCircle, XCircle } from 'lucide-react-native';
import MapView, { Marker } from 'react-native-maps';
import { dark, typography, radii } from '../constants/theme';
import { api } from '../lib/api';
import { Card } from '../components/Card';
import { StatusBadge } from '../components/Badge';
import type { PotholeReport, Tender, MapCluster } from '../types';

type Tab = 'overview' | 'reports' | 'tenders';

export function AdminScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [reports, setReports] = useState<PotholeReport[]>([]);
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [clusters, setClusters] = useState<MapCluster[]>([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, verified: 0, rejected: 0, fixed: 0 });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [reportsData, tendersData, mapData] = await Promise.all([
        api('/admin/reports'),
        api('/admin/tenders'),
        api('/admin/map-clusters'),
      ]);
      const r = reportsData.reports || [];
      setReports(r);
      setTenders(tendersData.tenders || []);
      setClusters(mapData.blockDensity || []);
      const s = { total: r.length, pending: 0, verified: 0, rejected: 0, fixed: 0 };
      r.forEach((rep: PotholeReport) => {
        const key = rep.status as keyof typeof s;
        if (key in s) s[key]++;
      });
      setStats(s);
    } catch (err) {
      console.warn('Failed to load admin data', err);
    }
  };

  const updateReportStatus = async (id: string, status: string) => {
    try {
      await api(`/admin/reports/${id}`, { method: 'PATCH', body: { status } });
      loadData();
    } catch (err) {
      Alert.alert('Update failed', err instanceof Error ? err.message : 'Could not update report status');
    }
  };

  const updateTenderStatus = async (id: string, status: string) => {
    try {
      await api(`/admin/tenders/${id}`, { method: 'PATCH', body: { status } });
      loadData();
    } catch (err) {
      Alert.alert('Update failed', err instanceof Error ? err.message : 'Could not update tender status');
    }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'reports', label: 'Reports' },
    { key: 'tenders', label: 'Tenders' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Admin Dashboard</Text>
      </View>

      <View style={styles.tabBar}>
        {tabs.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, activeTab === t.key && styles.tabActive]}
            onPress={() => setActiveTab(t.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {activeTab === 'overview' && (
          <>
            <View style={styles.statsGrid}>
              {[
                { label: 'Total', value: stats.total, icon: Activity, color: dark.textSecondary },
                { label: 'Pending', value: stats.pending, icon: Activity, color: '#fbbf24' },
                { label: 'Verified', value: stats.verified, icon: CheckCircle, color: dark.success },
                { label: 'Rejected', value: stats.rejected, icon: XCircle, color: dark.destructive },
              ].map((s) => (
                <Card key={s.label} style={styles.statCard}>
                  <s.icon size={20} color={s.color} />
                  <Text style={styles.statValue}>{s.value}</Text>
                  <Text style={styles.statLabel}>{s.label}</Text>
                </Card>
              ))}
            </View>
            <View style={styles.mapContainer}>
              <MapView
                style={styles.map}
                initialRegion={{ latitude: 20, longitude: 78, latitudeDelta: 30, longitudeDelta: 30 }}
              >
                {clusters.map((c) => (
                  <Marker key={c.block_id} coordinate={{ latitude: c.avg_latitude, longitude: c.avg_longitude }}>
                    <View style={styles.clusterMarker}>
                      <Text style={styles.clusterCount}>{c.count}</Text>
                    </View>
                  </Marker>
                ))}
              </MapView>
            </View>
          </>
        )}

        {activeTab === 'reports' && (
          <View style={styles.reportList}>
            {reports.map((r) => (
              <Card key={r.id} style={styles.reportCard}>
                <View style={styles.reportHeader}>
                  <StatusBadge status={r.status} />
                  <Text style={styles.mono}>{new Date(r.created_at).toLocaleDateString()}</Text>
                </View>
                <Text style={styles.reportLocation}>
                  {Number(r.latitude).toFixed(4)}, {Number(r.longitude).toFixed(4)}
                </Text>
                {r.block_id && <Text style={styles.mono}>Block: {r.block_id}</Text>}
                {r.reporter_name && <Text style={styles.reporterName}>By {r.reporter_name}</Text>}
                {r.status === 'pending' && (
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.verifyBtn]}
                      onPress={() => updateReportStatus(r.id, 'verified')}
                    >
                      <Text style={styles.actionBtnText}>Verify</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.rejectBtn]}
                      onPress={() => updateReportStatus(r.id, 'rejected')}
                    >
                      <Text style={styles.actionBtnText}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </Card>
            ))}
          </View>
        )}

        {activeTab === 'tenders' && (
          <View style={styles.reportList}>
            {tenders.map((t) => (
              <Card key={t.id} style={styles.tenderCard}>
                <View style={styles.reportHeader}>
                  <StatusBadge status={t.status} />
                  <Text style={styles.mono}>{new Date(t.generated_at).toLocaleDateString()}</Text>
                </View>
                <Text style={styles.reportLocation}>Block: {t.block_id}</Text>
                <View style={styles.tenderStats}>
                  <Text style={styles.tenderStat}>{t.pothole_count} potholes</Text>
                  <Text style={styles.tenderStat}>${Number(t.estimated_cost).toLocaleString()}</Text>
                </View>
                {t.status === 'open' && (
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.verifyBtn, { alignSelf: 'flex-start' }]}
                    onPress={() => updateTenderStatus(t.id, 'assigned')}
                  >
                    <Text style={styles.actionBtnText}>Assign</Text>
                  </TouchableOpacity>
                )}
              </Card>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: dark.background },
  hero: {
    padding: 24, borderBottomWidth: 1, borderBottomColor: dark.border,
  },
  heroTitle: {
    fontFamily: typography.fontFamilyBold,
    fontSize: typography.sizes['3xl'],
    color: dark.heading,
  },
  tabBar: {
    flexDirection: 'row', margin: 12, padding: 3,
    backgroundColor: dark.surface,
    borderWidth: 1, borderColor: dark.border,
    borderRadius: radii.lg,
  },
  tab: {
    flex: 1, height: 32, borderRadius: radii.md,
    alignItems: 'center', justifyContent: 'center',
  },
  tabActive: { backgroundColor: dark.textPrimary },
  tabText: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: typography.sizes.sm,
    color: dark.textSecondary,
  },
  tabTextActive: { color: dark.background },
  content: { padding: 16, paddingBottom: 40 },
  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24,
  },
  statCard: {
    width: '47%', alignItems: 'center', gap: 6, paddingVertical: 20,
  },
  statValue: {
    fontFamily: typography.fontFamilyBold,
    fontSize: typography.sizes['3xl'],
    color: dark.heading,
  },
  statLabel: {
    fontFamily: typography.fontFamilyRegular,
    fontSize: typography.sizes.xs,
    color: dark.textSecondary,
  },
  mapContainer: {
    height: 350, borderRadius: radii.lg, overflow: 'hidden',
    borderWidth: 1, borderColor: dark.border,
  },
  map: { flex: 1 },
  clusterMarker: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: dark.mapMarkerBlue,
    borderWidth: 2, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  clusterCount: {
    fontFamily: typography.fontFamilyBold,
    fontSize: typography.sizes.sm,
    color: '#fff',
  },
  reportList: { gap: 12 },
  reportCard: { gap: 8 },
  reportHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  reportLocation: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: typography.sizes.sm,
    color: dark.textPrimary,
  },
  reporterName: {
    fontFamily: typography.fontFamilyRegular,
    fontSize: typography.sizes.xs,
    color: dark.textSecondary,
  },
  mono: {
    fontFamily: typography.monoFamily,
    fontSize: typography.sizes.xs,
    color: dark.textSecondary,
  },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  actionBtn: {
    paddingHorizontal: 16, paddingVertical: 6, borderRadius: radii.md,
  },
  verifyBtn: { backgroundColor: dark.success },
  rejectBtn: { backgroundColor: dark.destructive },
  actionBtnText: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: typography.sizes.xs, color: '#fff',
  },
  tenderCard: { gap: 8 },
  tenderStats: { flexDirection: 'row', gap: 16 },
  tenderStat: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: typography.sizes.sm,
    color: dark.textPrimary,
  },
});
