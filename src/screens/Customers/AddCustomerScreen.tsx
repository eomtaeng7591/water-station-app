import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { customerService } from '../../services/customerService';
import { Customer } from '../../types';
import { COLORS } from '../../constants';

const PRESET_TAGS = ['Walk-in', 'Delivery', 'Bulk Buyer', 'Credit OK', 'No Credit', 'VIP', 'Wholesale', 'Refill Only'];

export default function AddCustomerScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const editCustomer: Customer | undefined = route.params?.customer;
  const isEdit = !!editCustomer;

  const [name, setName] = useState(editCustomer?.customer_name ?? '');
  const [phone, setPhone] = useState(editCustomer?.phone_number ?? '');
  const [address, setAddress] = useState(editCustomer?.address ?? '');
  const [notes, setNotes] = useState(editCustomer?.notes ?? '');
  const [tags, setTags] = useState<string[]>(editCustomer?.tags ?? []);
  const [loading, setLoading] = useState(false);

  const toggleTag = (tag: string) => {
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const handleSave = async () => {
    if (!name.trim() || !phone.trim() || !address.trim()) {
      Alert.alert('Input Error', 'Please fill in name, phone, and address.');
      return;
    }
    setLoading(true);
    try {
      if (isEdit) {
        await customerService.updateCustomer(editCustomer!.customer_id, {
          customer_name: name.trim(),
          phone_number: phone.trim(),
          address: address.trim(),
          notes: notes.trim() || undefined,
          tags,
        });
        Alert.alert('✅ Updated', `${name} has been updated.`, [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        await customerService.createCustomer(name.trim(), phone.trim(), address.trim(), notes.trim() || undefined, tags);
        Alert.alert('✅ Registered', `${name} has been registered.`, [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || (isEdit ? 'Failed to update' : 'Failed to register'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>‹ Back</Text></TouchableOpacity>
          <Text style={styles.title}>{isEdit ? 'Edit Customer' : 'New Customer'}</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView style={styles.form} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Name *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Customer Name"
            placeholderTextColor={COLORS.textMuted}
          />

          <Text style={styles.label}>Phone * <Text style={styles.hint}>(unique)</Text></Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="09XX-XXX-XXXX"
            placeholderTextColor={COLORS.textMuted}
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>Address *</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={address}
            onChangeText={setAddress}
            placeholder="Enter delivery address"
            placeholderTextColor={COLORS.textMuted}
            multiline
            numberOfLines={3}
          />

          <Text style={styles.label}>Tags <Text style={styles.hint}>(optional)</Text></Text>
          <View style={styles.tagGrid}>
            {PRESET_TAGS.map(tag => (
              <TouchableOpacity
                key={tag}
                style={[styles.tagChip, tags.includes(tag) && styles.tagChipActive]}
                onPress={() => toggleTag(tag)}
              >
                <Text style={[styles.tagChipText, tags.includes(tag) && styles.tagChipTextActive]}>
                  {tags.includes(tag) ? '✓ ' : ''}{tag}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Memo <Text style={styles.hint}>(optional)</Text></Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Special instructions, preferences, etc."
            placeholderTextColor={COLORS.textMuted}
            multiline
            numberOfLines={4}
          />

          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.saveBtnText}>{isEdit ? 'Save Changes' : 'Register'}</Text>
            }
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  back: { fontSize: 16, color: COLORS.primary },
  title: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary },
  form: { padding: 20 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6, marginTop: 16 },
  hint: { fontWeight: '400', color: COLORS.textMuted },
  input: {
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 10, padding: 14, fontSize: 15, color: COLORS.textPrimary,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  notesInput: { minHeight: 100, textAlignVertical: 'top' },
  tagGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagChip: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6, backgroundColor: COLORS.surface,
  },
  tagChipActive: { borderColor: COLORS.primary, backgroundColor: '#E1F5EE' },
  tagChipText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
  tagChipTextActive: { color: COLORS.primary, fontWeight: '700' },
  saveBtn: {
    backgroundColor: COLORS.primary, borderRadius: 12, padding: 16,
    alignItems: 'center', marginTop: 32, marginBottom: 40,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
