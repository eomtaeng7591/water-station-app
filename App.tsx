import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import {
  requestNotificationPermission,
  setupNotificationListeners,
  scheduleDailyReport,
} from './src/services/notificationService';

export default function App() {
  useEffect(() => {
    requestNotificationPermission().then(granted => {
      if (granted) scheduleDailyReport();
    });
    const cleanup = setupNotificationListeners(
      notification => console.log('알림 수신:', notification.request.content.title),
      response => console.log('알림 탭:', response.notification.request.content.data?.type)
    );
    return cleanup;
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <AppNavigator />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
