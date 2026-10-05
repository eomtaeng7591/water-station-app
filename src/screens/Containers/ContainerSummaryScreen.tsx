import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl,
  Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { containerService } from '../../services/containerService';
import { getCurrentStoreId } from '../../services/storeContext';
import { ContainerType, StoreContainerSummary } from '../../types';
import { COLORS } from '../../constants';
import { showAlert } from '../../utils/alert';

type StockTxnMode = 'restock' | 'dispose';

const CONTAINER_SIZE_PRESETS = ['5L', '6L', '7L', '10L'];
const HIDDEN_PRESETS_KEY_PREFIX = 'hidden_container_presets_';

type MergedContainer = ContainerType & Partial<Pick<StoreContainerSummary, 'out_with_customers' | 'sold_permanently' | 'available_in_shop'>>;

export default function ContainerSummaryScreen() {
  const navigation = useNavigation<any>();
  const [containers, setContainers] = useState<MergedContainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState<StockTxnMode>('restock');
  const [activeSize, setActiveSize] = useState<MergedContainer | null>(null);
  const [inputQty, setInputQty] = useState('');
  const [inputNotes, setInputNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const [priceDrafts, setPriceDrafts] = useState<Record<string, { walkin: string; delivery: string }>>({});
  const [priceSavingId, setPriceSavingId] = useState<string | null>(null);
  const [otherOpen, setOtherOpen] = useState(false);
  const [otherLabel, setOtherLabel] = useState('');
  const [addContainerLoading, setAddContainerLoading] = useState(false);
  const [hiddenPresets, setHiddenPresets] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [types, summary, storeId] = await Promise.all([
        containerService.getContainerTypes(),
        containerService.getStoreSummary(),
        getCurrentStoreId(),
      ]);
      const summaryById = new Map(summary.map(s => [s.container_type_id, s]));
      setContainers(types.map(t => ({ ...t, ...summaryById.get(t.container_type_id) })));
      const stored = await AsyncStorage.getItem(HIDDEN_PRESETS_KEY_PREFIX + storeId);
      setHiddenPresets(stored ? JSON.parse(stored) : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleRemovePreset = (size: string) => {
    showAlert(`Remove "${size}" from suggestions?`, 'You can still add it later by typing it under "Other".', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const storeId = await getCurrentStoreId();
          const next = [...hiddenPresets, size];
          setHiddenPresets(next);
          await AsyncStorage.setItem(HIDDEN_PRESETS_KEY_PREFIX + storeId, JSON.stringify(next));
        },
      },
    ]);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const openModal = (size: MergedContainer, mode: StockTxnMode) => {
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
      showAlert('Error', 'Enter a quantity greater than 0.');
      return;
    }
    setSaving(true);
    try {
      await containerService.applyStockTxn(activeSize.container_type_id, modalMode, qty, inputNotes.trim() || undefined);
      setModalVisible(false);
      await load();
    } catch (e: any) {
      showAlert('Error', e.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddContainer = async (label: string) => {
    const trimmed = label.trim();
    if (!trimmed) {
      showAlert('Error', 'Please enter a size label.');
      return;
    }
    if (containers.some(c => c.label.toLowerCase() === trimmed.toLowerCase())) {
      showAlert('Error', `"${trimmed}" already exists.`);
      return;
    }
    setAddContainerLoading(true);
    try {
      await containerService.addContainerType(trimmed, 0);
      setOtherOpen(false);
      setOtherLabel('');
      await load();
    } catch (e: any) {
      showAlert('Error', e.message || 'Failed to add container size.');
    } finally {
      setAddContainerLoading(false);
    }
  };

  const getPriceDraft = (ct: MergedContainer, field: 'walkin' | 'delivery'): string => {
    const draft = priceDrafts[ct.container_type_id];
    if (draft) return draft[field];
    const value = field === 'walkin' ? ct.walkin_price : ct.delivery_price;
    return value === null ? '' : String(value);
  };

  const setPriceDraft = (containerTypeId: string, field: 'walkin' | 'delivery', value: string, ct: MergedContainer) => {
    setPriceDrafts(d => {
      const current = d[containerTypeId] ?? {
        walkin: ct.walkin_price === null ? '' : String(ct.walkin_price),
        delivery: ct.delivery_price === null ? '' : String(ct.delivery_price),
      };
      return { ...d, [containerTypeId]: { ...current, [field]: value } };
    });
  };

  const handleSavePrice = async (ct: MergedContainer) => {
    const draft = priceDrafts[ct.container_type_id];
    const walkinStr = draft ? draft.walkin : getPriceDraft(ct, 'walkin');
    const deliveryStr = draft ? draft.delivery : getPriceDraft(ct, 'delivery');
    const walkin = walkinStr.trim() === '' ? null : parseFloat(walkinStr);
    const delivery = deliveryStr.trim() === '' ? null : parseFloat(deliveryStr);
    if ((walkin !== null && isNaN(walkin)) || (delivery !== null && isNaN(delivery))) {
      showAlert('Error', 'Please enter valid prices (or leave blank to use the store price).');
      return;
    }
    setPriceSavingId(ct.container_type_id);
    try {
      await containerService.setPrices(ct.container_type_id, walkin, delivery);
      setPriceDrafts(d => {
        const next = { ...d };
        delete next[ct.container_type_id];
        return next;
      });
      await load();
    } catch (e: any) {
      showAlert('Error', e.message || 'Failed to save price.');
    } finally {
      setPriceSavingId(null);
    }
  };

  const handleToggleContainerActive = (ct: MergedContainer) => {
    const label = ct.is_active ? 'Deactivate' : 'Activate';
    showAlert(`${label} "${ct.label}"?`, ct.is_active ? 'Past transactions are kept.' : undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: label,
        onPress: async () => {
          try {
            await containerService.setActive(ct.container_type_id, !ct.is_active);
            await load();
          } catch (e: any) {
            showAlert('Error', e.message || 'Failed to update.');
          }
        },
      },
    ]);
  };

  const handleDeleteContainer = (ct: MergedContainer) => {
    showAlert(
      `Delete "${ct.label}"?`,
      'This cannot be undone. Sizes used in any past order, borrow, or restock can\'t be deleted — deactivate them instead.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await containerService.deleteContainerType(ct.container_type_id);
              await load();
            } catch (e: any) {
              const msg = /foreign key|violates|referenced/i.test(e.message || '')
                ? `"${ct.label}" has past orders or transactions and can't be deleted. Use Deactivate instead.`
                : (e.message || 'Failed to delete.');
              showAlert('Error', msg);
            }
          },
        },
      ]
    );
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
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {loading ? (
          <ActivityIndicator color={COLORS.primary} style={{ margin: 32 }} />
        ) : containers.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No container sizes registered yet.</Text>
            <Text style={styles.emptySub}>Add your first size below.</Text>
          </View>
        ) : (
          containers.map(s => {
            const negative = (s.available_in_shop ?? 0) < 0;
            return (
              <View key={s.container_type_id} style={[styles.card, !s.is_active && styles.cardInactive]}>
                <View style={styles.cardHeaderRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardLabel}>{s.label}</Text>
                    {!s.is_active && <Text style={styles.inactiveText}>Inactive</Text>}
                  </View>
                  <TouchableOpacity style={styles.toggleBtn} onPress={() => handleToggleContainerActive(s)}>
                    <Text style={[styles.toggleBtnText, { color: s.is_active ? COLORS.danger : COLORS.primary }]}>
                      {s.is_active ? 'Deactivate' : 'Activate'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.toggleBtn} onPress={() => handleDeleteContainer(s)}>
                    <Text style={[styles.toggleBtnText, { color: COLORS.danger }]}>Delete</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.statRow}>
                  <Text style={styles.statKey}>Owned by Store</Text>
                  <Text style={styles.statVal}>{s.owned_qty}</Text>
                </View>
                <View style={styles.statRow}>
                  <Text style={styles.statKey}>Out with Customers</Text>
                  <Text style={styles.statVal}>{s.out_with_customers ?? 0}</Text>
                </View>
                <View style={styles.statRow}>
                  <Text style={styles.statKey}>Sold Permanently</Text>
                  <Text style={styles.statVal}>{s.sold_permanently ?? 0}</Text>
                </View>

                <View style={styles.availableRow}>
                  <Text style={styles.availableLabel}>Available in Shop</Text>
                  <Text style={[styles.availableVal, negative && styles.availableValNegative]}>
                    {s.available_in_shop ?? s.owned_qty}
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

                {s.is_active && (
                  <View style={styles.priceRowInline}>
                    <View style={styles.priceFieldGroup}>
                      <Text style={styles.priceFieldLabel}>Walk-in ₱</Text>
                      <TextInput
                        style={styles.priceFieldInput}
                        value={getPriceDraft(s, 'walkin')}
                        onChangeText={(v) => setPriceDraft(s.container_type_id, 'walkin', v, s)}
                        keyboardType="decimal-pad"
                        placeholder="Store price"
                        placeholderTextColor={COLORS.textMuted}
                      />
                    </View>
                    <View style={styles.priceFieldGroup}>
                      <Text style={styles.priceFieldLabel}>Delivery ₱</Text>
                      <TextInput
                        style={styles.priceFieldInput}
                        value={getPriceDraft(s, 'delivery')}
                        onChangeText={(v) => setPriceDraft(s.container_type_id, 'delivery', v, s)}
                        keyboardType="decimal-pad"
                        placeholder="Store price"
                        placeholderTextColor={COLORS.textMuted}
                      />
                    </View>
                    <TouchableOpacity
                      style={styles.priceSaveBtn}
                      onPress={() => handleSavePrice(s)}
                      disabled={priceSavingId === s.container_type_id}
                    >
                      {priceSavingId === s.container_type_id
                        ? <ActivityIndicator color={COLORS.primary} size="small" />
                        : <Text style={styles.priceSaveBtnText}>Save</Text>
                      }
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })
        )}

        <View style={styles.addSection}>
          <Text style={styles.presetLabel}>Add Size</Text>
          <View style={styles.presetChipRow}>
            {CONTAINER_SIZE_PRESETS.filter(size => !hiddenPresets.includes(size)).map(size => {
              const exists = containers.some(c => c.label.toLowerCase() === size.toLowerCase());
              return (
                <View key={size} style={styles.presetChipWrap}>
                  <TouchableOpacity
                    style={[styles.presetChip, exists && styles.presetChipDisabled]}
                    onPress={() => handleAddContainer(size)}
                    disabled={exists || addContainerLoading}
                  >
                    <Text style={[styles.presetChipText, exists && styles.presetChipTextDisabled]}>
                      {exists ? `✓ ${size}` : size}
                    </Text>
                  </TouchableOpacity>
                  {!exists && (
                    <TouchableOpacity style={styles.presetChipRemove} onPress={() => handleRemovePreset(size)}>
                      <Text style={styles.presetChipRemoveText}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
            <TouchableOpacity
              style={[styles.presetChip, otherOpen && styles.presetChipActive]}
              onPress={() => setOtherOpen(o => !o)}
              disabled={addContainerLoading}
            >
              <Text style={[styles.presetChipText, otherOpen && styles.presetChipTextActive]}>Other</Text>
            </TouchableOpacity>
          </View>

          {otherOpen && (
            <View style={styles.containerAddRow}>
              <TextInput
                style={[styles.containerAddInput, { flex: 1 }]}
                value={otherLabel}
                onChangeText={setOtherLabel}
                placeholder="e.g. 3L"
                placeholderTextColor={COLORS.textMuted}
                autoFocus
              />
              <TouchableOpacity
                style={styles.priceSaveBtn}
                onPress={() => handleAddContainer(otherLabel)}
                disabled={addContainerLoading}
              >
                {addContainerLoading
                  ? <ActivityIndicator color={COLORS.primary} size="small" />
                  : <Text style={styles.priceSaveBtnText}>Add</Text>
                }
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.toggleBtn}
                onPress={() => { setOtherOpen(false); setOtherLabel(''); }}
              >
                <Text style={styles.toggleBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
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
  cardInactive: { opacity: 0.6 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 10 },
  cardLabel: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary },
  inactiveText: { fontSize: 11, color: COLORS.textMuted, marginTop: 1 },
  toggleBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  toggleBtnText: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
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
  priceRowInline: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: COLORS.border },
  priceFieldGroup: { flex: 1 },
  priceFieldLabel: { fontSize: 11, color: COLORS.textMuted, marginBottom: 4 },
  priceFieldInput: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 8,
    paddingVertical: 8, paddingHorizontal: 10, fontSize: 14, color: COLORS.textPrimary,
    backgroundColor: COLORS.background,
  },
  priceSaveBtn: {
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: '#E1F5EE',
  },
  priceSaveBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  addSection: {
    backgroundColor: COLORS.surface, borderRadius: 14, padding: 16,
    marginBottom: 24, borderWidth: 1, borderColor: COLORS.border,
  },
  presetLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 8 },
  presetChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  presetChipWrap: { position: 'relative' },
  presetChip: {
    borderWidth: 1, borderColor: COLORS.primary, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8, backgroundColor: COLORS.background,
  },
  presetChipActive: { backgroundColor: '#E1F5EE' },
  presetChipDisabled: { borderColor: COLORS.border, backgroundColor: COLORS.background },
  presetChipText: { fontSize: 13, fontWeight: '600', color: COLORS.primary },
  presetChipTextActive: { color: COLORS.primaryDark },
  presetChipTextDisabled: { color: COLORS.textMuted },
  presetChipRemove: {
    position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: 9,
    backgroundColor: COLORS.danger, alignItems: 'center', justifyContent: 'center',
  },
  presetChipRemoveText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  containerAddRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  containerAddInput: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 8,
    paddingVertical: 8, paddingHorizontal: 10, fontSize: 14, color: COLORS.textPrimary,
    backgroundColor: COLORS.background,
  },
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
