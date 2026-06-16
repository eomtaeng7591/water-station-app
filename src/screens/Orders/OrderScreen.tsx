import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator, Modal, FlatList, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../constants';
import { settingsService } from '../../services/settingsService';
import { customerService } from '../../services/customerService';
import { orderService } from '../../services/orderService';
import { riderService } from '../../services/riderService';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import { useOrderSubmit } from '../../hooks/useOrderSubmit';
import { Customer, Order, Rider, OrderType, PaymentType } from '../../types';
import { shareOrderReceipt } from '../../services/receiptService';
import { addDays, format } from 'date-fns';

type ActiveView = 'form' | 'today';
type FilterType = 'ALL' | 'WALK-IN' | 'DELIVERY';
type FilterPayment = 'ALL' | 'CASH' | 'GCASH' | 'MAYA';

function dateStr(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function shiftDate(s: string, n: number) {
  const [y, mo, d] = s.split('-').map(Number);
  const date = new Date(y, mo - 1, d);
  date.setDate(date.getDate() + n);
  return dateStr(date);
}

export default function OrderScreen() {
  const [activeView, setActiveView] = useState<ActiveView>('form');

  const [orderType, setOrderType] = useState<OrderType>('WALK-IN');
  const [quantity, setQuantity] = useState('');
  const [remarks, setRemarks] = useState('');
  const [_paymentType, setPaymentType] = useState<PaymentType>('CASH');
  const [deliveryStatus, setDeliveryStatus] = useState<'PENDING' | 'COMPLETED'>('PENDING');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [unitPrice, setUnitPrice] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchModal, setSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Customer[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [selectedRider, setSelectedRider] = useState<Rider | null>(null);
  const [dueDays, setDueDays] = useState<number | null>(null);
  const [gcashRef, setGcashRef] = useState('');

  const [todayOrders, setTodayOrders] = useState<Order[]>([]);
  const [pendingDeliveries, setPendingDeliveries] = useState<Order[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filterDate, setFilterDate] = useState(dateStr(new Date()));
  const [filterType, setFilterType] = useState<FilterType>('ALL');
  const [filterPayment, setFilterPayment] = useState<FilterPayment>('ALL');
  const { pendingCount, lastSyncResult, refreshPendingCount } = useOfflineSync();
  const { submit: submitOrder } = useOrderSubmit();
  const todayDateStr = dateStr(new Date());

  const totalAmount = unitPrice * (parseInt(quantity) || 0);

  useEffect(() => { loadSettings(); }, [orderType]);

  useEffect(() => {
    riderService.getActiveRiders().then(setRiders).catch(() => {});
  }, []);

  const loadSettings = async () => {
    try {
      const s = await settingsService.getSettings();
      setUnitPrice(orderType === 'DELIVERY' ? s.delivery_price : s.walkin_price);
    } catch {
      setUnitPrice(orderType === 'DELIVERY' ? 45 : 40);
    }
  };

  const loadOrderData = useCallback(async (date: string) => {
    setListLoading(true);
    try {
      const [orders, pending] = await Promise.all([
        orderService.getOrdersByDate(date),
        orderService.getPendingDeliveries(),
      ]);
      setTodayOrders(orders);
      setPendingDeliveries(pending);
    } catch (e) {
      console.error(e);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeView === 'today') loadOrderData(filterDate);
  }, [activeView, filterDate, loadOrderData]);

  useEffect(() => {
    if (lastSyncResult && lastSyncResult.synced > 0) {
      if (activeView === 'today') loadOrderData(filterDate);
    }
  }, [lastSyncResult]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadOrderData(filterDate);
    setRefreshing(false);
  };

  const handleDeleteOrder = (order: Order) => {
    Alert.alert(
      'Delete Order',
      `Delete order #${order.receipt_no ?? order.order_id}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              await orderService.deleteOrder(order.order_id);
              await loadOrderData(filterDate);
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Failed to delete');
            }
          },
        },
      ]
    );
  };

  const handleCompletePending = async (order: Order) => {
    Alert.alert(
      'Complete Delivery',
      `Mark ${order.customer?.customer_name ?? 'customer'}'s order as completed?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete',
          onPress: async () => {
            try {
              await orderService.updateDeliveryStatus(order.order_id, 'COMPLETED');
              await loadOrderData(filterDate);
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Failed to update');
            }
          },
        },
      ]
    );
  };

  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    if (q.length < 1) { setSearchResults([]); return; }
    const results = await customerService.searchCustomers(q);
    setSearchResults(results);
  };

  const handleSelectCustomer = (c: Customer) => {
    setSelectedCustomer(c);
    setSearchModal(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleSubmit = async (payment: PaymentType, ref?: string) => {
    if (!quantity || parseInt(quantity) < 1) {
      Alert.alert('Error', 'Please enter quantity.');
      return;
    }
    if (orderType === 'DELIVERY' && !selectedCustomer) {
      Alert.alert('Error', 'Please select a customer for delivery orders.');
      return;
    }
    setLoading(true);
    try {
      const dueDate = (payment === 'CREDIT' && dueDays)
        ? format(addDays(new Date(), dueDays), 'yyyy-MM-dd')
        : null;

      const orderInput = {
        customer_id: selectedCustomer?.customer_id ?? null,
        order_type: orderType,
        unit_price: unitPrice,
        quantity: parseInt(quantity),
        total_amount: totalAmount,
        payment_type: payment,
        delivery_status: orderType === 'DELIVERY' ? deliveryStatus : 'COMPLETED' as const,
        remarks: remarks || undefined,
        gcash_ref: ref || null,
        rider_id: selectedRider?.rider_id ?? null,
        due_date: dueDate,
      };

      const result = await submitOrder(orderInput);
      if (result.offline) {
        await refreshPendingCount();
        Alert.alert('📴 Saved Offline', `₱${totalAmount.toLocaleString()} queued — will sync when online.`);
      } else {
        const dueLine = dueDate ? `\nDue: ${dueDate}` : '';
        const createdOrder = result.order;
        Alert.alert(
          '✅ Order Saved',
          `${payment}  ₱${totalAmount.toLocaleString()}${dueLine}`,
          [
            {
              text: '📄 Print Receipt',
              onPress: () => {
                if (createdOrder) {
                  shareOrderReceipt(createdOrder).catch(e =>
                    Alert.alert('Error', e?.message ?? 'Failed to generate receipt')
                  );
                }
              },
            },
            { text: 'Done', style: 'cancel' },
          ]
        );
      }

      setQuantity('');
      setRemarks('');
      setGcashRef('');
      setSelectedCustomer(null);
      setSelectedRider(null);
      setDueDays(null);
      setPaymentType('CASH');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.viewTabs}>
        <TouchableOpacity
          style={[styles.viewTab, activeView === 'form' && styles.viewTabActive]}
          onPress={() => setActiveView('form')}
        >
          <Text style={[styles.viewTabText, activeView === 'form' && styles.viewTabTextActive]}>
            ✍️ New Order{pendingCount > 0 ? ` (${pendingCount} offline)` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.viewTab, activeView === 'today' && styles.viewTabActive]}
          onPress={() => setActiveView('today')}
        >
          <Text style={[styles.viewTabText, activeView === 'today' && styles.viewTabTextActive]}>
            📋 Today's Orders
            {pendingDeliveries.length > 0 && (
              <Text style={styles.badge}> {pendingDeliveries.length}</Text>
            )}
          </Text>
        </TouchableOpacity>
      </View>

      {activeView === 'form' ? (
        <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.typeRow}>
            {(['WALK-IN', 'DELIVERY'] as OrderType[]).map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.typeBtn, orderType === t && styles.typeBtnActive]}
                onPress={() => { setOrderType(t); setSelectedCustomer(null); }}
              >
                <Text style={[styles.typeBtnText, orderType === t && styles.typeBtnTextActive]}>
                  {t === 'WALK-IN' ? '🚶 WALK-IN' : '🏍️ DELIVERY'}
                </Text>
                <Text style={[styles.priceLabel, orderType === t && styles.priceLabelActive]}>
                  ₱{orderType === t ? unitPrice : (t === 'DELIVERY' ? 45 : 40)} / gallon
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {orderType === 'DELIVERY' && (
            <View style={styles.section}>
              <Text style={styles.label}>Select Customer *</Text>
              <TouchableOpacity style={styles.customerPicker} onPress={() => setSearchModal(true)}>
                {selectedCustomer ? (
                  <View>
                    <Text style={styles.customerName}>{selectedCustomer.customer_name}</Text>
                    <Text style={styles.customerSub}>{selectedCustomer.phone_number} · {selectedCustomer.address}</Text>
                  </View>
                ) : (
                  <Text style={styles.placeholder}>Search by name or phone...</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {orderType === 'DELIVERY' && (
            <View style={styles.section}>
              <Text style={styles.label}>Delivery Status</Text>
              <View style={styles.row}>
                {(['PENDING', 'COMPLETED'] as const).map(s => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.statusBtn, deliveryStatus === s && styles.statusBtnActive]}
                    onPress={() => setDeliveryStatus(s)}
                  >
                    <Text style={[styles.statusText, deliveryStatus === s && styles.statusTextActive]}>
                      {s === 'PENDING' ? '⏳ Pending' : '✅ Completed'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {orderType === 'DELIVERY' && riders.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.label}>Assign Rider (Optional)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.riderRow}>
                <TouchableOpacity
                  style={[styles.riderChip, !selectedRider && styles.riderChipActive]}
                  onPress={() => setSelectedRider(null)}
                >
                  <Text style={[styles.riderChipText, !selectedRider && styles.riderChipTextActive]}>None</Text>
                </TouchableOpacity>
                {riders.map(r => (
                  <TouchableOpacity
                    key={r.rider_id}
                    style={[styles.riderChip, selectedRider?.rider_id === r.rider_id && styles.riderChipActive]}
                    onPress={() => setSelectedRider(r)}
                  >
                    <Text style={[styles.riderChipText, selectedRider?.rider_id === r.rider_id && styles.riderChipTextActive]}>
                      🏍️ {r.rider_name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.label}>Quantity (Gallons)</Text>
            <View style={styles.row}>
              <TouchableOpacity style={styles.qtyBtn} onPress={() => setQuantity(q => String(Math.max(0, (parseInt(q)||0) - 1)))}>
                <Text style={styles.qtyBtnText}>−</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.qtyInput}
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={COLORS.textMuted}
              />
              <TouchableOpacity style={styles.qtyBtn} onPress={() => setQuantity(q => String((parseInt(q)||0) + 1))}>
                <Text style={styles.qtyBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.totalBox}>
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.totalAmount}>₱{totalAmount.toLocaleString()}</Text>
            <Text style={styles.totalSub}>₱{unitPrice} × {quantity || 0} gallons</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Remarks</Text>
            <TextInput
              style={styles.remarks}
              value={remarks}
              onChangeText={setRemarks}
              placeholder="Enter any notes..."
              placeholderTextColor={COLORS.textMuted}
              multiline
            />
          </View>

<Text style={styles.label}>Select Payment Method</Text>
          <View style={styles.paymentRow}>
            <TouchableOpacity
              style={[styles.payBtn, { borderColor: COLORS.cash }]}
              onPress={() => handleSubmit('CASH')}
              disabled={loading}
            >
              <Text style={[styles.payBtnText, { color: COLORS.cash }]}>💵 CASH</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.payBtn, { borderColor: COLORS.ewallet }]}
              onPress={() => {
                if (!quantity || parseInt(quantity) < 1) {
                  Alert.alert('Error', 'Please enter quantity.');
                  return;
                }
                Alert.prompt(
                  '📱 Gcash Reference',
                  'Enter GCash reference number (optional)',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Confirm', onPress: (ref: string | undefined) => handleSubmit('GCASH', ref?.trim() || undefined) },
                  ],
                  'plain-text',
                  gcashRef,
                  'number-pad',
                );
              }}
              disabled={loading}
            >
              <Text style={[styles.payBtnText, { color: COLORS.ewallet }]}>📱 Gcash</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.payBtn, { borderColor: '#0EA5E9' }]}
              onPress={() => {
                if (!quantity || parseInt(quantity) < 1) {
                  Alert.alert('Error', 'Please enter quantity.');
                  return;
                }
                Alert.prompt(
                  '💙 Maya Pay Reference',
                  'Enter Maya reference number (optional)',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Confirm', onPress: (ref: string | undefined) => handleSubmit('MAYA', ref?.trim() || undefined) },
                  ],
                  'plain-text',
                  '',
                  'number-pad',
                );
              }}
              disabled={loading}
            >
              <Text style={[styles.payBtnText, { color: '#0EA5E9' }]}>💙 Maya</Text>
            </TouchableOpacity>
          </View>

          {loading && <ActivityIndicator color={COLORS.primary} style={{ margin: 16 }} />}
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.container}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        >
          {/* Date selector */}
          <View style={styles.datePicker}>
            <TouchableOpacity style={styles.dateArrow} onPress={() => setFilterDate(d => shiftDate(d, -1))}>
              <Text style={styles.dateArrowText}>‹</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setFilterDate(todayDateStr)}>
              <Text style={styles.dateLabel}>
                {filterDate === todayDateStr
                  ? 'Today'
                  : new Date(filterDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.dateArrow}
              onPress={() => setFilterDate(d => shiftDate(d, 1))}
              disabled={filterDate >= todayDateStr}
            >
              <Text style={[styles.dateArrowText, filterDate >= todayDateStr && { opacity: 0.25 }]}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Type filter */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
            {(['ALL', 'WALK-IN', 'DELIVERY'] as FilterType[]).map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.filterChip, filterType === t && styles.filterChipActive]}
                onPress={() => setFilterType(t)}
              >
                <Text style={[styles.filterChipText, filterType === t && styles.filterChipTextActive]}>
                  {t === 'ALL' ? 'All Types' : t === 'WALK-IN' ? '🚶 Walk-in' : '🏍️ Delivery'}
                </Text>
              </TouchableOpacity>
            ))}
            {(['ALL', 'CASH', 'GCASH', 'MAYA'] as FilterPayment[]).map(p => (
              <TouchableOpacity
                key={p}
                style={[styles.filterChip, filterPayment === p && styles.filterChipActive]}
                onPress={() => setFilterPayment(p)}
              >
                <Text style={[styles.filterChipText, filterPayment === p && styles.filterChipTextActive]}>
                  {p === 'ALL' ? 'All Pay' : p === 'GCASH' ? 'GCash' : p === 'MAYA' ? 'Maya' : p}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {pendingDeliveries.length > 0 && filterDate === todayDateStr && (
            <View style={styles.pendingSection}>
              <Text style={styles.pendingSectionTitle}>
                ⏳ Pending Deliveries: {pendingDeliveries.length}
              </Text>
              {pendingDeliveries.map(order => (
                <View key={order.order_id} style={styles.pendingCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pendingCustomer}>
                      {order.customer?.customer_name ?? 'No Customer'}
                    </Text>
                    <Text style={styles.pendingSub}>
                      {order.customer?.address ?? ''} · {order.quantity} gal · ₱{Number(order.total_amount).toLocaleString()}
                    </Text>
                    <Text style={styles.pendingTime}>
                      {new Date(order.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.completeBtn}
                    onPress={() => handleCompletePending(order)}
                  >
                    <Text style={styles.completeBtnText}>Done</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {(() => {
            const filtered = todayOrders
              .filter(o => filterType === 'ALL' || o.order_type === filterType)
              .filter(o => filterPayment === 'ALL' || o.payment_type === filterPayment);
            return (
              <>
                <Text style={styles.todaySectionTitle}>
                  Orders ({filtered.length}{filterType !== 'ALL' || filterPayment !== 'ALL' ? ` filtered` : ''})
                </Text>
                {listLoading ? (
                  <ActivityIndicator color={COLORS.primary} style={{ margin: 24 }} />
                ) : filtered.length === 0 ? (
                  <View style={styles.emptyBox}>
                    <Text style={styles.emptyIcon}>📋</Text>
                    <Text style={styles.emptyText}>
                      {todayOrders.length === 0 ? 'No orders on this date' : 'No orders match the filter'}
                    </Text>
                  </View>
                ) : (
                  filtered.map(order => (
              <View key={order.order_id} style={styles.orderCard}>
                <View style={styles.orderCardTop}>
                  <View style={styles.orderBadgeRow}>
                    <View style={[styles.typeBadge, { backgroundColor: order.order_type === 'WALK-IN' ? '#DBEAFE' : '#FEF3C7' }]}>
                      <Text style={[styles.typeBadgeText, { color: order.order_type === 'WALK-IN' ? COLORS.walkin : COLORS.delivery }]}>
                        {order.order_type === 'WALK-IN' ? '🚶 Walk-in' : '🏍️ Delivery'}
                      </Text>
                    </View>
                    <View style={[styles.payBadge, {
                      backgroundColor: order.payment_type === 'CASH' ? '#EAF3DE'
                        : order.payment_type === 'GCASH' ? '#EDE9FE'
                        : order.payment_type === 'MAYA' ? '#E0F2FE'
                        : '#FCEBEB',
                    }]}>
                      <Text style={[styles.payBadgeText, {
                        color: order.payment_type === 'CASH' ? COLORS.cash
                          : order.payment_type === 'GCASH' ? COLORS.ewallet
                          : order.payment_type === 'MAYA' ? '#0EA5E9'
                          : COLORS.credit,
                      }]}>
                        {order.payment_type === 'GCASH' ? 'GCash'
                          : order.payment_type === 'MAYA' ? 'Maya'
                          : order.payment_type}
                      </Text>
                    </View>
                    {order.order_type === 'DELIVERY' && order.delivery_status === 'PENDING' && (
                      <View style={styles.pendingBadge}>
                        <Text style={styles.pendingBadgeText}>Pending</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.orderTime}>
                    {new Date(order.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                {order.customer && (
                  <Text style={styles.orderCustomer}>{order.customer.customer_name}</Text>
                )}
                <View style={styles.orderCardBottom}>
                  <Text style={styles.orderQty}>{order.quantity} gal × ₱{Number(order.unit_price).toLocaleString()}</Text>
                  <Text style={styles.orderTotal}>₱{Number(order.total_amount).toLocaleString()}</Text>
                </View>
                {order.receipt_no && (
                  <Text style={styles.orderReceiptNo}>#{order.receipt_no}</Text>
                )}
                {order.remarks ? <Text style={styles.orderRemarks}>{order.remarks}</Text> : null}
                <View style={styles.orderActionRow}>
                  <TouchableOpacity
                    style={styles.orderReceiptBtn}
                    onPress={() => shareOrderReceipt(order).catch(e => Alert.alert('Error', e?.message ?? 'Failed'))}
                  >
                    <Text style={styles.orderReceiptText}>📄 Receipt</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.orderDeleteBtn} onPress={() => handleDeleteOrder(order)}>
                    <Text style={styles.orderDeleteText}>🗑️ Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
              </>
            );
          })()}
        </ScrollView>
      )}

      <Modal visible={searchModal} animationType="slide" onRequestClose={() => setSearchModal(false)}>
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Search Customer</Text>
            <TouchableOpacity onPress={() => setSearchModal(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={handleSearch}
            placeholder="Name or Phone"
            placeholderTextColor={COLORS.textMuted}
            autoFocus
          />
          <FlatList
            data={searchResults}
            keyExtractor={item => String(item.customer_id)}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.searchItem} onPress={() => handleSelectCustomer(item)}>
                <Text style={styles.searchItemName}>{item.customer_name}</Text>
                <Text style={styles.searchItemSub}>{item.phone_number}</Text>
                <Text style={styles.searchItemAddr}>{item.address}</Text>
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  viewTabs: { flexDirection: 'row', backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  viewTab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  viewTabActive: { borderBottomWidth: 2, borderBottomColor: COLORS.primary },
  viewTabText: { fontSize: 14, fontWeight: '500', color: COLORS.textMuted },
  viewTabTextActive: { color: COLORS.primary, fontWeight: '700' },
  badge: { fontSize: 12, color: COLORS.danger, fontWeight: '700' },
  container: { flex: 1, padding: 16 },
  typeRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  typeBtn: {
    flex: 1, padding: 14, borderRadius: 12, borderWidth: 2,
    borderColor: COLORS.border, backgroundColor: COLORS.surface, alignItems: 'center',
  },
  typeBtnActive: { borderColor: COLORS.primary, backgroundColor: '#E1F5EE' },
  typeBtnText: { fontSize: 15, fontWeight: '600', color: COLORS.textSecondary },
  typeBtnTextActive: { color: COLORS.primaryDark },
  priceLabel: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  priceLabelActive: { color: COLORS.primary },
  section: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 8 },
  customerPicker: {
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 10, padding: 14, minHeight: 52,
  },
  customerName: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary },
  customerSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  placeholder: { fontSize: 14, color: COLORS.textMuted },
  row: { flexDirection: 'row', gap: 10 },
  statusBtn: {
    flex: 1, padding: 12, borderRadius: 8, borderWidth: 1,
    borderColor: COLORS.border, alignItems: 'center',
  },
  statusBtnActive: { borderColor: COLORS.primary, backgroundColor: '#E1F5EE' },
  statusText: { fontSize: 14, color: COLORS.textSecondary },
  statusTextActive: { color: COLORS.primary, fontWeight: '600' },
  qtyBtn: {
    width: 48, height: 48, borderRadius: 8, borderWidth: 1,
    borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.surface,
  },
  qtyBtnText: { fontSize: 22, color: COLORS.textPrimary },
  qtyInput: {
    flex: 1, textAlign: 'center', fontSize: 22, fontWeight: '700',
    color: COLORS.textPrimary, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 8, backgroundColor: COLORS.surface,
  },
  totalBox: {
    backgroundColor: COLORS.primary, borderRadius: 14, padding: 18,
    alignItems: 'center', marginBottom: 20,
  },
  totalLabel: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginBottom: 4 },
  totalAmount: { fontSize: 36, fontWeight: '700', color: '#fff' },
  totalSub: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  remarks: {
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 10, padding: 12, fontSize: 14, color: COLORS.textPrimary,
    minHeight: 72, textAlignVertical: 'top',
  },
  paymentRow: { flexDirection: 'row', gap: 8, marginBottom: 40 },
  payBtn: {
    flex: 1, paddingVertical: 12, paddingHorizontal: 4,
    borderRadius: 12, borderWidth: 2,
    backgroundColor: COLORS.surface, alignItems: 'center',
  },
  payBtnText: { fontSize: 13, fontWeight: '700' },
  payBtnDisabled: { opacity: 0.35 },
  payBtnTextDisabled: { opacity: 0.4 },
  pendingSection: {
    backgroundColor: '#FFF7ED', borderRadius: 12, padding: 14,
    marginBottom: 16, borderWidth: 1, borderColor: '#FCD34D',
  },
  pendingSectionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.delivery, marginBottom: 10 },
  pendingCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface,
    borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: COLORS.border,
  },
  pendingCustomer: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary },
  pendingSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  pendingTime: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  completeBtn: { backgroundColor: COLORS.primary, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  completeBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  todaySectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 12 },
  emptyBox: { alignItems: 'center', padding: 48 },
  emptyIcon: { fontSize: 36, marginBottom: 10 },
  emptyText: { fontSize: 14, color: COLORS.textMuted },
  orderCard: {
    backgroundColor: COLORS.surface, borderRadius: 12, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: COLORS.border,
  },
  orderCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  orderBadgeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  typeBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  typeBadgeText: { fontSize: 12, fontWeight: '600' },
  payBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  payBadgeText: { fontSize: 12, fontWeight: '600' },
  pendingBadge: { backgroundColor: '#FEE2E2', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  pendingBadgeText: { fontSize: 12, fontWeight: '600', color: COLORS.danger },
  orderTime: { fontSize: 12, color: COLORS.textMuted },
  orderCustomer: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 4 },
  orderCardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderQty: { fontSize: 13, color: COLORS.textSecondary },
  orderTotal: { fontSize: 17, fontWeight: '700', color: COLORS.primary },
  orderRemarks: { fontSize: 12, color: COLORS.textMuted, marginTop: 4, fontStyle: 'italic' },
  orderReceiptNo: { fontSize: 11, color: COLORS.textMuted, marginTop: 4 },
  datePicker: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.surface, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, marginBottom: 10, borderWidth: 1, borderColor: COLORS.border },
  dateArrow: { padding: 8 },
  dateArrowText: { fontSize: 24, color: COLORS.primary, fontWeight: '700' },
  dateLabel: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  filterRow: { flexDirection: 'row' as const, marginBottom: 14 },
  filterChip: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8, backgroundColor: COLORS.surface },
  filterChipActive: { borderColor: COLORS.primary, backgroundColor: '#E1F5EE' },
  filterChipText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '500' },
  filterChipTextActive: { color: COLORS.primary, fontWeight: '700' },
  orderActionRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 },
  orderReceiptBtn: { paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: COLORS.primary, borderRadius: 6 },
  orderReceiptText: { fontSize: 12, color: COLORS.primary },
  orderDeleteBtn: { paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: COLORS.danger, borderRadius: 6 },
  orderDeleteText: { fontSize: 12, color: COLORS.danger },
  riderRow: { flexDirection: 'row' as const },
  riderChip: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8, marginRight: 8,
    backgroundColor: COLORS.surface,
  },
  riderChipActive: { borderColor: COLORS.delivery, backgroundColor: '#FEF3C7' },
  riderChipText: { fontSize: 13, color: COLORS.textSecondary },
  riderChipTextActive: { color: COLORS.delivery, fontWeight: '700' },
  dueDayBtn: {
    flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10,
    padding: 10, alignItems: 'center' as const, backgroundColor: COLORS.surface,
  },
  dueDayBtnActive: { borderColor: COLORS.credit, backgroundColor: '#FFF0F5' },
  dueDayText: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  dueDayTextActive: { color: COLORS.credit },
  dueDatePreview: { fontSize: 11, color: COLORS.credit, marginTop: 2 },
  modal: { flex: 1, backgroundColor: COLORS.background },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
  modalClose: { fontSize: 20, color: COLORS.textSecondary },
  searchInput: {
    margin: 12, padding: 12, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 10, fontSize: 15, backgroundColor: COLORS.surface, color: COLORS.textPrimary,
  },
  searchItem: {
    padding: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  searchItemName: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary },
  searchItemSub: { fontSize: 13, color: COLORS.textSecondary },
  searchItemAddr: { fontSize: 12, color: COLORS.textMuted },
});
