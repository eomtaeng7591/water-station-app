import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { OrderInput } from '../types';

const QUEUE_KEY = '@offline_order_queue';

type QueuedOrder = OrderInput & { _id: string; _queued_at: string };

export const offlineQueueService = {
  async enqueue(order: OrderInput): Promise<void> {
    const queue = await this.getQueue();
    const item: QueuedOrder = {
      ...order,
      _id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      _queued_at: new Date().toISOString(),
    };
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify([...queue, item]));
  },

  async getQueue(): Promise<QueuedOrder[]> {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  },

  async getCount(): Promise<number> {
    return (await this.getQueue()).length;
  },

  async sync(createOrderFn: (order: OrderInput) => Promise<any>): Promise<number> {
    const queue = await this.getQueue();
    if (queue.length === 0) return 0;

    let synced = 0;
    const failed: QueuedOrder[] = [];

    for (const { _id, _queued_at, ...order } of queue) {
      try {
        await createOrderFn(order);
        synced++;
      } catch {
        failed.push({ ...order, _id, _queued_at });
      }
    }

    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(failed));
    return synced;
  },

  async isOnline(): Promise<boolean> {
    const state = await NetInfo.fetch();
    return state.isConnected === true && state.isInternetReachable !== false;
  },
};
