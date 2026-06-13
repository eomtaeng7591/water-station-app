/**
 * OfflineBanner
 * 화면 상단에 고정되는 네트워크 상태 배너
 * - 오프라인: 빨간 배너 + 대기 주문 수
 * - 동기화 중: 노란 배너 + 스피너
 * - 동기화 완료: 초록 배너 (2초 후 사라짐)
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Animated } from 'react-native';
import { COLORS } from '../constants';

interface Props {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncResult: { synced: number; failed: number } | null;
}

export default function OfflineBanner({ isOnline, isSyncing, pendingCount, lastSyncResult }: Props) {
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (lastSyncResult && lastSyncResult.synced > 0) {
      setShowSuccess(true);
      const t = setTimeout(() => setShowSuccess(false), 2500);
      return () => clearTimeout(t);
    }
  }, [lastSyncResult]);

  if (isOnline && !isSyncing && !showSuccess && pendingCount === 0) return null;

  let bg = COLORS.danger;
  let message = `오프라인 모드 · 대기 주문 ${pendingCount}건`;

  if (isSyncing) {
    bg = COLORS.accent;
    message = `동기화 중... (${pendingCount}건 업로드)`;
  } else if (showSuccess) {
    bg = COLORS.primary;
    message = `✅ ${lastSyncResult?.synced}건 동기화 완료`;
  } else if (isOnline && pendingCount > 0) {
    bg = COLORS.accentLight;
    message = `대기 주문 ${pendingCount}건 · 동기화 준비 중`;
  }

  return (
    <View style={[styles.banner, { backgroundColor: bg }]}>
      {isSyncing && <ActivityIndicator color="#fff" size="small" style={{ marginRight: 8 }} />}
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  text: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});
