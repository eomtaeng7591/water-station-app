import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { creditService } from '../../services/creditService';
import { customerService } from '../../services/customerService';
import { orderService } from '../../services/orderService';
import { Credit, Customer, Order } from '../../types';
import { COLORS } from '../../constants';
import { getCustomerTier } from '../../utils/customerTier';

export default function CustomerDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const initialCustomer: Customer = route.params?.customer;

  const [customer, setCustomer] = useState<Customer>(initialCustomer);
  const [credits, setCredits] = useState<Credit[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [fresh, c, o] = await Promise.all([
        customerService.getCustomerById(initialCustomer.customer_id),
        creditService.getCustomerCredits(initialCustomer.customer_id),
        orderService.getOrdersByCustomer(initialCustomer.customer_id),
      ]);
      setCustomer(fresh);
      setCredits(c);
      setOrders(o);
    } finally {
      setLoading(false);
    }
  }, [initialCustomer.customer_id]);

  useFocusEffect(useCallback(() => { loadAll(); }, [loadAll]));

  const unpaidCredits = credits.filter(c => c.status !== 'PAID');
  const outstanding = unpaidCredits.reduce((s, c) => s + Number(c.remaining_balance), 0);
  const totalSpend = orders.reduce((s, o) => s + Number(o.total_amount), 0);
  const tier = getCustomerTier(orders.length, totalSpend);

  const handleDelete = () => {
    Alert.alert(
      'Delete Customer',
      `Delete ${customer.customer_name}? All related orders and credits will also be deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              await customerService.deleteCustomer(customer.customer_id);
              navigation.goBack();
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Failed to delete');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>‹ Back</Text></TouchableOpacity>
        <Text style={styles.title}>Customer Detail</Text>
        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => navigation.navigate('AddCustomer', { customer })}
        >
          <Text style={styles.editBtnText}>✏️ Edit</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.profile}>
          <View style={[styles.avatar, { backgroundColor: tier.bgColor }]}>
            <Text style={styles.avatarText}>{customer.customer_name[0]?.toUpperCase()}</Text>
          </View>
          <Text style={styles.name}>{customer.customer_name}</Text>
          <View style={[styles.tierBadge, { backgroundColor: tier.bgColor }]}>
            <Text style={[styles.tierBadgeText, { color: tier.color }]}>
              {tier.emoji} {tier.label} Customer
            </Text>
          </View>
          <Text style={styles.phone}>{customer.phone_number}</Text>
          <Text style={styles.address}>{customer.address}</Text>

          {/* Tags */}
          {(customer.tags ?? []).length > 0 && (
            <View style={styles.tagRow}>
              {(customer.tags ?? []).map(tag => (
                <View key={tag} style={styles.tagChip}>
                  <Text style={styles.tagChipText}>{tag}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Notes / Memo */}
          {!!customer.notes && (
            <View style={styles.notesBox}>
              <Text style={styles.notesLabel}>📝 Memo</Text>
              <Text style={styles.notesText}>{customer.notes}</Text>
            </View>
          )}
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Total Orders</Text>
            <Text style={styles.statValue}>{orders.length}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Total Spend</Text>
            <Text style={[styles.statValue, { color: COLORS.primary }]}>₱{totalSpend.toLocaleString()}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Avg / Order</Text>
            <Text style={styles.statValue}>
              {orders.length > 0 ? `₱${Math.round(totalSpend / orders.length).toLocaleString()}` : '-'}
            </Text>
          </View>
        </View>

        {outstanding > 0 && (
          <View style={styles.outstanding}>
            <Text style={styles.outstandingLabel}>Total Outstanding Balance</Text>
            <Text style={styles.outstandingValue}>₱{outstanding.toLocaleString()}</Text>
            {unpaidCredits.length === 1 && (
              <TouchableOpacity
                style={styles.collectBtn}
                onPress={() => navigation.navigate('CollectPayment', {
                  creditId: unpaidCredits[0].credit_id,
                  customerName: customer.customer_name,
                  remaining: unpaidCredits[0].remaining_balance,
                  onDone: loadAll,
                })}
              >
                <Text style={styles.collectBtnText}>Collect</Text>
              </TouchableOpacity>
            )}
            {unpaidCredits.length > 1 && (
              <Text style={styles.multiCreditHint}>Collect individually from the list below</Text>
            )}
          </View>
        )}

        <Text style={styles.sectionTitle}>Credit History</Text>
        {loading ? <ActivityIndicator color={COLORS.primary} /> : credits.length === 0 ? (
          <Text style={styles.emptyText}>No credit history.</Text>
        ) : (
          credits.map(c => (
            <View key={c.credit_id} style={styles.creditRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.creditDate}>{new Date(c.updated_at).toLocaleDateString('en-US')}</Text>
                <Text style={styles.creditAmount}>₱{Number(c.amount).toLocaleString()}</Text>
                {c.status !== 'PAID' && (
                  <Text style={styles.remaining}>Balance ₱{Number(c.remaining_balance).toLocaleString()}</Text>
                )}
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <View style={[styles.statusBadge, { backgroundColor: c.status === 'PAID' ? '#EAF3DE' : '#FCEBEB' }]}>
                  <Text style={[styles.statusText, { color: c.status === 'PAID' ? COLORS.cash : COLORS.danger }]}>{c.status}</Text>
                </View>
                {c.status !== 'PAID' && (
                  <TouchableOpacity
                    style={styles.collectSmallBtn}
                    onPress={() => navigation.navigate('CollectPayment', {
                      creditId: c.credit_id,
                      customerName: customer.customer_name,
                      remaining: c.remaining_balance,
                      onDone: loadAll,
                    })}
                  >
                    <Text style={styles.collectSmallBtnText}>Collect</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))
        )}

        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Order History (Last 30)</Text>
        {loading ? null : orders.length === 0 ? (
          <Text style={styles.emptyText}>No order history.</Text>
        ) : (
          orders.map(o => (
            <View key={o.order_id} style={styles.orderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.orderDate}>
                  {new Date(o.created_at).toLocaleDateString('en-US')}
                  {' '}
                  {new Date(o.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </Text>
                <Text style={styles.orderDetail}>
                  {o.order_type === 'WALK-IN' ? '🚶 Walk-in' : '🏍️ Delivery'} · {o.quantity} gal
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text style={styles.orderAmount}>₱{Number(o.total_amount).toLocaleString()}</Text>
                <View style={[styles.payBadge, {
                  backgroundColor: o.payment_type === 'CASH' ? '#EAF3DE'
                    : o.payment_type === 'GCASH' ? '#EDE9FE' : '#FCEBEB',
                }]}>
                  <Text style={[styles.payBadgeText, {
                    color: o.payment_type === 'CASH' ? COLORS.cash
                      : o.payment_type === 'GCASH' ? COLORS.ewallet : COLORS.credit,
                  }]}>
                    {o.payment_type === 'GCASH' ? 'Gcash' : o.payment_type}
                  </Text>
                </View>
              </View>
            </View>
          ))
        )}
        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
          <Text style={styles.deleteBtnText}>🗑️ Delete Customer</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  back: { fontSize: 16, color: COLORS.primary },
  title: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary },
  editBtn: { backgroundColor: COLORS.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  editBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  content: { flex: 1, padding: 16 },
  profile: { alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: 16, padding: 24, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#E1F5EE', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText: { fontSize: 26, fontWeight: '700', color: COLORS.primaryDark },
  name: { fontSize: 20, fontWeight: '700', color: COLORS.textPrimary },
  tierBadge: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 4, marginTop: 6, marginBottom: 2 },
  tierBadgeText: { fontSize: 13, fontWeight: '700' },
  phone: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4 },
  address: { fontSize: 13, color: COLORS.textMuted, marginTop: 4, textAlign: 'center' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10, justifyContent: 'center' },
  tagChip: { backgroundColor: '#E1F5EE', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  tagChipText: { fontSize: 12, color: COLORS.primary, fontWeight: '600' },
  notesBox: { marginTop: 12, backgroundColor: COLORS.background, borderRadius: 10, padding: 12, width: '100%' },
  notesLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 4 },
  notesText: { fontSize: 13, color: COLORS.textPrimary, lineHeight: 18 },
  outstanding: { backgroundColor: '#FCEBEB', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 20, gap: 8 },
  outstandingLabel: { fontSize: 12, color: COLORS.danger },
  outstandingValue: { fontSize: 26, fontWeight: '700', color: COLORS.danger },
  collectBtn: { backgroundColor: COLORS.danger, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 8 },
  collectBtnText: { color: '#fff', fontWeight: '600' },
  multiCreditHint: { fontSize: 12, color: COLORS.danger, marginTop: 4 },
  collectSmallBtn: { backgroundColor: COLORS.primary, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 5 },
  collectSmallBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 10 },
  emptyText: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', padding: 20 },
  creditRow: { flexDirection: 'row', backgroundColor: COLORS.surface, borderRadius: 10, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: COLORS.border },
  creditDate: { fontSize: 12, color: COLORS.textMuted },
  creditAmount: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary, marginTop: 2 },
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 12, fontWeight: '600' },
  remaining: { fontSize: 12, color: COLORS.danger, marginTop: 4 },
  orderRow: {
    flexDirection: 'row', backgroundColor: COLORS.surface, borderRadius: 10,
    padding: 12, marginBottom: 8, borderWidth: 1, borderColor: COLORS.border,
  },
  orderDate: { fontSize: 12, color: COLORS.textMuted },
  orderDetail: { fontSize: 13, color: COLORS.textPrimary, marginTop: 2, fontWeight: '500' },
  orderAmount: { fontSize: 15, fontWeight: '700', color: COLORS.primary },
  payBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  payBadgeText: { fontSize: 11, fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: COLORS.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  statLabel: { fontSize: 11, color: COLORS.textMuted, marginBottom: 4 },
  statValue: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  deleteBtn: { marginTop: 24, marginBottom: 40, borderWidth: 1.5, borderColor: COLORS.danger, borderRadius: 12, padding: 16, alignItems: 'center' },
  deleteBtnText: { color: COLORS.danger, fontSize: 15, fontWeight: '600' },
});
