import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity, Dimensions } from 'react-native';
import { reportService } from '../../services/reportService';
import { YearlyStat } from '../../types';
import { COLORS } from '../../constants';

const BAR_MAX_H = 100;

export default function YearlyChart() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState<YearlyStat[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    reportService.getYearlyStats(year).then(setData).finally(() => setLoading(false));
  }, [year]);

  const maxVal = Math.max(...data.map(d => d.total), 1);
  const grandTotal = data.reduce((s, d) => s + d.total, 0);

  return (
    <View style={styles.container}>
      <View style={styles.nav}>
        <TouchableOpacity onPress={() => setYear(y => y - 1)}><Text style={styles.navBtn}>‹ {year - 1}</Text></TouchableOpacity>
        <Text style={styles.navTitle}>{year} Annual Statistics</Text>
        <TouchableOpacity onPress={() => setYear(y => y + 1)} disabled={year >= new Date().getFullYear()}>
          <Text style={[styles.navBtn, year >= new Date().getFullYear() && { opacity: 0.3 }]}>{year + 1} ›</Text>
        </TouchableOpacity>
      </View>

      {loading ? <ActivityIndicator color={COLORS.primary} style={{ margin: 20 }} /> : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chart}>
              {data.map((d, i) => (
                <View key={i} style={styles.barCol}>
                  <Text style={styles.barAmt}>
                    {d.total > 0 ? `₱${(d.total / 1000).toFixed(0)}k` : ''}
                  </Text>
                  <View style={styles.barStack}>
                    <View style={[styles.barSeg, {
                      height: (d.delivery / maxVal) * BAR_MAX_H,
                      backgroundColor: COLORS.delivery,
                    }]} />
                    <View style={[styles.barSeg, {
                      height: (d.walkin / maxVal) * BAR_MAX_H,
                      backgroundColor: COLORS.walkin,
                    }]} />
                  </View>
                  <Text style={styles.monthLabel}>{d.month}</Text>
                </View>
              ))}
            </View>
          </ScrollView>

          <View style={styles.legend}>
            <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: COLORS.walkin }]} /><Text style={styles.legendText}>Walk-in</Text></View>
            <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: COLORS.delivery }]} /><Text style={styles.legendText}>Delivery</Text></View>
          </View>

          <View style={styles.totalBox}>
            <Text style={styles.totalLabel}>{year} Annual Total Sales</Text>
            <Text style={styles.totalValue}>₱{grandTotal.toLocaleString()}</Text>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: COLORS.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: COLORS.border },
  nav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  navBtn: { fontSize: 14, color: COLORS.primary, fontWeight: '600' },
  navTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  chart: { flexDirection: 'row', alignItems: 'flex-end', paddingBottom: 8, gap: 8 },
  barCol: { width: 36, alignItems: 'center' },
  barAmt: { fontSize: 9, color: COLORS.textMuted, marginBottom: 2, textAlign: 'center' },
  barStack: { alignItems: 'center', width: 20, justifyContent: 'flex-end' },
  barSeg: { width: 18, borderRadius: 3, minHeight: 2 },
  monthLabel: { fontSize: 11, color: COLORS.textSecondary, marginTop: 4 },
  legend: { flexDirection: 'row', gap: 16, marginTop: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, color: COLORS.textSecondary },
  totalBox: { backgroundColor: '#E1F5EE', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 14 },
  totalLabel: { fontSize: 12, color: COLORS.primaryDark, marginBottom: 2 },
  totalValue: { fontSize: 22, fontWeight: '700', color: COLORS.primaryDark },
});
