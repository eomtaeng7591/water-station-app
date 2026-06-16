import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Modal, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { reportService, DailyStatsResult } from '../../services/reportService';
import { creditService } from '../../services/creditService';
import { TargetProgress } from '../../types';
import { exportDailyCSV, exportDailyPDF, exportMonthlyCSV, exportMonthlyPDF } from '../../services/exportService';
import { COLORS } from '../../constants';
import WeeklyChart from './WeeklyChart';
import MonthlyTable from './MonthlyTable';
import YearlyChart from './YearlyChart';

type Tab = 'daily' | 'weekly' | 'monthly' | 'yearly';
type ExportMode = 'daily' | 'monthly';

function localDateStr(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(dateStr: string, n: number) {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, mo - 1, d);
  dt.setDate(dt.getDate() + n);
  return localDateStr(dt);
}

function formatDisplayDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
}

function monthLabel(year: number, month: number) {
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
}

export default function DashboardScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('daily');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [daily, setDaily] = useState<DailyStatsResult>({
    walkin: 0, delivery: 0, total: 0, orderCount: 0, cash: 0, ewallet: 0, credit: 0,
  });
  const [outstanding, setOutstanding] = useState(0);
  const [progress, setProgress] = useState<TargetProgress | null>(null);

  const [exportVisible, setExportVisible] = useState(false);
  const [exportMode, setExportMode] = useState<ExportMode>('daily');
  const [exportDate, setExportDate] = useState(localDateStr(new Date()));
  const [exportYear, setExportYear] = useState(new Date().getFullYear());
  const [exportMonth, setExportMonth] = useState(new Date().getMonth() + 1);
  const [exporting, setExporting] = useState(false);

  const today = new Date();
  const todayStr = localDateStr(today);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'daily', label: 'Today' },
    { key: 'weekly', label: 'Trend' },
    { key: 'monthly', label: 'Monthly' },
    { key: 'yearly', label: 'Yearly' },
  ];

  const loadDaily = useCallback(async () => {
    setLoading(true);
    try {
      const [d, o, p] = await Promise.all([
        reportService.getDailyStats(),
        creditService.getTotalOutstanding(),
        reportService.getTargetProgress(),
      ]);
      setDaily(d);
      setOutstanding(o);
      setProgress(p);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadDaily(); }, [loadDaily]));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDaily();
    setRefreshing(false);
  };

  const openExport = () => {
    setExportDate(todayStr);
    setExportYear(today.getFullYear());
    setExportMonth(today.getMonth() + 1);
    setExportMode('daily');
    setExportVisible(true);
  };

  const shiftMonth = (delta: number) => {
    let m = exportMonth + delta;
    let y = exportYear;
    if (m > 12) { m = 1; y++; }
    if (m < 1) { m = 12; y--; }
    setExportMonth(m);
    setExportYear(y);
  };

  const isFutureMonth = exportYear > today.getFullYear() ||
    (exportYear === today.getFullYear() && exportMonth > today.getMonth() + 1);

  const handleExport = async (format: 'csv' | 'pdf') => {
    setExporting(true);
    try {
      if (exportMode === 'daily') {
        if (format === 'csv') await exportDailyCSV(exportDate);
        else await exportDailyPDF(exportDate);
      } else {
        if (format === 'csv') await exportMonthlyCSV(exportYear, exportMonth);
        else await exportMonthlyPDF(exportYear, exportMonth);
      }
      setExportVisible(false);
    } catch (e: any) {
      Alert.alert('Export Failed', e?.message ?? 'Unknown error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>📊 Sales Dashboard</Text>
            <Text style={styles.date}>{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}</Text>
          </View>
          <TouchableOpacity style={styles.exportBtn} onPress={openExport}>
            <Text style={styles.exportBtnText}>📤 Export</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { flex: 1 }]}>
            <Text style={styles.summaryLabel}>Today's Sales</Text>
            <Text style={[styles.summaryValue, { color: COLORS.primary }]}>₱{daily.total.toLocaleString()}</Text>
            <Text style={styles.summarySub}>{daily.orderCount} orders</Text>
          </View>
          <View style={[styles.summaryCard, { flex: 1 }]}>
            <Text style={styles.summaryLabel}>Total Outstanding</Text>
            <Text style={[styles.summaryValue, { color: COLORS.danger }]}>₱{outstanding.toLocaleString()}</Text>
            <Text style={styles.summarySub}>Credit Balance</Text>
          </View>
        </View>

        <View style={styles.splitRow}>
          <View style={[styles.splitCard, { borderColor: COLORS.walkin }]}>
            <Text style={[styles.splitLabel, { color: COLORS.walkin }]}>Walk-in</Text>
            <Text style={[styles.splitValue, { color: COLORS.walkin }]}>₱{daily.walkin.toLocaleString()}</Text>
          </View>
          <View style={[styles.splitCard, { borderColor: COLORS.delivery }]}>
            <Text style={[styles.splitLabel, { color: COLORS.delivery }]}>Delivery</Text>
            <Text style={[styles.splitValue, { color: COLORS.delivery }]}>₱{daily.delivery.toLocaleString()}</Text>
          </View>
        </View>

        {progress && (progress.daily_target > 0 || progress.monthly_target > 0) && (
          <TargetCard progress={progress} />
        )}

        <View style={styles.tabs}>
          {tabs.map(t => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tab, activeTab === t.key && styles.tabActive]}
              onPress={() => setActiveTab(t.key)}
            >
              <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading && <ActivityIndicator color={COLORS.primary} style={{ margin: 20 }} />}

        {activeTab === 'daily' && <DailyDetail data={daily} />}
        {activeTab === 'weekly' && <WeeklyChart />}
        {activeTab === 'monthly' && <MonthlyTable />}
        {activeTab === 'yearly' && <YearlyChart />}
      </ScrollView>

      <Modal visible={exportVisible} transparent animationType="slide" onRequestClose={() => setExportVisible(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setExportVisible(false)} />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Export Report</Text>

          {/* Mode toggle */}
          <View style={styles.modeRow}>
            <TouchableOpacity
              style={[styles.modeBtn, exportMode === 'daily' && styles.modeBtnActive]}
              onPress={() => setExportMode('daily')}
            >
              <Text style={[styles.modeBtnText, exportMode === 'daily' && styles.modeBtnTextActive]}>Daily</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, exportMode === 'monthly' && styles.modeBtnActive]}
              onPress={() => setExportMode('monthly')}
            >
              <Text style={[styles.modeBtnText, exportMode === 'monthly' && styles.modeBtnTextActive]}>Monthly</Text>
            </TouchableOpacity>
          </View>

          {/* Date / Month picker */}
          {exportMode === 'daily' ? (
            <View style={styles.datePicker}>
              <TouchableOpacity style={styles.dateArrow} onPress={() => setExportDate(d => addDays(d, -1))}>
                <Text style={styles.dateArrowText}>‹</Text>
              </TouchableOpacity>
              <Text style={styles.dateText}>{formatDisplayDate(exportDate)}</Text>
              <TouchableOpacity
                style={styles.dateArrow}
                onPress={() => setExportDate(d => addDays(d, 1))}
                disabled={exportDate >= todayStr}
              >
                <Text style={[styles.dateArrowText, exportDate >= todayStr && { opacity: 0.3 }]}>›</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.datePicker}>
              <TouchableOpacity style={styles.dateArrow} onPress={() => shiftMonth(-1)}>
                <Text style={styles.dateArrowText}>‹</Text>
              </TouchableOpacity>
              <Text style={styles.dateText}>{monthLabel(exportYear, exportMonth)}</Text>
              <TouchableOpacity
                style={styles.dateArrow}
                onPress={() => shiftMonth(1)}
                disabled={isFutureMonth}
              >
                <Text style={[styles.dateArrowText, isFutureMonth && { opacity: 0.3 }]}>›</Text>
              </TouchableOpacity>
            </View>
          )}

          {exporting ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 24 }} />
          ) : (
            <View style={styles.formatRow}>
              <TouchableOpacity style={[styles.formatBtn, { borderColor: COLORS.primary }]} onPress={() => handleExport('csv')}>
                <Text style={styles.formatIcon}>📄</Text>
                <Text style={[styles.formatLabel, { color: COLORS.primary }]}>CSV</Text>
                <Text style={styles.formatSub}>Spreadsheet</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.formatBtn, { borderColor: COLORS.danger }]} onPress={() => handleExport('pdf')}>
                <Text style={styles.formatIcon}>📋</Text>
                <Text style={[styles.formatLabel, { color: COLORS.danger }]}>PDF</Text>
                <Text style={styles.formatSub}>Print / Share</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity style={styles.cancelBtn} onPress={() => setExportVisible(false)}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function TargetCard({ progress }: { progress: TargetProgress }) {
  const dailyColor = progress.daily_pct >= 100 ? '#15803D'
    : progress.daily_pct >= 70 ? '#D97706' : COLORS.danger;
  const monthlyColor = progress.monthly_pct >= 100 ? '#15803D'
    : progress.monthly_pct >= 70 ? '#D97706' : COLORS.danger;

  return (
    <View style={styles.targetCard}>
      <Text style={styles.targetTitle}>🎯 Sales Target</Text>
      {progress.daily_target > 0 && (
        <View style={styles.targetRow}>
          <View style={styles.targetLabelRow}>
            <Text style={styles.targetLabel}>Today</Text>
            <Text style={[styles.targetPct, { color: dailyColor }]}>{progress.daily_pct.toFixed(0)}%</Text>
          </View>
          <View style={styles.targetBarTrack}>
            <View style={[styles.targetBarFill, {
              width: `${Math.min(progress.daily_pct, 100)}%` as any,
              backgroundColor: dailyColor,
            }]} />
          </View>
          <Text style={styles.targetAmounts}>
            ₱{progress.daily_actual.toLocaleString()} / ₱{progress.daily_target.toLocaleString()}
          </Text>
        </View>
      )}
      {progress.monthly_target > 0 && (
        <View style={[styles.targetRow, progress.daily_target > 0 && { marginTop: 12 }]}>
          <View style={styles.targetLabelRow}>
            <Text style={styles.targetLabel}>This Month</Text>
            <Text style={[styles.targetPct, { color: monthlyColor }]}>{progress.monthly_pct.toFixed(0)}%</Text>
          </View>
          <View style={styles.targetBarTrack}>
            <View style={[styles.targetBarFill, {
              width: `${Math.min(progress.monthly_pct, 100)}%` as any,
              backgroundColor: monthlyColor,
            }]} />
          </View>
          <Text style={styles.targetAmounts}>
            ₱{progress.monthly_actual.toLocaleString()} / ₱{progress.monthly_target.toLocaleString()}
          </Text>
        </View>
      )}
    </View>
  );
}

