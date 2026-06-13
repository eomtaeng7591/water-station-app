import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { reportService } from '../../services/reportService';
import { MonthlySummary } from '../../types';
import { COLORS } from '../../constants';

export default function MonthlyTable() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<MonthlySummary | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    reportService.getMonthlyStats(year, month)
      .then(setData)
      .finally(() => setLoading(false));
  }, [year, month]);

  const prevMonth = () => { if (month === 1) { setYear(y => y - 1); setMonth(12); } else setMonth(m => m - 1); };
  const nextMonth = () => {
    const isNow = year === now.getFullYear() && month === now.getMonth() + 1;
    if (isNow) return;
    if (month === 12) { setYear(y => y + 1); setMonth(1); } else setMonth(m => m + 1);
  };

  return (
    <View style={styles.container}>
      
      <View style={styles.nav}>
        <TouchableOpacity style={styles.navBtn} onPress={prevMonth}><Text style={styles.navArrow}>‹</Text></TouchableOpacity>
        <Text style={styles.navTitle}>{year}-{String(month).padStart(2, '0')}</Text>
        <TouchableOpacity style={styles.navBtn} onPress={nextMonth}><Text style={styles.navArrow}>›</Text></TouchableOpacity>
      </View>

      {loading ? <ActivityIndicator color={COLORS.primary} style={{ margin: 20 }} /> : (
        <>
          
          <View style={styles.tableHeader}>
            <Text style={[styles.th, { flex: 1.2 }]}>Date</Text>
            <Text style={[styles.th, { flex: 1.5, color: COLORS.walkin }]}>Walk-in</Text>
            <Text style={[styles.th, { flex: 1.5, color: COLORS.delivery }]}>Delivery</Text>
            <Text style={[styles.th, { flex: 1.5 }]}>Total</Text>
          </View>

          <ScrollView style={styles.tableBody} nestedScrollEnabled>
            {(data?.days || []).map((row, i) => (
              <View key={row.date} style={[styles.tableRow, i % 2 === 1 && styles.rowAlt]}>
                <Text style={[styles.td, { flex: 1.2 }]}>{row.date.slice(8)}</Text>
                <Text style={[styles.td, { flex: 1.5, color: row.walkin_sales > 0 ? COLORS.walkin : COLORS.textMuted }]}>
                  {row.walkin_sales > 0 ? `₱${row.walkin_sales.toLocaleString()}` : '-'}
                </Text>
                <Text style={[styles.td, { flex: 1.5, color: row.delivery_sales > 0 ? COLORS.delivery : COLORS.textMuted }]}>
                  {row.delivery_sales > 0 ? `₱${row.delivery_sales.toLocaleString()}` : '-'}
                </Text>
                <Text style={[styles.td, { flex: 1.5, fontWeight: row.daily_total > 0 ? '600' : '400' }]}>
                  {row.daily_total > 0 ? `₱${row.daily_total.toLocaleString()}` : '-'}
                </Text>
              </View>
            ))}
          </ScrollView>

          
          <View style={styles.totalRow}>
            <Text style={[styles.totalCell, { flex: 1.2 }]}>Total</Text>
            <Text style={[styles.totalCell, { flex: 1.5, color: COLORS.walkin }]}>₱{(data?.walkin_total || 0).toLocaleString()}</Text>
            <Text style={[styles.totalCell, { flex: 1.5, color: COLORS.delivery }]}>₱{(data?.delivery_total || 0).toLocaleString()}</Text>
            <Text style={[styles.totalCell, { flex: 1.5, color: COLORS.primary }]}>₱{(data?.grand_total_sales || 0).toLocaleString()}</Text>
          </View>

          
          <View style={styles.grandBox}>
            <Text style={styles.grandLabel}>GRAND TOTAL SALES</Text>
            <Text style={styles.grandValue}>₱{(data?.grand_total_sales || 0).toLocaleString()}</Text>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: COLORS.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: COLORS.border },
  nav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  navBtn: { padding: 8 },
  navArrow: { fontSize: 24, color: COLORS.primary, fontWeight: '700' },
  navTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  tableHeader: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1.5, borderBottomColor: COLORS.border },
  th: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, textAlign: 'center' },
  tableBody: { maxHeight: 320 },
  tableRow: { flexDirection: 'row', paddingVertical: 9 },
  rowAlt: { backgroundColor: '#F9F8F4' },
  td: { fontSize: 13, color: COLORS.textPrimary, textAlign: 'center' },
  totalRow: {
    flexDirection: 'row', paddingVertical: 10,
    borderTopWidth: 2, borderTopColor: COLORS.border, marginTop: 2,
  },
  totalCell: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  grandBox: {
    backgroundColor: COLORS.primary, borderRadius: 10, padding: 14,
    alignItems: 'center', marginTop: 12,
  },
  grandLabel: { fontSize: 11, color: 'rgba(255,255,255,0.8)', marginBottom: 2 },
  grandValue: { fontSize: 24, fontWeight: '700', color: '#fff' },
});
