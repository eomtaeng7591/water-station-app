import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl,
  Modal, TextInput, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { containerService } from '../../services/containerService';
import { StoreContainerSummary } from '../../types';
import { COLORS } from '../../constants';

type StockTxnMode = 'restock' | 'dispose';

export default function ContainerSummaryScreen() {
  const navigation = useNavigation<any>();
  const [summary, setSummary] = useState<StoreContainerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState<StockTxnMode>('restock');
  const [activeSize, setActiveSize] = useState<StoreContainerSummary | null>(null);
  const [inputQty, setInputQty] = useState('');
  const [inputNotes, setInputNotes] = useState('');
  const [saving, setSaving] = useState(false);

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

  const openModal = (size: StoreContainerSummary, mode: StockTxnMode) => {
    setActiveSize(size);
    setModalMode(mode);
    setInputQty('');
    setInputNotes('');
    setModalVisible(true);
  };

  const handleSaveStockTxn = async () => {
    if (!activeSize) return;
    const qty = parseInt(inputQty, 10);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Error', 'Enter a quantity greater than 0.');
      return;
    }
    setSaving(true);
    try {
      await containerService.applyStockTxn(activeSize.container_type_id, modalMode, qty, inputNotes.trim() || undefined);
      setModalVisible(false);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
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

                <View style={styles.actionRow}>
                  <TouchableOpacity style={styles.restockBtn} onPress={() => openModal(s, 'restock')}>
                    <Text style={styles.restockBtnText}>+ Restock</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.disposeBtn} onPress={() => openModal(s, 'dispose')}>
                    <Text style={styles.disposeBtnText}>Dispose</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setModalVisible(false)} />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>
              {modalMode === 'restock' ? '+ Restock' : 'Dispose'} — {activeSize?.label}
            </Text>

            <Text style={styles.inputLabel}>Quantity</Text>
            <TextInput
              style={styles.input}
              value={inputQty}
              onChangeText={setInputQty}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={COLORS.textMuted}
              autoFocus
            />

            <Text style={styles.inputLabel}>Notes (optional)</Text>
            <TextInput
              style={[styles.input, { height: 72, textAlignVertical: 'top' }]}
              value={inputNotes}
              onChangeText={setInputNotes}
              placeholder={modalMode === 'restock' ? 'e.g. Bought 50 new 5L jugs' : 'e.g. Cracked, no longer usable'}
              placeholderTextColor={COLORS.textMuted}
              multiline
            />

            {saving ? (
              <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 16 }} />
            ) : (
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveStockTxn}>
                <Text style={styles.saveBtnText}>
                  {modalMode === 'restock' ? 'Add to Stock' : 'Confirm Dispose'}
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
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  restockBtn: {
    flex: 1, backgroundColor: COLORS.primary, borderRadius: 10,
    paddingVertical: 10, alignItems: 'center',
  },
  restockBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  disposeBtn: {
    flex: 1, borderWidth: 1.5, borderColor: COLORS.danger, borderRadius: 10,
    paddingVertical: 10, alignItems: 'center',
  },
  disposeBtnText: { color: COLORS.danger, fontWeight: '700', fontSize: 13 },
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