function DailyDetail({ data }: { data: DailyStatsResult }) {
  const total = data.total;
  const cashPct  = total > 0 ? (data.cash   / total) * 100 : 0;
  const walletPct = total > 0 ? (data.ewallet / total) * 100 : 0;
  const creditPct = total > 0 ? (data.credit  / total) * 100 : 0;

  return (
    <View style={styles.detail}>
      <Text style={styles.detailTitle}>Today's Sales Detail</Text>
      <View style={styles.detailRow}>
        <Text style={styles.detailKey}>Walk-in Sales</Text>
        <Text style={[styles.detailVal, { color: COLORS.walkin }]}>₱{data.walkin.toLocaleString()}</Text>
      </View>
      <View style={styles.detailRow}>
        <Text style={styles.detailKey}>Delivery Sales</Text>
        <Text style={[styles.detailVal, { color: COLORS.delivery }]}>₱{data.delivery.toLocaleString()}</Text>
      </View>
      <View style={[styles.detailRow, { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 10, marginTop: 4 }]}>
        <Text style={[styles.detailKey, { fontWeight: '700' }]}>Grand Total</Text>
        <Text style={[styles.detailVal, { color: COLORS.primary, fontWeight: '700', fontSize: 18 }]}>₱{data.total.toLocaleString()}</Text>
      </View>
      <View style={styles.detailRow}>
        <Text style={styles.detailKey}>Order Count</Text>
        <Text style={styles.detailVal}>{data.orderCount} orders</Text>
      </View>

      {/* Payment breakdown */}
      <Text style={styles.payTitle}>Payment Breakdown</Text>
      <PayBar label="Cash" value={data.cash} pct={cashPct} color={COLORS.cash} />
      <PayBar label="Gcash" value={data.ewallet} pct={walletPct} color={COLORS.ewallet} />
      <PayBar label="Credit" value={data.credit} pct={creditPct} color={COLORS.credit} />
    </View>
  );
}

