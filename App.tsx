import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AppNavigator from './src/navigation/AppNavigator';
import OfflineBanner from './src/components/OfflineBanner';
import { useOfflineSync } from './src/hooks/useOfflineSync';
import {
  requestNotificationPermission,
  setupNotificationListeners,
  scheduleDailyReport,
} from './src/services/notificationService';

function AppWithOffline() {
  const { isOnline, isSyncing, pendingCount, lastSyncResult } = useOfflineSync();

  useEffect(() => {
    // 앱 시작 시 알림 권한 요청 + 일간 리포트 예약
    requestNotificationPermission().then(granted => {
      if (granted) scheduleDailyReport();
    });

    // 알림 수신 리스너 등록
    const cleanup = setupNotificationListeners(
      notification => console.log('알림 수신:', notification.request.content.title),
      response => console.log('알림 탭:', response.notification.request.content.data?.type)
    );

    return cleanup;
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <OfflineBanner
        isOnline={isOnline}
        isSyncing={isSyncing}
        pendingCount={pendingCount}
        lastSyncResult={lastSyncResult}
      />
      <AppNavigator />
    </View>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="dark" />
      <AppWithOffline />
    </GestureHandlerRootView>
  );
}
