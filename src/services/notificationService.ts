import { Platform } from 'react-native';
import type { DailyTriggerInput, TimeIntervalTriggerInput } from 'expo-notifications';

const isNative = Platform.OS !== 'web';
let Notifications: typeof import('expo-notifications') | null = null;
let Device: typeof import('expo-device') | null = null;

if (isNative) {
  Notifications = require('expo-notifications');
  Device = require('expo-device');

  Notifications!.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNative || !Device || !Notifications) return false;
  if (!Device.isDevice) {
    console.warn('Push notifications only work on physical devices.');
    return false;
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return false;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('orders', {
      name: 'Order Notifications',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#1D9E75',
    });
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
    await Notifications.setNotificationChannelAsync('daily_report', {
      name: 'Daily Report',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  return true;
}

export async function notifyDeliveryPending(customerName: string, quantity: number): Promise<void> {
  if (!isNative || !Notifications) return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🏍️ Delivery Order Received',
      body: `${customerName} · ${quantity} gal pending delivery`,
      data: { type: 'delivery_pending' },
      ...(Platform.OS === 'android' && { channelId: 'orders' }),
    },
    trigger: null,
  });
}

export async function notifyDeliveryCompleted(customerName: string, amount: number): Promise<void> {
  if (!isNative || !Notifications) return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '✅ Delivery Completed',
      body: `${customerName} · ₱${amount.toLocaleString()} collected`,
      data: { type: 'delivery_completed' },
      ...(Platform.OS === 'android' && { channelId: 'orders' }),
    },
    trigger: null,
  });
}

export async function scheduleUtangReminder(unpaidCount: number, totalAmount: number): Promise<string> {
  if (!isNative || !Notifications) return '';
  await cancelUtangReminder();

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: '💳 Outstanding Credit Reminder',
      body: `${unpaidCount} customers unpaid · Total ₱${totalAmount.toLocaleString()} outstanding`,
      data: { type: 'utang_reminder' },
      ...(Platform.OS === 'android' && { channelId: 'reminders' }),
    },
    trigger: {
      hour: 9,
      minute: 0,
      repeats: true,
    } as DailyTriggerInput,
  });

  return id;
}

export async function cancelUtangReminder(): Promise<void> {
  if (!isNative || !Notifications) return;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const utangNotifs = scheduled.filter(n => n.content.data?.type === 'utang_reminder');
  await Promise.all(utangNotifs.map(n => Notifications!.cancelScheduledNotificationAsync(n.identifier)));
}

export async function scheduleDailyReport(): Promise<string> {
  if (!isNative || !Notifications) return '';
  await cancelDailyReport();

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: '📊 Daily Sales Summary',
      body: "Check today's sales report.",
      data: { type: 'daily_report' },
      ...(Platform.OS === 'android' && { channelId: 'daily_report' }),
    },
    trigger: {
      hour: 21,
      minute: 0,
      repeats: true,
    } as DailyTriggerInput,
  });

  return id;
}

export async function cancelDailyReport(): Promise<void> {
  if (!isNative || !Notifications) return;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const reports = scheduled.filter(n => n.content.data?.type === 'daily_report');
  await Promise.all(reports.map(n => Notifications!.cancelScheduledNotificationAsync(n.identifier)));
}

export async function sendTestNotification(): Promise<void> {
  if (!isNative || !Notifications) return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🔔 Notification Test',
      body: 'Purefect notifications are working!',
    },
    trigger: { seconds: 1 } as TimeIntervalTriggerInput,
  });
}

export function setupNotificationListeners(
  onReceive?: (notification: any) => void,
  onResponse?: (response: any) => void
) {
  if (!isNative || !Notifications) return () => {};

  const receiveSubscription = Notifications.addNotificationReceivedListener(
    notification => onReceive?.(notification)
  );
  const responseSubscription = Notifications.addNotificationResponseReceivedListener(
    response => onResponse?.(response)
  );

  return () => {
    receiveSubscription.remove();
    responseSubscription.remove();
  };
}
