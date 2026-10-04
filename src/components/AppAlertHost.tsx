import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { registerAlertListener, AlertButtonConfig } from '../utils/alert';
import { COLORS } from '../constants';

interface AlertState {
  title: string;
  message?: string;
  buttons: AlertButtonConfig[];
}

export default function AppAlertHost() {
  const [alert, setAlert] = useState<AlertState | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    registerAlertListener((title, message, buttons) => setAlert({ title, message, buttons }));
    return () => registerAlertListener(null);
  }, []);

  if (Platform.OS !== 'web' || !alert) return null;

  const handlePress = (btn: AlertButtonConfig) => {
    setAlert(null);
    btn.onPress?.();
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => setAlert(null)}>
      <View style={styles.overlay}>
        <View style={styles.box}>
          <Text style={styles.title}>{alert.title}</Text>
          {!!alert.message && <Text style={styles.message}>{alert.message}</Text>}
          <View style={styles.buttonColumn}>
            {alert.buttons.map((btn, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.button, i > 0 && styles.buttonBorder]}
                onPress={() => handlePress(btn)}
              >
                <Text style={[
                  styles.buttonText,
                  btn.style === 'cancel' && styles.cancelText,
                  btn.style === 'destructive' && styles.destructiveText,
                ]}>
                  {btn.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  box: { backgroundColor: '#fff', borderRadius: 14, padding: 20, width: '100%', maxWidth: 320 },
  title: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 6, textAlign: 'center' },
  message: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 16, lineHeight: 20 },
  buttonColumn: { marginTop: 8 },
  button: { paddingVertical: 12, alignItems: 'center' },
  buttonBorder: { borderTopWidth: 1, borderTopColor: COLORS.border },
  buttonText: { fontSize: 15, fontWeight: '600', color: COLORS.primary },
  cancelText: { color: COLORS.textSecondary, fontWeight: '500' },
  destructiveText: { color: COLORS.danger },
});
