import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { customerService } from '../../services/customerService';
import { Customer } from '../../types';
import { COLORS } from '../../constants';
import { getCustomerTier } from '../../utils/customerTier';

type TierFilter = 'ALL' | 'VIP' | 'Regular' | 'New';

export default function CustomersScreen() {
  const navigation = useNavigation<any>();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<TierFilter>('ALL');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = search
        ? await customerService.searchCustomers(search)
        : await customerService.getAllCustomers();
      setCustomers(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const filtered = tierFilter === 'ALL'
    ? customers
    : customers.filter(c => {
        const tier = getCustomerTier(c.total_orders ?? 0, c.total_spend ?? 0);
        return tier.label === tierFilter;
      });

  const tierCounts = {
    VIP:     customers.filter(c => getCustomerTier(c.total_orders ?? 0, c.total_spend ?? 0).label === 'VIP').length,
    Regular: customers.filter(c => getCustomerTier(c.total_orders ?? 0, c.total_spend ?? 0).label === 'Regular').length,
    New:     customers.filter(c => getCustomerTier(c.total_orders ?? 0, c.total_spend ?? 0).label === 'New').length,
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>👥 Customers</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate('AddCustomer', { onAdded: load })}
        >
          <Text style={styles.addBtnText}>+ Add New</Text>
        </TouchableOpacity>
      </View>

      <TextInput
        style={styles.search}
        value={search}
        onChangeText={setSearch}
        placeholder="Search by name or phone..."
        placeholderTextColor={COLORS.textMuted}
      />

      {/* Tier filter chips */}
      <View style={styles.filterRow}>
        {(['ALL', 'VIP', 'Regular', 'New'] as TierFilter[]).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.filterChip, tierFilter === t && styles.filterChipActive]}
            onPress={() => setTierFilter(t)}
          >
            <Text style={[styles.filterChipText, tierFilter === t && styles.filterChipTextActive]}>
              {t === 'VIP' ? `👑 VIP (${tierCounts.VIP})`
                : t === 'Regular' ? `⭐ Regular (${tierCounts.Regular})`
                : t === 'New' ? `🆕 New (${tierCounts.New})`
                : `All (${customers.length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading && <ActivityIndicator color={COLORS.primary} style={{ margin: 16 }} />}

      <FlatList
        data={filtered}
        keyExtractor={item => String(item.customer_id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const tier = getCustomerTier(item.total_orders ?? 0, item.total_spend ?? 0);
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate('CustomerDetail', { customer: item })}
            >
              <View style={[styles.avatar, { backgroundColor: tier.bgColor }]}>
                <Text style={styles.avatarText}>{item.customer_name[0]?.toUpperCase()}</Text>
              </View>
              <View style={styles.info}>
                <View style={styles.nameRow}>
                  <Text style={styles.name}>{item.customer_name}</Text>
                  <View style={[styles.tierBadge, { backgroundColor: tier.bgColor }]}>
                    <Text style={[styles.tierBadgeText, { color: tier.color }]}>
                      {tier.emoji} {tier.label}
                    </Text>
                  </View>
                </View>
                <Text style={styles.phone}>{item.phone_number}</Text>
                <Text style={styles.address} numberOfLines={1}>{item.address}</Text>
                {(item.total_orders ?? 0) > 0 && (
                  <Text style={styles.stats}>
                    {item.total_orders} orders · ₱{Number(item.total_spend ?? 0).toLocaleString()}
                  </Text>
                )}
                {(item.tags ?? []).length > 0 && (
                  <View style={styles.tagRow}>
                    {(item.tags ?? []).slice(0, 3).map(tag => (
                      <View key={tag} style={styles.tagChip}>
                        <Text style={styles.tagChipText}>{tag}</Text>
                      </View>
                    ))}
                    {(item.tags ?? []).length > 3 && (
                      <View style={styles.tagChip}>
                        <Text style={styles.tagChipText}>+{(item.tags ?? []).length - 3}</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
              {(item.total_outstanding ?? 0) > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>₱{(item.total_outstanding ?? 0).toLocaleString()}</Text>
                  <Text style={styles.badgeSub}>Credit</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{search ? 'No results found' : 'No customers registered'}</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: '700', color: COLORS.textPrimary },
  addBtn: { backgroundColor: COLORS.primary, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  search: {
    marginHorizontal: 16, marginBottom: 8, padding: 12, borderRadius: 10,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface,
    fontSize: 14, color: COLORS.textPrimary,
  },
  filterRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  filterChip: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 5, backgroundColor: COLORS.surface,
  },
  filterChipActive: { borderColor: COLORS.primary, backgroundColor: '#E1F5EE' },
  filterChipText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '500' },
  filterChipTextActive: { color: COLORS.primary, fontWeight: '700' },
  list: { padding: 16, paddingTop: 4, gap: 10 },
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface,
    borderRadius: 12, padding: 14, borderWidth: 1, borderColor: COLORS.border, gap: 12,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '700', color: COLORS.primaryDark },
  info: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  name: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary },
  tierBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  tierBadgeText: { fontSize: 11, fontWeight: '700' },
  phone: { fontSize: 13, color: COLORS.textSecondary },
  address: { fontSize: 12, color: COLORS.textMuted },
  stats: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  tagChip: { backgroundColor: '#E1F5EE', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  tagChipText: { fontSize: 10, color: COLORS.primary, fontWeight: '600' },
  badge: { alignItems: 'center', backgroundColor: '#FCEBEB', borderRadius: 8, padding: 8 },
  badgeText: { fontSize: 13, fontWeight: '700', color: COLORS.danger },
  badgeSub: { fontSize: 10, color: '#EF9999' },
  empty: { alignItems: 'center', padding: 40 },
  emptyText: { fontSize: 14, color: COLORS.textMuted },
});
