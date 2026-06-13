/**
 * useOrderSubmit
 * 주문 저장 시 온라인/오프라인 분기 처리
 * - 온라인: Supabase 직접 저장
 * - 오프라인: SQLite 큐에 저장 → 나중에 자동 동기화
 */
import { useCallback, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { orderService } from '../services/orderService';
import { enqueueOrder } from '../services/offlineDB';
import { Order, OrderInput } from '../types';

export function useOrderSubmit() {
  const [loading, setLoading] = useState(false);

  const submit = useCallback(async (input: OrderInput): Promise<{ offline: boolean; order?: Order }> => {
    setLoading(true);
    try {
      const net = await NetInfo.fetch();
      if (net.isConnected) {
        const order = await orderService.createOrder(input);
        return { offline: false, order };
      } else {
        await enqueueOrder(input);
        return { offline: true };
      }
    } finally {
      setLoading(false);
    }
  }, []);

  return { submit, loading };
}
