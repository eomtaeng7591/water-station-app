import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator,
  TouchableOpacity, Dimensions, ScrollView,
} from 'react-native';
import Svg, { Path, Circle, Line, Text as SvgText, Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { reportService } from '../../services/reportService';
import { TrendPoint } from '../../types';
import { COLORS } from '../../constants';

type Range = 7 | 14 | 30;

const SCREEN_W = Dimensions.get('window').width;
const CHART_H = 160;
const PAD_LEFT = 52;
const PAD_RIGHT = 12;
const PAD_TOP = 20;
const PAD_BOTTOM = 36;
const PLOT_H = CHART_H - PAD_TOP - PAD_BOTTOM;

function buildPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  return points.reduce((acc, p, i) =>
    i === 0 ? `M${p.x},${p.y}` : `${acc} L${p.x},${p.y}`,
  '');
}

function buildAreaPath(points: { x: number; y: number }[], chartBottom: number): string {
  if (points.length === 0) return '';
  const line = buildPath(points);
  return `${line} L${points[points.length - 1].x},${chartBottom} L${points[0].x},${chartBottom} Z`;
}

function dayLabel(dateStr: string, range: Range): string {
  const [, m, d] = dateStr.split('-');
  if (range === 7) {
    const dow = new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' });
    return dow;
  }
  return `${parseInt(m)}/${parseInt(d)}`;
}

export default function WeeklyChart() {
  const [range, setRange] = useState<Range>(7);
  const [data, setData] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    reportService.getTrend(range)
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [range]);

  const chartW = SCREEN_W - 64; // container padding = 32 each side
  const plotW = chartW - PAD_LEFT - PAD_RIGHT;
  const chartBottom = PAD_TOP + PLOT_H;

  const maxVal = Math.max(...data.map(d => d.total), 1);
  const totalRevenue = data.reduce((s, d) => s + d.total, 0);
  const totalOrders = data.reduce((s, d) => s + d.order_count, 0);
  const avgDaily = data.length > 0 ? totalRevenue / data.length : 0;
  const growthPct = (() => {
    if (data.length < 2) return null;
    const half = Math.floor(data.length / 2);
    const first = data.slice(0, half).reduce((s, d) => s + d.total, 0);
    const second = data.slice(half).reduce((s, d) => s + d.total, 0);
    if (first === 0) return null;
    return ((second - first) / first) * 100;
  })();

  const points = data.map((d, i) => ({
    x: PAD_LEFT + (i / (data.length - 1 || 1)) * plotW,
    y: PAD_TOP + (1 - d.total / maxVal) * PLOT_H,
    data: d,
  }));

  const yGridLines = [0, 0.25, 0.5, 0.75, 1].map(ratio => ({
    y: PAD_TOP + (1 - ratio) * PLOT_H,
    label: `₱${Math.round(maxVal * ratio / 1000)}k`,
  }));

  const showEvery = range === 7 ? 1 : range === 14 ? 2 : 5;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>📈 Sales Trend</Text>
        <View style={styles.rangeRow}>
          {([7, 14, 30] as Range[]).map(r => (
            <TouchableOpacity
              key={r}
              style={[styles.rangeBtn, range === r && styles.rangeBtnActive]}
              onPress={() => setRange(r)}
            >
              <Text style={[styles.rangeBtnText, range === r && styles.rangeBtnTextActive]}>
                {r}d
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ margin: 32 }} />
      ) : (
        <>
          {/* Summary stats */}
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Total</Text>
              <Text style={[styles.statVal, { color: COLORS.primary }]}>
                ₱{totalRevenue >= 1000 ? `${(totalRevenue / 1000).toFixed(1)}k` : totalRevenue.toLocaleString()}
              </Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Avg/day</Text>
              <Text style={styles.statVal}>
                ₱{avgDaily >= 1000 ? `${(avgDaily / 1000).toFixed(1)}k` : Math.round(avgDaily).toLocaleString()}
              </Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Orders</Text>
              <Text style={styles.statVal}>{totalOrders}</Text>
            </View>
            {growthPct !== null && (
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Trend</Text>
                <Text style={[styles.statVal, { color: growthPct >= 0 ? '#15803D' : COLORS.danger }]}>
                  {growthPct >= 0 ? '▲' : '▼'}{Math.abs(growthPct).toFixed(0)}%
                </Text>
              </View>
            )}
          </View>

          {/* SVG chart */}
          <Svg width={chartW} height={CHART_H}>
            <Defs>
              <LinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={COLORS.primary} stopOpacity="0.25" />
                <Stop offset="1" stopColor={COLORS.primary} stopOpacity="0.02" />
              </LinearGradient>
            </Defs>

            {/* Y grid lines */}
            {yGridLines.map((g, i) => (
              <React.Fragment key={i}>
                <Line
                  x1={PAD_LEFT} y1={g.y} x2={chartW - PAD_RIGHT} y2={g.y}
                  stroke={COLORS.border} strokeWidth={1} strokeDasharray="3,3"
                />
                <SvgText
                  x={PAD_LEFT - 4} y={g.y + 4}
                  fontSize={9} fill={COLORS.textMuted} textAnchor="end"
                >
                  {g.label}
                </SvgText>
              </React.Fragment>
            ))}

            {/* Area fill */}
            {points.length > 1 && (
              <Path
                d={buildAreaPath(points, chartBottom)}
                fill="url(#areaGrad)"
              />
            )}

            {/* Line */}
            {points.length > 1 && (
              <Path
                d={buildPath(points)}
                fill="none"
                stroke={COLORS.primary}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Dots + x labels */}
            {points.map((p, i) => (
              <React.Fragment key={i}>
                <Circle
                  cx={p.x} cy={p.y} r={p.data.total > 0 ? 4 : 2.5}
                  fill={p.data.total > 0 ? COLORS.primary : COLORS.border}
                  stroke="#fff" strokeWidth={1.5}
                />
                {i % showEvery === 0 && (
                  <SvgText
                    x={p.x} y={CHART_H - 4}
                    fontSize={9} fill={COLORS.textSecondary} textAnchor="middle"
                  >
                    {dayLabel(p.data.date, range)}
                  </SvgText>
                )}
              </React.Fragment>
            ))}
          </Svg>

          {/* Walk-in / Delivery breakdown */}
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: COLORS.walkin }]} />
              <Text style={styles.legendText}>
                Walk-in ₱{data.reduce((s, d) => s + d.walkin, 0).toLocaleString()}
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: COLORS.delivery }]} />
              <Text style={styles.legendText}>
                Delivery ₱{data.reduce((s, d) => s + d.delivery, 0).toLocaleString()}
              </Text>
            </View>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface, borderRadius: 14,
    padding: 16, borderWidth: 1, borderColor: COLORS.border,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  rangeRow: { flexDirection: 'row', gap: 4 },
  rangeBtn: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 8, borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  rangeBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  rangeBtnText: { fontSize: 12, fontWeight: '600', color: COLORS.textMuted },
  rangeBtnTextActive: { color: '#fff' },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statBox: {
    flex: 1, backgroundColor: COLORS.background, borderRadius: 8,
    padding: 8, alignItems: 'center',
  },
  statLabel: { fontSize: 10, color: COLORS.textMuted, marginBottom: 2 },
  statVal: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  legend: { flexDirection: 'row', gap: 16, marginTop: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 11, color: COLORS.textSecondary },
});
