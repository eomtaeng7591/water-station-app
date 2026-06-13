/**
 * useOfflineSync
 * - 앱 시작 시 DB 초기화
 * - 네트워크 상태 실시간 감지
 * - 온라인 복구 순간 자동 동기화 실행
 * - 배너 표시용 상태 노출
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import NetInfo from '@react-native-community/netinfo';
import {
  initOfflineDB,
  syncPendingOrders,
  getPendingCount,
} from '../services/offlineDB';

interface SyncState {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  lastSyncResult: { synced: number; failed: number } | null;
}

export function useOfflineSync() {
  const [state, setState] = useState<SyncState>({
    isOnline: true,
    pendingCount: 0,
    isSyncing: false,
    lastSyncResult: null,
  });

  const wasOffline = useRef(false);
  const initialized = useRef(false);

  const refreshPendingCount = useCallback(async () => {
    const cnt = await getPendingCount();
    setState(s => ({ ...s, pendingCount: cnt }));
  }, []);

  const runSync = useCallback(async () => {
    setState(s => ({ ...s, isSyncing: true }));
    try {
      const result = await syncPendingOrders();
      await refreshPendingCount();
      setState(s => ({ ...s, isSyncing: false, lastSyncResult: result }));
      return result;
    } catch {
      setState(s => ({ ...s, isSyncing: false }));
      return { synced: 0, failed: 0 };
    }
  }, [refreshPendingCount]);

  useEffect(() => {
    // 초기화
    if (!initialized.current) {
      initialized.current = true;
      initOfflineDB().then(refreshPendingCount);
    }

    // 네트워크 감지
    const unsub = NetInfo.addEventListener(netState => {
      const online = !!netState.isConnected;
      setState(s => ({ ...s, isOnline: online }));

      if (online && wasOffline.current) {
        // 오프라인 → 온라인 전환 시 자동 동기화
        wasOffline.current = false;
        runSync();
      } else if (!online) {
        wasOffline.current = true;
      }
    });

    return () => unsub();
  }, [runSync, refreshPendingCount]);

  return { ...state, runSync, refreshPendingCount };
}
