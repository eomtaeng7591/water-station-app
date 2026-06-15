import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, TextInput, RefreshControl, Modal,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { inventoryService, InventoryItem, InventoryLog } from '../../services/inventoryService';
import { COLORS } from '../../constants';

const LOG_TYPE_COLOR: Record<string, string> = {
  RESTOCK:    '#15803D',
  SALE:       '#1D4ED8',
  RETURN:     '#6D28D9',
  ADJUSTMENT: '#B45309',
};
const LOG_TYPE_SIGN: Record<string, string> = {
  RESTOCK:    '+',
  SALE:       '−',
  RETURN:     '+',
  ADJUSTMENT: '±',
};

export default function InventoryScreen() {
  const navigation = useNavigation<any>();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [logs, setLogs]   = useState<InventoryLog[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState<'restock' | 'adjust' | 'threshold'>('restock');
  const [activeItem, setActiveItem] = useState<InventoryItem | null>(null);
  const [inputQty, setInputQty] = useState('');
  const [inputNote, setInputNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [inv, lg] = await Promise.all([
        inventoryService.getAll(),
        inventoryService.getLogs(undefined, 30),
      ]);
      setItems(inv);
      setLogs(lg);
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

  const openModal = (item: InventoryItem, mode: 'restock' | 'adjust' | 'threshold') => {
    setActiveItem(item);
    setModalMode(mode);
    setInputQty(mode === 'threshold' ? String(item.low_stock_threshold) : '');
    setInputNote('');
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!activeItem) return;
    const qty = parseInt(inputQty);
    if (isNaN(qty) || (modalMode !== 'threshold' && qty === 0)) {
      Alert.alert('Error', 'Enter a valid number.');
      return;
    }
    setSaving(true);
    try {
      if (modalMode === 'restock') {
        await inventoryService.restock(activeItem.item_id, qty, inputNote || undefined);
      } else if (modalMode === 'adjust') {
        await inventoryService.adjust(activeItem.item_id, qty, inputNote || undefined);
      } else {
        await inventoryService.setThreshold(activeItem.item_id, qty);
      }
      setModalVisible(false);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const isLow = (item: InventoryItem) =>
    item.low_stock_threshold > 0 && item.current_stock <= item.low_stock_threshold;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>📦 Inventory</Text>
        <View style={{ width: 60 }} />
      </View>
      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >

        {loading ? (
          <ActivityIndicator color={COLORS.primary} style={{ margin: 32 }} />
        ) : (
          <>
            {/* Stock cards */}
            {items.map(item => (
              <View
                key={item.item_id}
                style={[styles.stockCard, isLow(item) && styles.stockCardLow]}
              >
                <View style={styles.stockTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.stockName}>{item.item_name}</Text>
                    {isLow(item) && (
                      <Text style={styles.lowWarning}>⚠️ Low stock!</Text>
                    )}
                  </View>
                  <View style={styles.stockBadge}>
                    <Text style={[styles.stockCount, isLow(item) && { color: COLORS.danger }]}>
                      {item.current_stock}
                    </Text>
                    <Text style={styles.stockUnit}>{item.unit}</Text>
                  </View>
                </View>

                <View style={styles.thresholdRow}>
                  <Text style={styles.thresholdText}>
                    Alert threshold: {item.low_stock_threshold} {item.unit}
                  </Text>
                  <TouchableOpacity onPress={() => openModal(item, 'threshold')}>
                    <Text style={styles.editThreshold}>Edit</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={styles.restockBtn}
                    onPress={() => openModal(item, 'restock')}
                  >
                    <Text style={styles.restockBtnText}>+ Restock</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.adjustBtn}
                    onPress={() => openModal(item, 'adjust')}
                  >
                    <Text style={styles.adjustBtnText}>Adjust</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            {/* Activity log */}
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            {logs.length === 0 ? (
              <Text style={styles.emptyText}>No activity yet.</Text>
            ) : (
              logs.map(log => (
                <View key={log.log_id} style={styles.logRow}>
                  <View style={[styles.logTypeBadge, { backgroundColor: LOG_TYPE_COLOR[log.change_type] + '20' }]}>
                    <Text style={[styles.logTypeText, { color: LOG_TYPE_COLOR[log.change_type] }]}>
                      {log.change_type}
                    </Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.logItemName}>{log.item_name}</Text>
                    {log.note ? <Text style={styles.logNote}>{log.note}</Text> : null}
                    <Text style={styles.logDate}>
                      {new Date(log.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      {' '}
                      {new Date(log.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  <Text style={[styles.logQty, { color: LOG_TYPE_COLOR[log.change_type] }]}>
                    {LOG_TYPE_SIGN[log.change_type]}{Math.abs(log.quantity)} {log.unit}
                  </Text>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={() => setModalVisible(false)} />
          <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>
            {modalMode === 'restock' ? `+ Restock — ${activeItem?.item_name}`
              : modalMode === 'adjust' ? `Adjust — ${activeItem?.item_name}`
              : `Alert Threshold — ${activeItem?.item_name}`}
          </Text>

          <Text style={styles.inputLabel}>
            {modalMode === 'threshold' ? 'Threshold' : 'Quantity'}
            {modalMode === 'adjust' && ' (use negative to decrease)'}
          </Text>
          <TextInput
            style={styles.input}
            value={inputQty}
            onChangeText={setInputQty}
            keyboardType="number-pad"
            placeholder={modalMode === 'adjust' ? 'e.g. -5 or +20' : '0'}
            placeholderTextColor={COLORS.textMuted}
            autoFocus
          />

          {modalMode !== 'threshold' && (
            <>
              <Text style={styles.inputLabel}>Note (optional)</Text>
              <TextInput
                style={[styles.input, { height: 72, textAlignVertical: 'top' }]}
                value={inputNote}
                onChangeText={setInputNote}
                placeholder="e.g. Supplier delivery, Manual count..."
                placeholderTextColor={COLORS.textMuted}
                multiline
              />
            </>
          )}

          {saving ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 16 }} />
          ) : (
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              <Text style={styles.saveBtnText}>
                {modalMode === 'threshold' ? 'Set Threshold' : modalMode === 'restock' ? 'Restock' : 'Apply Adjustment'}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
            <Text style={styles.cancelText}>Cancel</Text>
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
  back: { fontSize: 16, color: COLORS.primary, minWidth: 60 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary },
  container: { flex: 1, padding: 16 },
  title: { fontSize: 22, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 20 },
  stockCard: {
    backgroundColor: COLORS.surface, borderRadius: 14, padding: 16,
    marginBottom: 14, borderWidth: 1, borderColor: COLORS.border,
  },
  stockCardLow: { borderColor: COLORS.danger, borderWidth: 2 },
  stockTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  stockName: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  lowWarning: { fontSize: 12, color: COLORS.danger, marginTop: 2 },
  stockBadge: { alignItems: 'flex-end' },
  stockCount: { fontSize: 36, fontWeight: '700', color: COLORS.primary },
  stockUnit: { fontSize: 12, color: COLORS.textMuted, marginTop: -4 },
  thresholdRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderTopWidth: 1, borderTopColor: COLORS.background, marginBottom: 10,
  },
  thresholdText: { fontSize: 12, color: COLORS.textMuted },
  editThreshold: { fontSize: 12, color: COLORS.primary, fontWeight: '600' },
  actionRow: { flexDirection: 'row', gap: 10 },
  restockBtn: {
    flex: 1, backgroundColor: COLORS.primary, borderRadius: 10,
    paddingVertical: 10, alignItems: 'center',
  },
  restockBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  adjustBtn: {
    flex: 1, borderWidth: 1.5, borderColor: COLORS.primary, borderRadius: 10,
    paddingVertical: 10, alignItems: 'center',
  },
  adjustBtnText: { color: COLORS.primary, fontWeight: '700', fontSize: 14 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 10, marginTop: 4 },
  emptyText: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', paddingVertical: 20 },
  logRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface,
    borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: COLORS.border,
  },
  logTypeBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, minWidth: 80, alignItems: 'center' },
  logTypeText: { fontSize: 11, fontWeight: '700' },
  logItemName: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary },
  logNote: { fontSize: 11, color: COLORS.textSecondary, marginTop: 1 },
  logDate: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  logQty: { fontSize: 14, fontWeight: '700', marginLeft: 8 },
  modalContainer: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, paddingBottom: 44,
  },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 20, textAlign: 'center' },
  inputLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 },
  input: {
    backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 10, padding: 12, fontSize: 18, color: COLORS.textPrimary, marginBottom: 16,
  },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 8 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  cancelBtn: { alignItems: 'center', paddingVertical: 10 },
  cancelText: { fontSize: 14, color: COLORS.textMuted },
});
