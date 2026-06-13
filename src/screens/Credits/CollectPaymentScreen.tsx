import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { creditService } from '../../services/creditService';
import { COLORS } from '../../constants';

export default function CollectPaymentScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { creditId, customerName, remaining, onDone } = route.params;

  const [amount, setAmount] = useState(String(remaining));
  const [loading, setLoading] = useState(false);

  const handleCollect = async () => {
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) {
      Alert.alert('Error', 'Please enter a valid amount.');
      return;
    }
    if (num > remaining) {
      Alert.alert('Error', `Cannot collect more than balance (₱${Number(remaining).toLocaleString()}).`);
      return;
    }
    setLoading(true);
    try {
      await creditService.collectPayment(creditId, num);
      const isFullyPaid = num >= remaining;
      Alert.alert(
        isFullyPaid ? '✅ Fully Paid' : 'Payment Collected',
        `₱${num.toLocaleString()} collected successfully.`,
        [{ text: 'OK', onPress: () => { onDone?.(); navigation.goBack(); } }]
      );
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Collection failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>✕</Text></TouchableOpacity>
          <Text style={styles.title}>Collect Payment</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.content}>
          <Text style={styles.customerName}>{customerName}</Text>
          <Text style={styles.remainingLabel}>Outstanding Balance</Text>
          <Text style={styles.remainingValue}>₱{Number(remaining).toLocaleString()}</Text>

          <Text style={styles.label}>Amount to Collect</Text>
          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            autoFocus
          />

          <TouchableOpacity
            style={styles.fullBtn}
            onPress={() => setAmount(String(remaining))}
          >
            <Text style={styles.fullBtnText}>Full Payment ₱{Number(remaining).toLocaleString()}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.saveBtn} onPress={handleCollect} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Confirm Payment</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  back: { fontSize: 20, color: COLORS.textSecondary },
  title: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary },
  content: { padding: 24 },
  customerName: { fontSize: 22, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 8 },
  remainingLabel: { fontSize: 13, color: COLORS.textSecondary },
  remainingValue: { fontSize: 32, fontWeight: '700', color: COLORS.danger, marginBottom: 28 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 8 },
  input: {
    backgroundColor: COLORS.surface, borderWidth: 2, borderColor: COLORS.primary,
    borderRadius: 12, padding: 16, fontSize: 24, fontWeight: '700',
    color: COLORS.textPrimary, textAlign: 'center', marginBottom: 12,
  },
  fullBtn: {
    borderWidth: 1, borderColor: COLORS.primary, borderRadius: 10,
    padding: 12, alignItems: 'center', marginBottom: 20,
  },
  fullBtnText: { color: COLORS.primary, fontWeight: '600' },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: 14, padding: 18, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
