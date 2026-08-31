import React, { useEffect, useState } from 'react';
import {
  View, Text, Switch, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  requestNotificationPermission,
  scheduleDailyReport,
  cancelDailyReport,
  sendTestNotification,
} from '../../services/notificationService';
import { COLORS } from '../../constants';

const PREF_DAILY = 'notif_daily_enabled';

export default function NotificationSettings() {
  const [hasPermission, setHasPermission] = useState(false);
  const [dailyEnabled, setDailyEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadPrefs();
  }, []);

  const loadPrefs = async () => {
    const d = await AsyncStorage.getItem(PREF_DAILY);
    setDailyEnabled(d === 'true');

    const ok = await requestNotificationPermission();
    setHasPermission(ok);
  };

  const handleRequestPermission = async () => {
    const ok = await requestNotificationPermission();
    setHasPermission(ok);
    if (!ok) Alert.alert('Permission Required', 'Please enable notifications in Settings > Notifications.');
  };

  const toggleDaily = async (val: boolean) => {
    if (val && !hasPermission) { handleRequestPermission(); return; }
    setLoading(true);
    try {
      if (val) await scheduleDailyReport();
      else await cancelDailyReport();
      setDailyEnabled(val);
      await AsyncStorage.setItem(PREF_DAILY, String(val));
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    if (!hasPermission) { handleRequestPermission(); return; }
    await sendTestNotification();
    Alert.alert('📳', 'Test notification in 1 second!');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>🔔 Notifications</Text>

      {!hasPermission ? (
        <TouchableOpacity style={styles.permBanner} onPress={handleRequestPermission}>
          <Text style={styles.permText}>No notification permission. Tap to allow →</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.permOk}>
          <Text style={styles.permOkText}>✅ Notifications Allowed</Text>
        </View>
      )}

      {loading && <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 8 }} />}

      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowLabel}>Daily Sales Report</Text>
          <Text style={styles.rowSub}>Daily 9PM · Sales summary reminder</Text>
        </View>
        <Switch
          value={dailyEnabled}
          onValueChange={toggleDaily}
          trackColor={{ true: COLORS.primary }}
          disabled={loading}
        />
      </View>

      <TouchableOpacity style={styles.testBtn} onPress={handleTest}>
        <Text style={styles.testBtnText}>Send Test Notification</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: COLORS.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: COLORS.border, marginBottom: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 12 },
  permBanner: { backgroundColor: '#FAEEDA', borderRadius: 8, padding: 10, marginBottom: 12 },
  permText: { color: COLORS.accentLight, fontWeight: '600', fontSize: 13 },
  permOk: { backgroundColor: '#EAF3DE', borderRadius: 8, padding: 8, marginBottom: 12 },
  permOkText: { color: COLORS.cash, fontSize: 13, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.background },
  rowLabel: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  rowSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  testBtn: { marginTop: 12, borderWidth: 1, borderColor: COLORS.primary, borderRadius: 10, padding: 12, alignItems: 'center' },
  testBtnText: { color: COLORS.primary, fontWeight: '600', fontSize: 14 },
});
