import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { riderService } from '../../services/riderService';
import { api } from '../../services/apiClient';
import { Rider, RiderStat } from '../../types';
import { COLORS } from '../../constants';

type ModalMode = 'add' | 'edit';

const now = new Date();

export default function RidersScreen() {
  const navigation = useNavigation<any>();

  const [riders, setRiders] = useState<Rider[]>([]);
  const [loadingRiders, setLoadingRiders] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [statsYear, setStatsYear] = useState(now.getFullYear());
  const [statsMonth, setStatsMonth] = useState(now.getMonth() + 1);
  const [riderStats, setRiderStats] = useState<RiderStat[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);

  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('add');
  const [editRider, setEditRider] = useState<Rider | null>(null);
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  const loadRiders = useCallback(async () => {
    try {
      const data = await riderService.getAllRiders();
      setRiders(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingRiders(false);
    }
  }, []);

  const loadStats = useCallback(async (year: number, month: number) => {
    setLoadingStats(true);
    try {
      const monthStr = `${year}-${String(month).padStart(2, '0')}`;
      const data = await api.get<RiderStat[]>(`/reports/riders?month=${monthStr}`);
      setRiderStats(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => { loadRiders(); }, [loadRiders]);
  useEffect(() => { loadStats(statsYear, statsMonth); }, [statsYear, statsMonth, loadStats]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadRiders(), loadStats(statsYear, statsMonth)]);
    setRefreshing(false);
  };

  const shiftMonth = (delta: number) => {
    let m = statsMonth + delta;
    let y = statsYear;
    if (m > 12) { m = 1; y++; }
    if (m < 1) { m = 12; y--; }
    setStatsMonth(m);
    setStatsYear(y);
  };

  const openAdd = () => {
    setModalMode('add');
    setEditRider(null);
    setFormName('');
    setFormPhone('');
    setModalVisible(true);
  };

  const openEdit = (rider: Rider) => {
    setModalMode('edit');
    setEditRider(rider);
    setFormName(rider.rider_name);
    setFormPhone(rider.phone_number ?? '');
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      Alert.alert('Error', 'Please enter rider name.');
      return;
    }
    setFormLoading(true);
    try {
      if (modalMode === 'add') {
        await riderService.createRider(formName.trim(), formPhone.trim() || undefined);
      } else if (editRider) {
        await riderService.updateRider(editRider.rider_id, {
          rider_name: formName.trim(),
          phone_number: formPhone.trim() || undefined,
        });
      }
      setModalVisible(false);
      await loadRiders();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save');
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggle = (rider: Rider) => {
    const label = rider.is_active ? 'Deactivate' : 'Activate';
    Alert.alert(`${label} Rider`, `${label} ${rider.rider_name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: label, onPress: async () => {
          await riderService.toggleActive(rider.rider_id, !rider.is_active);
          loadRiders();
        },
      },
    ]);
  };

  const handleDelete = (rider: Rider) => {
    Alert.alert('Delete Rider', `Delete ${rider.rider_name}?\nAssigned deliveries will be unassigned.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await riderService.deleteRider(rider.rider_id);
            loadRiders();
          } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to delete');
          }
        },
      },
    ]);
  };

  const statForRider = (riderId: number) =>
    riderStats.find(s => s.rider_id === riderId);

  const totalDeliveries = riderStats.reduce((s, r) => s + r.delivery_count, 0);
  const totalCompleted = riderStats.reduce((s, r) => s + r.completed_count, 0);
  const totalRevenue = riderStats.reduce((s, r) => s + Number(r.delivery_total), 0);
  const isAtCurrentMonth = statsYear === now.getFullYear() && statsMonth === now.getMonth() + 1;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>🏍️ Riders</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {/* Monthly stats summary */}
        <View style={styles.statsCard}>
          <View style={styles.statsMonthRow}>
            <TouchableOpacity onPress={() => shiftMonth(-1)} style={styles.arrowBtn}>
              <Text style={styles.arrowText}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.statsMonthLabel}>
              {new Date(statsYear, statsMonth - 1, 1).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
            </Text>
            <TouchableOpacity
              onPress={() => shiftMonth(1)}
              style={styles.arrowBtn}
              disabled={isAtCurrentMonth}
            >
              <Text style={[styles.arrowText, isAtCurrentMonth && { opacity: 0.3 }]}>›</Text>
            </TouchableOpacity>
          </View>

          {loadingStats ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 12 }} />
          ) : (
            <>
              <View style={styles.summaryRow}>
                <View style={styles.summaryBox}>
                  <Text style={styles.summaryLabel}>Deliveries</Text>
                  <Text style={[styles.summaryVal, { color: COLORS.primary }]}>{totalDeliveries}</Text>
                </View>
                <View style={styles.summaryBox}>
                  <Text style={styles.summaryLabel}>Completed</Text>
                  <Text style={[styles.summaryVal, { color: '#15803D' }]}>{totalCompleted}</Text>
                </View>
                <View style={styles.summaryBox}>
                  <Text style={styles.summaryLabel}>Revenue</Text>
                  <Text style={[styles.summaryVal, { color: COLORS.primary }]}>
                    ₱{totalRevenue >= 1000 ? `${(totalRevenue / 1000).toFixed(1)}k` : totalRevenue.toLocaleString()}
                  </Text>
                </View>
                <View style={styles.summaryBox}>
                  <Text style={styles.summaryLabel}>Complete %</Text>
                  <Text style={styles.summaryVal}>
                    {totalDeliveries > 0 ? `${Math.round((totalCompleted / totalDeliveries) * 100)}%` : '-'}
                  </Text>
                </View>
              </View>
            </>
          )}
        </View>

        {/* Rider list */}
        <Text style={styles.sectionLabel}>Rider List ({riders.length})</Text>

        {loadingRiders ? (
          <ActivityIndicator color={COLORS.primary} style={{ margin: 24 }} />
        ) : riders.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No riders registered.</Text>
            <TouchableOpacity style={styles.emptyAddBtn} onPress={openAdd}>
              <Text style={styles.emptyAddBtnText}>+ Add First Rider</Text>
            </TouchableOpacity>
          </View>
        ) : (
          riders.map(rider => {
            const stat = statForRider(rider.rider_id);
            const compRate = stat && stat.delivery_count > 0
              ? Math.round((stat.completed_count / stat.delivery_count) * 100)
              : null;
            return (
              <View key={rider.rider_id} style={[styles.riderCard, !rider.is_active && styles.riderCardInactive]}>
                <View style={styles.riderCardTop}>
                  <View style={[styles.avatar, { backgroundColor: rider.is_active ? '#E1F5EE' : COLORS.border }]}>
                    <Text style={[styles.avatarText, { color: rider.is_active ? COLORS.primaryDark : COLORS.textMuted }]}>
                      {rider.rider_name[0]?.toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.riderInfo}>
                    <View style={styles.riderNameRow}>
                      <Text style={[styles.riderName, !rider.is_active && styles.textMuted]}>
                        {rider.rider_name}
                      </Text>
                      <View style={[styles.statusBadge, { backgroundColor: rider.is_active ? '#E1F5EE' : COLORS.border }]}>
                        <Text style={[styles.statusText, { color: rider.is_active ? COLORS.primary : COLORS.textMuted }]}>
                          {rider.is_active ? '● Active' : '○ Inactive'}
                        </Text>
                      </View>
                    </View>
                    {rider.phone_number ? (
                      <Text style={styles.riderPhone}>{rider.phone_number}</Text>
                    ) : (
                      <Text style={styles.noPhone}>No phone number</Text>
                    )}
                  </View>
                </View>

                {/* This month's stats for this rider */}
                {stat && stat.delivery_count > 0 && (
                  <View style={styles.riderStats}>
                    <View style={styles.riderStatItem}>
                      <Text style={styles.riderStatVal}>{stat.delivery_count}</Text>
                      <Text style={styles.riderStatLabel}>Deliveries</Text>
                    </View>
                    <View style={styles.riderStatItem}>
                      <Text style={[styles.riderStatVal, { color: '#15803D' }]}>{stat.completed_count}</Text>
                      <Text style={styles.riderStatLabel}>Completed</Text>
                    </View>
                    <View style={styles.riderStatItem}>
                      <Text style={[styles.riderStatVal, { color: compRate !== null && compRate >= 80 ? '#15803D' : COLORS.danger }]}>
                        {compRate !== null ? `${compRate}%` : '-'}
                      </Text>
                      <Text style={styles.riderStatLabel}>Done Rate</Text>
                    </View>
                    <View style={styles.riderStatItem}>
                      <Text style={[styles.riderStatVal, { color: COLORS.primary }]}>
                        ₱{Number(stat.delivery_total).toLocaleString()}
                      </Text>
                      <Text style={styles.riderStatLabel}>Revenue</Text>
                    </View>
                  </View>
                )}

                {/* Action buttons */}
                <View style={styles.riderActions}>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => openEdit(rider)}>
                    <Text style={styles.actionBtnText}>✏️ Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { borderColor: rider.is_active ? COLORS.textMuted : COLORS.primary }]}
                    onPress={() => handleToggle(rider)}
                  >
                    <Text style={[styles.actionBtnText, { color: rider.is_active ? COLORS.textMuted : COLORS.primary }]}>
                      {rider.is_active ? 'Deactivate' : 'Activate'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { borderColor: COLORS.danger }]}
                    onPress={() => handleDelete(rider)}
                  >
                    <Text style={[styles.actionBtnText, { color: COLORS.danger }]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}

        {/* Monthly breakdown table */}
        {!loadingStats && riderStats.length > 0 && (
          <View style={styles.tableCard}>
            <Text style={styles.tableTitle}>Monthly Breakdown</Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableCell, { flex: 2 }]}>Rider</Text>
              <Text style={[styles.tableCell, styles.tableCellRight]}>Orders</Text>
              <Text style={[styles.tableCell, styles.tableCellRight]}>Done</Text>
              <Text style={[styles.tableCell, styles.tableCellRight]}>Revenue</Text>
            </View>
            {riderStats.map(r => (
              <View key={r.rider_id} style={styles.tableRow}>
                <View style={{ flex: 2 }}>
                  <Text style={styles.tableRiderName}>{r.rider_name}</Text>
                  {!r.is_active && <Text style={styles.tableInactive}>inactive</Text>}
                </View>
                <Text style={[styles.tableCell, styles.tableCellRight]}>{r.delivery_count}</Text>
                <Text style={[styles.tableCell, styles.tableCellRight]}>{r.completed_count}</Text>
                <Text style={[styles.tableCell, styles.tableCellRight, { color: COLORS.primary }]}>
                  ₱{Number(r.delivery_total).toLocaleString()}
                </Text>
              </View>
            ))}
            <View style={styles.tableTotalRow}>
              <Text style={[styles.tableCell, { flex: 2, fontWeight: '700' }]}>Total</Text>
              <Text style={[styles.tableCell, styles.tableCellRight, { fontWeight: '700' }]}>{totalDeliveries}</Text>
              <Text style={[styles.tableCell, styles.tableCellRight, { fontWeight: '700' }]}>{totalCompleted}</Text>
              <Text style={[styles.tableCell, styles.tableCellRight, { fontWeight: '700', color: COLORS.primary }]}>
                ₱{totalRevenue.toLocaleString()}
              </Text>
            </View>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Add / Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setModalVisible(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.modalSheet}>
            <Text style={styles.modalTitle}>{modalMode === 'add' ? '+ Add Rider' : '✏️ Edit Rider'}</Text>

            <Text style={styles.modalLabel}>Name *</Text>
            <TextInput
              style={styles.modalInput}
              value={formName}
              onChangeText={setFormName}
              placeholder="Rider Name"
              placeholderTextColor={COLORS.textMuted}
              autoFocus
            />

            <Text style={styles.modalLabel}>Phone</Text>
            <TextInput
              style={styles.modalInput}
              value={formPhone}
              onChangeText={setFormPhone}
              placeholder="09XX-XXX-XXXX"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="phone-pad"
            />

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSave} disabled={formLoading}>
                {formLoading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.modalSaveText}>{modalMode === 'add' ? 'Add' : 'Save'}</Text>
                }
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
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
  back: { fontSize: 16, color: COLORS.primary, minWidth: 50 },
  title: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary },
  addBtn: { backgroundColor: COLORS.primary, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  content: { flex: 1, padding: 16 },

  statsCard: {
    backgroundColor: COLORS.surface, borderRadius: 14, padding: 16,
    marginBottom: 20, borderWidth: 1, borderColor: COLORS.border,
  },
  statsMonthRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  arrowBtn: { padding: 4 },
  arrowText: { fontSize: 24, color: COLORS.primary, fontWeight: '700' },
  statsMonthLabel: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  summaryRow: { flexDirection: 'row', gap: 8 },
  summaryBox: {
    flex: 1, backgroundColor: COLORS.background, borderRadius: 10,
    padding: 10, alignItems: 'center',
  },
  summaryLabel: { fontSize: 10, color: COLORS.textMuted, marginBottom: 4 },
  summaryVal: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },

  sectionLabel: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 10 },

  emptyBox: { alignItems: 'center', padding: 32 },
  emptyText: { fontSize: 14, color: COLORS.textMuted, marginBottom: 16 },
  emptyAddBtn: { backgroundColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  emptyAddBtnText: { color: '#fff', fontWeight: '700' },

  riderCard: {
    backgroundColor: COLORS.surface, borderRadius: 14, padding: 14,
    marginBottom: 12, borderWidth: 1, borderColor: COLORS.border,
  },
  riderCardInactive: { opacity: 0.65 },
  riderCardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontWeight: '700' },
  riderInfo: { flex: 1 },
  riderNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  riderName: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  textMuted: { color: COLORS.textMuted },
  statusBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },
  riderPhone: { fontSize: 13, color: COLORS.textSecondary },
  noPhone: { fontSize: 12, color: COLORS.textMuted, fontStyle: 'italic' },

  riderStats: {
    flexDirection: 'row', backgroundColor: COLORS.background,
    borderRadius: 10, padding: 10, marginBottom: 10, gap: 4,
  },
  riderStatItem: { flex: 1, alignItems: 'center' },
  riderStatVal: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  riderStatLabel: { fontSize: 10, color: COLORS.textMuted, marginTop: 2 },

  riderActions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8,
    paddingVertical: 7, alignItems: 'center',
  },
  actionBtnText: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },

  tableCard: {
    backgroundColor: COLORS.surface, borderRadius: 14, padding: 14,
    marginTop: 8, borderWidth: 1, borderColor: COLORS.border,
  },
  tableTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 10 },
  tableHeader: { flexDirection: 'row', paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.background },
  tableTotalRow: { flexDirection: 'row', paddingTop: 8, borderTopWidth: 1, borderTopColor: COLORS.border, marginTop: 2 },
  tableCell: { fontSize: 12, color: COLORS.textSecondary },
  tableCellRight: { flex: 1, textAlign: 'right' },
  tableRiderName: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary },
  tableInactive: { fontSize: 10, color: COLORS.textMuted },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: COLORS.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, paddingBottom: 40,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 20 },
  modalLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6, marginTop: 12 },
  modalInput: {
    backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 10, padding: 14, fontSize: 15, color: COLORS.textPrimary,
  },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 24 },
  modalCancelBtn: {
    flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12,
    padding: 14, alignItems: 'center',
  },
  modalCancelText: { fontSize: 15, color: COLORS.textSecondary, fontWeight: '600' },
  modalSaveBtn: { flex: 1, backgroundColor: COLORS.primary, borderRadius: 12, padding: 14, alignItems: 'center' },
  modalSaveText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
