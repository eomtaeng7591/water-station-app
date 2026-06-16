import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { creditService } from '../../services/creditService';
import { Credit } from '../../types';
import { COLORS } from '../../constants';

function getDDay(dueDateStr: string | null): { label: string; color: string } | null {
  if (!dueDateStr) return null;
  const due = new Date(dueDateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const diff = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return { label: `D+${Math.abs(diff)} overdue`, color: COLORS.danger };
  if (diff === 0) return { label: 'D-Day', color: COLORS.danger };
  if (diff <= 3) return { label: `D-${diff}`, color: COLORS.accent };
  return { label: `D-${diff}`, color: COLORS.textSecondary };
}

function isOverdue(dueDateStr: string | null): boolean {
  if (!dueDateStr) return false;
  const due = new Date(dueDateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return due < today;
}

interface CustomerGroup {
  customer_id: number;
  customer_name: string;
  phone_number: string;
  total_outstanding: number;
  credits: Credit[];
  expanded: boolean;
  hasOverdue: boolean;
}

function buildGroups(credits: Credit[]): CustomerGroup[] {
  const map = new Map<number, CustomerGroup>();
  for (const c of credits) {
    if (!c.customer_id) continue;
    if (!map.has(c.customer_id)) {
      map.set(c.customer_id, {
        customer_id: c.customer_id,
        customer_name: c.customer?.customer_name ?? 'Unknown',
        phone_number: c.customer?.phone_number ?? '',
        total_outstanding: 0,
        credits: [],
        expanded: false,
        hasOverdue: false,
      });
    }
    const g = map.get(c.customer_id)!;
    g.credits.push(c);
    g.total_outstanding += Number(c.remaining_balance);
    if (isOverdue(c.due_date)) g.hasOverdue = true;
  }
  return Array.from(map.values()).sort((a, b) => {
    if (a.hasOverdue !== b.hasOverdue) return a.hasOverdue ? -1 : 1;
    return b.total_outstanding - a.total_outstanding;
  });
}

export default function CreditsScreen() {
  const navigation = useNavigation<any>();
  const [groups, setGroups] = useState<CustomerGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [totalOutstanding, setTotalOutstanding] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [data, total] = await Promise.all([
        creditService.getOutstandingCredits(),
        creditService.getTotalOutstanding(),
      ]);
      setGroups(buildGroups(data));
      setTotalOutstanding(total);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const toggleExpand = (customerId: number) => {
    setGroups(prev => prev.map(g =>
      g.customer_id === customerId ? { ...g, expanded: !g.expanded } : g
    ));
  };

  const renderGroup = ({ item: g }: { item: CustomerGroup }) => {
    const singleCredit = g.credits.length === 1 ? g.credits[0] : null;

    return (
      <View style={[styles.groupCard, g.hasOverdue && styles.groupCardOverdue]}>
        {g.hasOverdue && (
          <View style={styles.overdueBar}>
            <Text style={styles.overdueBarText}>⚠️ Overdue</Text>
          </View>
        )}
        <View style={styles.groupHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{g.customer_name[0]?.toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.customerName}>{g.customer_name}</Text>
            <Text style={styles.customerPhone}>{g.phone_number}</Text>
            <Text style={styles.creditCount}>{g.credits.length} unpaid</Text>
          </View>
          <View style={styles.groupRight}>
            {singleCredit?.due_date && (() => {
              const dd = getDDay(singleCredit.due_date);
              return dd ? (
                <View style={[styles.dDayBadge, { backgroundColor: dd.color + '22' }]}>
                  <Text style={[styles.dDayText, { color: dd.color }]}>{dd.label}</Text>
                </View>
              ) : null;
            })()}
            <Text style={styles.balanceLabel}>Balance</Text>
            <Text style={styles.balance}>₱{g.total_outstanding.toLocaleString()}</Text>
            {singleCredit ? (
              <TouchableOpacity
                style={styles.collectBtn}
                onPress={() => navigation.navigate('CollectPayment', {
                  creditId: singleCredit.credit_id,
                  customerName: g.customer_name,
                  remaining: singleCredit.remaining_balance,
                  onDone: load,
                })}
              >
                <Text style={styles.collectBtnText}>Collect</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.expandBtn} onPress={() => toggleExpand(g.customer_id)}>
                <Text style={styles.expandBtnText}>{g.expanded ? 'Close ▲' : 'Detail ▼'}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {g.credits.length > 1 && g.expanded && (
          <View style={styles.creditList}>
            {g.credits.map(c => (
              <View key={c.credit_id} style={styles.creditRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.creditDate}>
                    {new Date(c.updated_at).toLocaleDateString('en-US')}
                  </Text>
                  <Text style={styles.creditAmount}>
                    Principal ₱{Number(c.amount).toLocaleString()} · Balance ₱{Number(c.remaining_balance).toLocaleString()}
                  </Text>
                  {c.due_date && (
                    <Text style={styles.dueDateText}>Due {c.due_date}</Text>
                  )}
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  {c.due_date && (() => {
                    const dd = getDDay(c.due_date);
                    return dd ? (
                      <View style={[styles.dDayBadge, { backgroundColor: dd.color + '22' }]}>
                        <Text style={[styles.dDayText, { color: dd.color }]}>{dd.label}</Text>
                      </View>
                    ) : null;
                  })()}
                  <View style={[styles.statusBadge, { backgroundColor: c.status === 'PARTIAL' ? '#FAEEDA' : '#FCEBEB' }]}>
                    <Text style={[styles.statusText, { color: c.status === 'PARTIAL' ? COLORS.delivery : COLORS.danger }]}>
                      {c.status}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.collectSmallBtn}
                    onPress={() => navigation.navigate('CollectPayment', {
                      creditId: c.credit_id,
                      customerName: g.customer_name,
                      remaining: c.remaining_balance,
                      onDone: load,
                    })}
                  >
                    <Text style={styles.collectSmallBtnText}>Collect</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>💳 Credit Management</Text>
      </View>

      <View style={styles.totalBanner}>
        <Text style={styles.totalLabel}>Total Outstanding</Text>
        <Text style={styles.totalValue}>₱{totalOutstanding.toLocaleString()}</Text>
        <Text style={styles.totalSub}>{groups.length} customers unpaid</Text>
      </View>

      {loading && <ActivityIndicator color={COLORS.primary} style={{ margin: 16 }} />}

      <FlatList
        data={groups}
        keyExtractor={item => String(item.customer_id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        contentContainerStyle={styles.list}
        renderItem={renderGroup}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🎉</Text>
            <Text style={styles.emptyText}>No outstanding credits!</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: { padding: 16, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: '700', color: COLORS.textPrimary },
  totalBanner: { margin: 16, marginTop: 0, backgroundColor: COLORS.danger, borderRadius: 14, padding: 16, alignItems: 'center' },
  totalLabel: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginBottom: 4 },
  totalValue: { fontSize: 28, fontWeight: '700', color: '#fff' },
  totalSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  list: { padding: 16, paddingTop: 4, gap: 10 },
  groupCard: {
    backgroundColor: COLORS.surface, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden',
  },
  groupCardOverdue: {
    borderColor: COLORS.danger, borderWidth: 1.5,
  },
  overdueBar: {
    backgroundColor: '#FCEBEB', paddingHorizontal: 14, paddingVertical: 5,
    borderBottomWidth: 1, borderBottomColor: '#F5C6C6',
  },
  overdueBarText: { fontSize: 12, fontWeight: '700', color: COLORS.danger },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FCEBEB', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontWeight: '700', color: COLORS.danger },
  customerName: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary },
  customerPhone: { fontSize: 12, color: COLORS.textMuted },
  creditCount: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  groupRight: { alignItems: 'flex-end', gap: 4 },
  balanceLabel: { fontSize: 11, color: COLORS.textMuted },
  balance: { fontSize: 17, fontWeight: '700', color: COLORS.danger },
  collectBtn: { backgroundColor: COLORS.primary, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  collectBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  expandBtn: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  expandBtnText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  creditList: { borderTopWidth: 1, borderTopColor: COLORS.border },
  creditRow: {
    flexDirection: 'row', alignItems: 'center', padding: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.background,
    backgroundColor: '#FAFAF8',
  },
  creditDate: { fontSize: 12, color: COLORS.textMuted },
  creditAmount: { fontSize: 13, color: COLORS.textPrimary, marginTop: 2 },
  statusBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  statusText: { fontSize: 11, fontWeight: '600' },
  collectSmallBtn: { backgroundColor: COLORS.primary, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 5 },
  collectSmallBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  dDayBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 2 },
  dDayText: { fontSize: 12, fontWeight: '700' },
  dueDateText: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  empty: { alignItems: 'center', padding: 60 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 15, color: COLORS.textMuted },
});
