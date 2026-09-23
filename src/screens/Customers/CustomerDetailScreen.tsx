import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
  Modal, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { customerService } from '../../services/customerService';
import { orderService } from '../../services/orderService';
import { creditService } from '../../services/creditService';
import { containerService } from '../../services/containerService';
import { Customer, Order, CreditBalance, CustomerContainerBalance } from '../../types';
import { COLORS } from '../../constants';
import { getCustomerTier } from '../../utils/customerTier';

export default function CustomerDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const initialCustomer: Customer = route.params?.customer;

  const [customer, setCustomer] = useState<Customer>(initialCustomer);
  const [orders, setOrders] = useState<Order[]>([]);
  const [creditBalance, setCreditBalance] = useState<CreditBalance | null>(null);
  const [containerBalances, setContainerBalances] = useState<CustomerContainerBalance[]>([]);
  const [loading, setLoading] = useState(true);

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentSaving, setPaymentSaving] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [fresh, o, cb, containers] = await Promise.all([
        customerService.getCustomerById(initialCustomer.customer_id),
        orderService.getOrdersByCustomer(initialCustomer.customer_id),
        creditService.getCustomerBalance(initialCustomer.customer_id),
        containerService.getCustomerBalances(initialCustomer.customer_id),
      ]);
      setCustomer(fresh);
      setOrders(o);
      setCreditBalance(cb);
      setContainerBalances(containers);
    } finally {
      setLoading(false);
    }
  }, [initialCustomer.customer_id]);

  useFocusEffect(useCallback(() => { loadAll(); }, [loadAll]));

  const handleSavePayment = async () => {
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount.');
      return;
    }
    setPaymentSaving(true);
    try {
      await creditService.recordPayment(customer.customer_id, amount, paymentNotes.trim() || undefined);
      setPaymentModalOpen(false);
      setPaymentAmount('');
      setPaymentNotes('');
      await loadAll();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to record payment.');
    } finally {
      setPaymentSaving(false);
    }
  };

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

        {creditBalance && creditBalance.balance > 0 && (
          <View style={styles.outstanding}>
            <Text style={styles.outstandingLabel}>🧾 Outstanding Credit Balance</Text>
            <Text style={styles.outstandingValue}>₱{creditBalance.balance.toLocaleString()}</Text>
            <TouchableOpacity style={styles.collectBtn} onPress={() => setPaymentModalOpen(true)}>
              <Text style={styles.collectBtnText}>Record Payment</Text>
            </TouchableOpacity>
          </View>
        )}
        {creditBalance && creditBalance.balance <= 0 && creditBalance.credit_charged > 0 && (
          <View style={styles.creditClearBox}>
            <Text style={styles.creditClearText}>✅ No outstanding credit balance</Text>
          </View>
        )}

        {containerBalances.length > 0 && (
          <View style={styles.containerBox}>
            <Text style={styles.sectionTitle}>🪣 Containers with Customer</Text>
            {containerBalances.map(cb => (
              <View key={cb.container_type_id} style={styles.containerBalanceRow}>
                <Text style={styles.containerBalanceLabel}>{cb.label}</Text>
                <Text style={styles.containerBalanceQty}>{cb.outstanding_qty}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.sectionTitle}>Order History (Last 30)</Text>
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
                    : o.payment_type === 'GCASH' ? '#EDE9FE'
                    : o.payment_type === 'CREDIT' ? '#F7E1E9' : '#E0F2FE',
                }]}>
                  <Text style={[styles.payBadgeText, {
                    color: o.payment_type === 'CASH' ? COLORS.cash
                      : o.payment_type === 'GCASH' ? COLORS.ewallet
                      : o.payment_type === 'CREDIT' ? COLORS.credit : '#0EA5E9',
                  }]}>
                    {o.payment_type === 'GCASH' ? 'Gcash' : o.payment_type === 'CREDIT' ? 'Credit' : o.payment_type}
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

      <Modal
        visible={paymentModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setPaymentModalOpen(false)}
      >
        <KeyboardAvoidingView style={styles.modalContainer} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setPaymentModalOpen(false)} />
          <View style={styles.paymentSheet}>
            <Text style={styles.paymentSheetTitle}>Record Payment</Text>
            {creditBalance && (
              <Text style={styles.paymentSheetSub}>
                Current balance: ₱{creditBalance.balance.toLocaleString()}
              </Text>
            )}

            <Text style={styles.inputLabel}>Amount</Text>
            <TextInput
              style={styles.input}
              value={paymentAmount}
              onChangeText={setPaymentAmount}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={COLORS.textMuted}
              autoFocus
            />

            <Text style={styles.inputLabel}>Notes (optional)</Text>
            <TextInput
              style={[styles.input, { height: 64, textAlignVertical: 'top' }]}
              value={paymentNotes}
              onChangeText={setPaymentNotes}
              placeholder="e.g. Paid in cash"
              placeholderTextColor={COLORS.textMuted}
              multiline
            />

            {paymentSaving ? (
              <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 16 }} />
            ) : (
              <TouchableOpacity style={styles.paymentSaveBtn} onPress={handleSavePayment}>
                <Text style={styles.paymentSaveBtnText}>Save Payment</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.paymentCancelBtn} onPress={() => setPaymentModalOpen(false)}>
              <Text style={styles.paymentCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  creditClearBox: {
    backgroundColor: '#E1F5EE', borderRadius: 12, padding: 14,
    alignItems: 'center', marginBottom: 16,
  },
  creditClearText: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  containerBox: {
    backgroundColor: COLORS.surface, borderRadius: 12, padding: 14,
    marginBottom: 16, borderWidth: 1, borderColor: COLORS.border,
  },
  containerBalanceRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.background,
  },
  containerBalanceLabel: { fontSize: 14, color: COLORS.textPrimary, fontWeight: '600' },
  containerBalanceQty: { fontSize: 15, color: COLORS.textPrimary, fontWeight: '700' },
  modalContainer: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  paymentSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, paddingBottom: 40,
  },
  paymentSheetTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
  paymentSheetSub: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', marginTop: 4, marginBottom: 16 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 10, padding: 12, fontSize: 15, color: COLORS.textPrimary,
  },
  paymentSaveBtn: { backgroundColor: COLORS.primary, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 20 },
  paymentSaveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  paymentCancelBtn: { alignItems: 'center', paddingVertical: 12 },
  paymentCancelText: { fontSize: 14, color: COLORS.textMuted },
});
