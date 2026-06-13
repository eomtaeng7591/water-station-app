import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
  SafeAreaView, Dimensions,
} from 'react-native';
import { COLORS } from '../../constants';

const { height: SCREEN_H } = Dimensions.get('window');

interface Props {
  mode: 'unlock' | 'set' | 'confirm' | 'verify-old';
  title?: string;
  subtitle?: string;
  onSuccess: (pin: string) => void;
  onCancel?: () => void;
}

const ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['',  '0', '⌫'],
];

export default function PinLockScreen({ mode, title, subtitle, onSuccess, onCancel }: Props) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const defaultTitle = mode === 'unlock' ? 'Enter PIN'
    : mode === 'set' ? 'Set New PIN'
    : mode === 'confirm' ? 'Confirm PIN'
    : 'Enter Current PIN';

  useEffect(() => {
    if (pin.length === 4) {
      onSuccess(pin);
      // reset immediately so parent can re-render with key if needed
      setTimeout(() => setPin(''), 100);
    }
  }, [pin]);

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10,  duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6,   duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6,  duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,   duration: 55, useNativeDriver: true }),
    ]).start();
  };

  // Called by parent after wrong PIN
  useEffect(() => {
    if (subtitle?.includes('Incorrect')) {
      shake();
    }
  }, [subtitle]);

  const handleKey = (key: string) => {
    if (key === '⌫') {
      setPin(p => p.slice(0, -1));
      return;
    }
    if (key === '') return;
    setPin(p => p.length < 4 ? p + key : p);
  };

  // Compact key size based on screen height
  const keySize = SCREEN_H < 700 ? 64 : 72;
  const keyGap  = SCREEN_H < 700 ? 10 : 14;

  return (
    <SafeAreaView style={styles.safe}>
      {onCancel && (
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      )}

      <View style={styles.top}>
        <Text style={styles.lockIcon}>🔐</Text>
        <Text style={styles.title}>{title ?? defaultTitle}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>

      <Animated.View style={[styles.dots, { transform: [{ translateX: shakeAnim }] }]}>
        {[0, 1, 2, 3].map(i => (
          <View key={i} style={[styles.dot, pin.length > i && styles.dotFilled]} />
        ))}
      </Animated.View>

      <View style={[styles.pad, { gap: keyGap }]}>
        {ROWS.map((row, ri) => (
          <View key={ri} style={[styles.row, { gap: keyGap }]}>
            {row.map((key, ki) => (
              <TouchableOpacity
                key={ki}
                style={[
                  styles.key,
                  { width: keySize, height: keySize, borderRadius: keySize / 2 },
                  key === '' && styles.keyEmpty,
                ]}
                onPress={() => handleKey(key)}
                disabled={key === ''}
                activeOpacity={0.55}
              >
                <Text style={[styles.keyText, key === '⌫' && { fontSize: 22 }]}>{key}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1, backgroundColor: COLORS.background,
    alignItems: 'center', justifyContent: 'space-evenly',
  },
  cancelBtn: { alignSelf: 'flex-end', paddingHorizontal: 24, paddingVertical: 8 },
  cancelText: { fontSize: 16, color: COLORS.primary },
  top: { alignItems: 'center', gap: 8 },
  lockIcon: { fontSize: 48, marginBottom: 4 },
  title: { fontSize: 22, fontWeight: '700', color: COLORS.textPrimary },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', paddingHorizontal: 32 },
  errorText: { fontSize: 14, color: COLORS.danger, fontWeight: '600' },
  dots: { flexDirection: 'row', gap: 20 },
  dot: {
    width: 16, height: 16, borderRadius: 8,
    borderWidth: 2, borderColor: COLORS.primary,
    backgroundColor: 'transparent',
  },
  dotFilled: { backgroundColor: COLORS.primary },
  pad: { alignItems: 'center' },
  row: { flexDirection: 'row' },
  key: {
    backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  keyEmpty: { backgroundColor: 'transparent', borderColor: 'transparent' },
  keyText: { fontSize: 22, fontWeight: '600', color: COLORS.textPrimary },
});
