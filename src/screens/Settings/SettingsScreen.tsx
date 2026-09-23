import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, ScrollView, Modal,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { settingsService } from '../../services/settingsService';
import { pinService } from '../../services/pinService';
import { containerService } from '../../services/containerService';
import { COLORS } from '../../constants';
import { ContainerType } from '../../types';
import NotificationSettings from './NotificationSettings';
import PinLockScreen from '../Auth/PinLockScreen';

const CONTAINER_SIZE_PRESETS = ['5L', '6L', '7L', '10L'];

export default function SettingsScreen({ onLogout }: { onLogout?: () => void }) {
  const navigation = useNavigation<any>();
  const [deliveryPrice, setDeliveryPrice] = useState('45');
  const [walkinPrice, setWalkinPrice] = useState('40');
  const [priceLoading, setPriceLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const [dailyTarget, setDailyTarget] = useState('0');
  const [monthlyTarget, setMonthlyTarget] = useState('0');
  const [targetLoading, setTargetLoading] = useState(false);
  const [targetSaved, setTargetSaved] = useState(false);

  const [pinEnabled, setPinEnabled] = useState(false);
  const [pinModal, setPinModal] = useState<'set' | 'confirm' | 'verify-old' | 'verify-disable' | null>(null);
  const [pendingPin, setPendingPin] = useState('');

  const [containers, setContainers] = useState<ContainerType[]>([]);
  const [containersLoading, setContainersLoading] = useState(true);
  const [qtyDrafts, setQtyDrafts] = useState<Record<string, string>>({});
  const [qtySavingId, setQtySavingId] = useState<string | null>(null);
  const [otherOpen, setOtherOpen] = useState(false);
  const [otherLabel, setOtherLabel] = useState('');
  const [addContainerLoading, setAddContainerLoading] = useState(false);

  const loadContainers = () => {
    setContainersLoading(true);
    containerService.getContainerTypes()
      .then(setContainers)
      .catch(console.error)
      .finally(() => setContainersLoading(false));
  };

  useEffect(() => {
    pinService.isEnabled().then(setPinEnabled).catch(() => {});
    settingsService.getSettings().then(s => {
      setDeliveryPrice(String(s.delivery_price));
      setWalkinPrice(String(s.walkin_price));
      setDailyTarget(String(s.daily_target ?? 0));
      setMonthlyTarget(String(s.monthly_target ?? 0));
    }).catch(console.error);
    loadContainers();
  }, []);

  const handleAddContainer = async (label: string) => {
    const trimmed = label.trim();
    if (!trimmed) {
      Alert.alert('Error', 'Please enter a size label.');
      return;
    }
    if (containers.some(c => c.label.toLowerCase() === trimmed.toLowerCase())) {
      Alert.alert('Error', `"${trimmed}" already exists.`);
      return;
    }
    setAddContainerLoading(true);
    try {
      await containerService.addContainerType(trimmed, 0);
      setOtherOpen(false);
      setOtherLabel('');
      loadContainers();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to add container size.');
    } finally {
      setAddContainerLoading(false);
    }
  };

  const handleSaveQty = async (ct: ContainerType) => {
    const draft = qtyDrafts[ct.container_type_id];
    if (draft === undefined) return;
    const qty = parseInt(draft, 10);
    if (isNaN(qty) || qty < 0) {
      Alert.alert('Error', 'Please enter a valid quantity.');
      return;
    }
    if (qty === ct.owned_qty) return;
    setQtySavingId(ct.container_type_id);
    try {
      await containerService.updateOwnedQty(ct.container_type_id, qty);
      loadContainers();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update quantity.');
    } finally {
      setQtySavingId(null);
    }
  };

  const handleToggleContainerActive = (ct: ContainerType) => {
    const label = ct.is_active ? 'Deactivate' : 'Activate';
    Alert.alert(`${label} "${ct.label}"?`, ct.is_active ? 'Past transactions are kept.' : undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: label,
        onPress: async () => {
          try {
            await containerService.setActive(ct.container_type_id, !ct.is_active);
            loadContainers();
          } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to update.');
          }
        },
      },
    ]);
  };

  const handleSavePrices = async () => {
    const dp = parseFloat(deliveryPrice);
    const wp = parseFloat(walkinPrice);
    if (isNaN(dp) || isNaN(wp) || dp <= 0 || wp <= 0) {
      Alert.alert('Error', 'Please enter a valid price.');
      return;
    }
    setPriceLoading(true);
    try {
      await settingsService.updatePrices(dp, wp);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      Alert.alert('✅ Saved', `Prices updated: Delivery ₱${dp} / Walk-in ₱${wp}`);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Save failed');
    } finally {
      setPriceLoading(false);
    }
  };

  const handlePinAction = (action: 'enable' | 'disable' | 'change') => {
    if (action === 'enable') {
      setPinModal('set');
    } else if (action === 'disable') {
      setPinModal('verify-disable');
    } else {
      setPinModal('verify-old');
    }
  };

  const handlePinFlowSuccess = async (pin: string) => {
    if (pinModal === 'set') {
      setPendingPin(pin);
      setPinModal('confirm');
    } else if (pinModal === 'confirm') {
      if (pin !== pendingPin) {
        Alert.alert('Mismatch', 'PINs do not match. Try again.');
        setPinModal('set');
        setPendingPin('');
        return;
      }
      await pinService.setPin(pin);
      setPinEnabled(true);
      setPinModal(null);
      Alert.alert('✅ PIN Set', 'App lock is now enabled.');
    } else if (pinModal === 'verify-old') {
      const ok = await pinService.verify(pin);
      if (!ok) { Alert.alert('Incorrect PIN'); return; }
      setPinModal('set');
    } else if (pinModal === 'verify-disable') {
      const ok = await pinService.verify(pin);
      if (!ok) { Alert.alert('Incorrect PIN'); return; }
      await pinService.disable();
      setPinEnabled(false);
      setPinModal(null);
      Alert.alert('PIN Disabled', 'App lock has been turned off.');
    }
  };

  const handleSaveTargets = async () => {
    const dt = parseFloat(dailyTarget);
    const mt = parseFloat(monthlyTarget);
    if (isNaN(dt) || isNaN(mt) || dt < 0 || mt < 0) {
      Alert.alert('Error', 'Please enter valid target amounts.');
      return;
    }
    setTargetLoading(true);
    try {
      await settingsService.updateTargets(dt, mt);
      setTargetSaved(true);
      setTimeout(() => setTargetSaved(false), 2000);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Save failed');
    } finally {
      setTargetLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>⚙️ Settings</Text>

        {/* Quick navigation cards */}
        <TouchableOpacity style={[styles.navCard, { backgroundColor: '#FFF7E6', borderColor: '#F59E0B40' }]} onPress={() => navigation.navigate('Riders')}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.navCardTitle, { color: '#92400E' }]}>🏍️ Rider Management</Text>
            <Text style={[styles.navCardSub, { color: '#B45309' }]}>Add, edit, stats per month</Text>
          </View>
          <Text style={[styles.navCardArrow, { color: '#B45309' }]}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navCard} onPress={() => navigation.navigate('ContainerSummary')}>
          <View style={{ flex: 1 }}>
            <Text style={styles.navCardTitle}>🪣 Container Inventory</Text>
            <Text style={styles.navCardSub}>Store-wide stock by size</Text>
          </View>
          <Text style={styles.navCardArrow}>›</Text>
        </TouchableOpacity>

        {/* Unit Price */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Unit Price (PHP / Gallon)</Text>
          <Text style={styles.sectionNote}>Changing prices does not affect existing orders.</Text>

          <View style={styles.priceRow}>
            <View style={styles.priceCard}>
              <Text style={styles.priceLabel}>🏍️ Delivery Price</Text>
              <View style={styles.priceInputRow}>
                <Text style={styles.peso}>₱</Text>
                <TextInput
                  style={styles.priceInput}
                  value={deliveryPrice}
                  onChangeText={setDeliveryPrice}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
            <View style={styles.priceCard}>
              <Text style={styles.priceLabel}>🚶 Walk-in Price</Text>
              <View style={styles.priceInputRow}>
                <Text style={styles.peso}>₱</Text>
                <TextInput
                  style={styles.priceInput}
                  value={walkinPrice}
                  onChangeText={setWalkinPrice}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
          </View>

          <TouchableOpacity style={styles.saveBtn} onPress={handleSavePrices} disabled={priceLoading}>
            {priceLoading ? <ActivityIndicator color="#fff" /> : (
              <Text style={styles.saveBtnText}>{saved ? '✅ Saved' : 'Save Prices'}</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Container Management */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🧴 Container Management</Text>
          <Text style={styles.sectionNote}>Manage the container sizes and quantities your store owns.</Text>

          {containersLoading ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginBottom: 12 }} />
          ) : containers.length === 0 ? (
            <Text style={styles.emptyText}>No container sizes registered yet.</Text>
          ) : (
            containers.map(ct => (
              <View key={ct.container_type_id} style={[styles.containerRow, !ct.is_active && styles.containerRowInactive]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.containerLabel}>{ct.label}</Text>
                  {!ct.is_active && <Text style={styles.containerInactiveText}>Inactive</Text>}
                </View>
                <TextInput
                  style={styles.containerQtyInput}
                  value={qtyDrafts[ct.container_type_id] ?? String(ct.owned_qty)}
                  onChangeText={(v) => setQtyDrafts(d => ({ ...d, [ct.container_type_id]: v }))}
                  keyboardType="number-pad"
                  editable={ct.is_active}
                />
                <TouchableOpacity
                  style={styles.containerSaveBtn}
                  onPress={() => handleSaveQty(ct)}
                  disabled={!ct.is_active || qtySavingId === ct.container_type_id}
                >
                  {qtySavingId === ct.container_type_id
                    ? <ActivityIndicator color={COLORS.primary} size="small" />
                    : <Text style={styles.containerSaveBtnText}>Save</Text>
                  }
                </TouchableOpacity>
                <TouchableOpacity style={styles.containerToggleBtn} onPress={() => handleToggleContainerActive(ct)}>
                  <Text style={[styles.containerToggleBtnText, { color: ct.is_active ? COLORS.danger : COLORS.primary }]}>
                    {ct.is_active ? 'Deactivate' : 'Activate'}
                  </Text>
                </TouchableOpacity>
              </View>
            ))
          )}

          <Text style={styles.presetLabel}>Add Size</Text>
          <View style={styles.presetChipRow}>
            {CONTAINER_SIZE_PRESETS.map(size => {
              const exists = containers.some(c => c.label.toLowerCase() === size.toLowerCase());
              return (
                <TouchableOpacity
                  key={size}
                  style={[styles.presetChip, exists && styles.presetChipDisabled]}
                  onPress={() => handleAddContainer(size)}
                  disabled={exists || addContainerLoading}
                >
                  <Text style={[styles.presetChipText, exists && styles.presetChipTextDisabled]}>
                    {exists ? `✓ ${size}` : size}
                  </Text>
                </TouchableOpacity>
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
                style={styles.containerSaveBtn}
                onPress={() => handleAddContainer(otherLabel)}
                disabled={addContainerLoading}
              >
                {addContainerLoading
                  ? <ActivityIndicator color={COLORS.primary} size="small" />
                  : <Text style={styles.containerSaveBtnText}>Add</Text>
                }
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.containerToggleBtn}
                onPress={() => { setOtherOpen(false); setOtherLabel(''); }}
              >
                <Text style={styles.containerToggleBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* App Lock (PIN) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔐 App Lock (PIN)</Text>
          <Text style={styles.sectionNote}>Require a 4-digit PIN to open the app.</Text>

          <View style={styles.pinStatusRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.pinStatusLabel}>
                Status: <Text style={{ color: pinEnabled ? COLORS.primary : COLORS.textMuted, fontWeight: '700' }}>
                  {pinEnabled ? 'Enabled' : 'Disabled'}
                </Text>
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.pinToggleBtn, { backgroundColor: pinEnabled ? '#FCEBEB' : '#E1F5EE' }]}
              onPress={() => handlePinAction(pinEnabled ? 'disable' : 'enable')}
            >
              <Text style={[styles.pinToggleBtnText, { color: pinEnabled ? COLORS.danger : COLORS.primary }]}>
                {pinEnabled ? 'Disable' : 'Enable PIN'}
              </Text>
            </TouchableOpacity>
          </View>

          {pinEnabled && (
            <TouchableOpacity style={styles.changePinBtn} onPress={() => handlePinAction('change')}>
              <Text style={styles.changePinText}>Change PIN</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Sales Targets */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🎯 Sales Targets</Text>
          <Text style={styles.sectionNote}>Set ₱0 to disable a target.</Text>

          <View style={styles.priceRow}>
            <View style={styles.priceCard}>
              <Text style={styles.priceLabel}>Daily Target</Text>
              <View style={styles.priceInputRow}>
                <Text style={styles.peso}>₱</Text>
                <TextInput
                  style={styles.priceInput}
                  value={dailyTarget}
                  onChangeText={setDailyTarget}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
            <View style={styles.priceCard}>
              <Text style={styles.priceLabel}>Monthly Target</Text>
              <View style={styles.priceInputRow}>
                <Text style={styles.peso}>₱</Text>
                <TextInput
                  style={styles.priceInput}
                  value={monthlyTarget}
                  onChangeText={setMonthlyTarget}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
          </View>

          <TouchableOpacity style={styles.saveBtn} onPress={handleSaveTargets} disabled={targetLoading}>
            {targetLoading ? <ActivityIndicator color="#fff" /> : (
              <Text style={styles.saveBtnText}>{targetSaved ? '✅ Saved' : 'Save Targets'}</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Notifications */}
        <NotificationSettings />

        {/* Logout */}
        {onLogout && (
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: COLORS.danger, marginBottom: 0 }]}
            onPress={() => {
              Alert.alert('Logout', 'Are you sure you want to logout?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Logout', style: 'destructive', onPress: onLogout },
              ]);
            }}
          >
            <Text style={styles.saveBtnText}>Logout</Text>
          </TouchableOpacity>
        )}

        {/* App Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App Info</Text>
          <View style={styles.infoRow}><Text style={styles.infoKey}>App Name</Text><Text style={styles.infoVal}>Purefect Water Station</Text></View>
          <View style={styles.infoRow}><Text style={styles.infoKey}>Version</Text><Text style={styles.infoVal}>v1.1.0</Text></View>
          <View style={styles.infoRow}><Text style={styles.infoKey}>Platform</Text><Text style={styles.infoVal}>iOS / Android</Text></View>
          <View style={styles.infoRow}><Text style={styles.infoKey}>Database</Text><Text style={styles.infoVal}>MariaDB</Text></View>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>

      {/* PIN flow — full-screen modal */}
      <Modal
        visible={pinModal !== null}
        animationType="slide"
        onRequestClose={() => { setPinModal(null); setPendingPin(''); }}
      >
        {pinModal && (
          <PinLockScreen
            mode={pinModal === 'confirm' ? 'confirm' : pinModal === 'verify-disable' || pinModal === 'verify-old' ? 'verify-old' : 'set'}
            title={
              pinModal === 'set' ? 'Set New PIN'
              : pinModal === 'confirm' ? 'Confirm New PIN'
              : pinModal === 'verify-old' ? 'Enter Current PIN'
              : 'Enter PIN to Disable'
            }
            onSuccess={handlePinFlowSuccess}
            onCancel={() => { setPinModal(null); setPendingPin(''); }}
          />
        )}
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  container: { flex: 1, padding: 16 },
  title: { fontSize: 22, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 20 },
  section: { backgroundColor: COLORS.surface, borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 4 },
  sectionNote: { fontSize: 12, color: COLORS.textMuted, marginBottom: 16 },
  priceRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  priceCard: { flex: 1, backgroundColor: COLORS.background, borderRadius: 10, padding: 12 },
  priceLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 8 },
  priceInputRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  peso: { fontSize: 18, fontWeight: '700', color: COLORS.textSecondary },
  priceInput: {
    flex: 1, fontSize: 24, fontWeight: '700', color: COLORS.primary,
    borderBottomWidth: 2, borderBottomColor: COLORS.primary, paddingVertical: 4,
  },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: 12, padding: 14, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  emptyText: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', paddingVertical: 12 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.background },
  infoKey: { fontSize: 13, color: COLORS.textSecondary },
  infoVal: { fontSize: 13, color: COLORS.textPrimary, fontWeight: '500' },
  pinStatusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  pinStatusLabel: { fontSize: 14, color: COLORS.textSecondary },
  pinToggleBtn: { borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  pinToggleBtnText: { fontSize: 13, fontWeight: '700' },
  changePinBtn: { borderWidth: 1, borderColor: COLORS.primary, borderRadius: 8, padding: 10, alignItems: 'center' },
  changePinText: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  navCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#E1F5EE', borderRadius: 14, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: COLORS.primary + '40',
  },
  navCardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.primaryDark },
  navCardSub: { fontSize: 12, color: COLORS.primary, marginTop: 2 },
  navCardArrow: { fontSize: 24, color: COLORS.primary, fontWeight: '700' },
  containerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.background,
  },
  containerRowInactive: { opacity: 0.5 },
  containerLabel: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  containerInactiveText: { fontSize: 11, color: COLORS.textMuted, marginTop: 1 },
  containerQtyInput: {
    width: 60, fontSize: 15, fontWeight: '700', color: COLORS.textPrimary,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 8,
    paddingVertical: 6, paddingHorizontal: 8, textAlign: 'center',
    backgroundColor: COLORS.background,
  },
  containerSaveBtn: {
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: '#E1F5EE',
  },
  containerSaveBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  containerToggleBtn: { paddingHorizontal: 8, paddingVertical: 8 },
  containerToggleBtnText: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  containerAddRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  containerAddInput: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 8,
    paddingVertical: 8, paddingHorizontal: 10, fontSize: 14, color: COLORS.textPrimary,
    backgroundColor: COLORS.background,
  },
  presetLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, marginTop: 14, marginBottom: 8 },
  presetChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  presetChip: {
    borderWidth: 1, borderColor: COLORS.primary, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8, backgroundColor: COLORS.background,
  },
  presetChipActive: { backgroundColor: '#E1F5EE' },
  presetChipDisabled: { borderColor: COLORS.border, backgroundColor: COLORS.background },
  presetChipText: { fontSize: 13, fontWeight: '600', color: COLORS.primary },
  presetChipTextActive: { color: COLORS.primaryDark },
  presetChipTextDisabled: { color: COLORS.textMuted },
});