function PayBar({ label, value, pct, color }: { label: string; value: number; pct: number; color: string }) {
  return (
    <View style={styles.payBarRow}>
      <Text style={[styles.payBarLabel, { color }]}>{label}</Text>
      <View style={styles.payBarTrack}>
        <View style={[styles.payBarFill, { width: `${Math.max(pct, 0)}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={styles.payBarVal}>₱{value.toLocaleString()}</Text>
      <Text style={styles.payBarPct}>{pct.toFixed(0)}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  container: { flex: 1, padding: 16 },
  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: '700', color: COLORS.textPrimary },
  date: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
  exportBtn: {
    backgroundColor: COLORS.primary, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 8, marginTop: 2,
  },
  exportBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  summaryCard: {
    backgroundColor: COLORS.surface, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: COLORS.border,
  },
  summaryLabel: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 4 },
  summaryValue: { fontSize: 22, fontWeight: '700' },
  summarySub: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  splitRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  splitCard: {
    flex: 1, backgroundColor: COLORS.surface, borderRadius: 12, padding: 14,
    borderWidth: 2,
  },
  splitLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  splitValue: { fontSize: 18, fontWeight: '700' },
  tabs: { flexDirection: 'row', backgroundColor: COLORS.surface, borderRadius: 12, padding: 4, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  tabActive: { backgroundColor: COLORS.primary },
  tabText: { fontSize: 13, color: COLORS.textMuted, fontWeight: '500' },
  tabTextActive: { color: '#fff', fontWeight: '700' },
  detail: { backgroundColor: COLORS.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: COLORS.border },
  detailTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 14 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  detailKey: { fontSize: 14, color: COLORS.textSecondary },
  detailVal: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary },
  payTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary, marginTop: 16, marginBottom: 10 },
  payBarRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 6 },
  payBarLabel: { width: 60, fontSize: 12, fontWeight: '600' },
  payBarTrack: { flex: 1, height: 10, backgroundColor: '#F3F4F6', borderRadius: 5, overflow: 'hidden' },
  payBarFill: { height: '100%', borderRadius: 5 },
  payBarVal: { width: 64, fontSize: 11, color: COLORS.textSecondary, textAlign: 'right' },
  payBarPct: { width: 32, fontSize: 11, color: COLORS.textMuted, textAlign: 'right' },
  // Target card
  targetCard: {
    backgroundColor: COLORS.surface, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: COLORS.border, marginBottom: 12,
  },
  targetTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 12 },
  targetRow: {},
  targetLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  targetLabel: { fontSize: 13, color: COLORS.textSecondary },
  targetPct: { fontSize: 13, fontWeight: '700' },
  targetBarTrack: { height: 10, backgroundColor: '#F3F4F6', borderRadius: 5, overflow: 'hidden', marginBottom: 4 },
  targetBarFill: { height: '100%', borderRadius: 5 },
  targetAmounts: { fontSize: 11, color: COLORS.textMuted, textAlign: 'right' },
  // Export modal
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, paddingBottom: 40,
  },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 16, textAlign: 'center' },
  modeRow: { flexDirection: 'row', backgroundColor: '#F3F4F6', borderRadius: 10, padding: 3, marginBottom: 20 },
  modeBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  modeBtnActive: { backgroundColor: COLORS.primary },
  modeBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.textMuted },
  modeBtnTextActive: { color: '#fff' },
  datePicker: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  dateArrow: { padding: 10 },
  dateArrowText: { fontSize: 28, color: COLORS.primary, fontWeight: '700' },
  dateText: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary },
  formatRow: { flexDirection: 'row', gap: 14, marginBottom: 16 },
  formatBtn: {
    flex: 1, borderWidth: 2, borderRadius: 14, padding: 18,
    alignItems: 'center',
  },
  formatIcon: { fontSize: 28, marginBottom: 6 },
  formatLabel: { fontSize: 18, fontWeight: '700' },
  formatSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  cancelBtn: { alignItems: 'center', paddingVertical: 12 },
  cancelText: { fontSize: 15, color: COLORS.textMuted },
});
