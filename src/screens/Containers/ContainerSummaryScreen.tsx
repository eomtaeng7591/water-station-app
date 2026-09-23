import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { containerService } from '../../services/containerService';
import { StoreContainerSummary } from '../../types';
import { COLORS } from '../../constants';

export default function ContainerSummaryScreen() {
  const navigation = useNavigation<any>();
  const [summary, setSummary] = useState<StoreContainerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await containerService.getStoreSummary();
      setSummary(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🪣 Container Inventory</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {loading ? (
          <ActivityIndicator color={COLORS.primary} style={{ margin: 32 }} />
        ) : summary.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No container sizes registered yet.</Text>
            <Text style={styles.emptySub}>Add sizes from Settings → Container Management.</Text>
          </View>
        ) : (
          summary.map(s => {
            const negative = s.available_in_shop < 0;
            return (
              <View key={s.container_type_id} style={styles.card}>
                <Text style={styles.cardLabel}>{s.label}</Text>

                <View style={styles.statRow}>
                  <Text style={styles.statKey}>Owned by Store</Text>
                  <Text style={styles.statVal}>{s.owned_qty}</Text>
                </View>
                <View style={styles.statRow}>
                  <Text style={styles.statKey}>Out with Customers</Text>
                  <Text style={styles.statVal}>{s.out_with_customers}</Text>
                </View>
                <View style={styles.statRow}>
                  <Text style={styles.statKey}>Sold Permanently</Text>
                  <Text style={styles.statVal}>{s.sold_permanently}</Text>
                </View>

                <View style={styles.availableRow}>
                  <Text style={styles.availableLabel}>Available in Shop</Text>
                  <Text style={[styles.availableVal, negative && styles.availableValNegative]}>
                    {s.available_in_shop}
                  </Text>
                </View>
                {negative && (
                  <Text style={styles.negativeWarning}>
                    ⚠️ Negative stock — check borrow/return/purchase records for this size.
                  </Text>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  back: { fontSize: 16, color: COLORS.primary, minWidth: 60 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary },
  container: { flex: 1, padding: 16 },
  emptyBox: { alignItems: 'center', padding: 40 },
  emptyText: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center' },
  emptySub: { fontSize: 12, color: COLORS.textMuted, textAlign: 'center', marginTop: 4 },
  card: {
    backgroundColor: COLORS.surface, borderRadius: 14, padding: 16,
    marginBottom: 14, borderWidth: 1, borderColor: COLORS.border,
  },
  cardLabel: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 10 },
  statRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: COLORS.background,
  },
  statKey: { fontSize: 13, color: COLORS.textSecondary },
  statVal: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  availableRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  availableLabel: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  availableVal: { fontSize: 22, fontWeight: '700', color: COLORS.primary },
  availableValNegative: { color: COLORS.danger },
  negativeWarning: { fontSize: 12, color: COLORS.danger, marginTop: 8 },
});
