import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text, ActivityIndicator, View, Alert } from 'react-native';
import { COLORS } from '../constants';
import { authService } from '../services/authService';
import { pinService } from '../services/pinService';
import { useOfflineSync } from '../hooks/useOfflineSync';
import OfflineBanner from '../components/OfflineBanner';

// Screens
import DashboardScreen from '../screens/Dashboard/DashboardScreen';
import OrderScreen from '../screens/Orders/OrderScreen';
import CustomersScreen from '../screens/Customers/CustomersScreen';
import CustomerDetailScreen from '../screens/Customers/CustomerDetailScreen';
import AddCustomerScreen from '../screens/Customers/AddCustomerScreen';
import CreditsScreen from '../screens/Credits/CreditsScreen';
import CollectPaymentScreen from '../screens/Credits/CollectPaymentScreen';
import SettingsScreen from '../screens/Settings/SettingsScreen';
import InventoryScreen from '../screens/Inventory/InventoryScreen';
import RidersScreen from '../screens/Riders/RidersScreen';
import LoginScreen from '../screens/Auth/LoginScreen';
import PinLockScreen from '../screens/Auth/PinLockScreen';

const Tab = createBottomTabNavigator();
const CustomerStack = createNativeStackNavigator();
const CreditStack = createNativeStackNavigator();
const SettingsStack = createNativeStackNavigator();

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Dashboard: '📊', Orders: '🧾', Customers: '👥', Credits: '💳', Settings: '⚙️',
  };
  return (
    <Text style={{ fontSize: focused ? 22 : 20, opacity: focused ? 1 : 0.55 }}>
      {icons[name]}
    </Text>
  );
}

function CustomerStackScreen() {
  return (
    <CustomerStack.Navigator screenOptions={{ headerShown: false }}>
      <CustomerStack.Screen name="CustomersList" component={CustomersScreen} />
      <CustomerStack.Screen name="CustomerDetail" component={CustomerDetailScreen} />
      <CustomerStack.Screen name="AddCustomer" component={AddCustomerScreen} />
    </CustomerStack.Navigator>
  );
}

function CreditStackScreen() {
  return (
    <CreditStack.Navigator screenOptions={{ headerShown: false }}>
      <CreditStack.Screen name="CreditsList" component={CreditsScreen} />
      <CreditStack.Screen name="CollectPayment" component={CollectPaymentScreen} />
    </CreditStack.Navigator>
  );
}

function SettingsStackScreen({ onLogout }: { onLogout: () => void }) {
  return (
    <SettingsStack.Navigator screenOptions={{ headerShown: false }}>
      <SettingsStack.Screen name="SettingsMain">
        {() => <SettingsScreen onLogout={onLogout} />}
      </SettingsStack.Screen>
      <SettingsStack.Screen name="Inventory" component={InventoryScreen} />
      <SettingsStack.Screen name="Riders" component={RidersScreen} />
    </SettingsStack.Navigator>
  );
}

function MainTabs({ onLogout }: { onLogout: () => void }) {
  const { isOnline, isSyncing, pendingCount, lastSyncResult } = useOfflineSync();

  return (
    <View style={{ flex: 1 }}>
      <OfflineBanner
        isOnline={isOnline}
        isSyncing={isSyncing}
        pendingCount={pendingCount}
        lastSyncResult={lastSyncResult}
      />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
          tabBarActiveTintColor: COLORS.primary,
          tabBarInactiveTintColor: COLORS.textMuted,
          tabBarStyle: {
            backgroundColor: COLORS.surface,
            borderTopColor: COLORS.border,
            paddingBottom: 6,
            paddingTop: 6,
            paddingHorizontal: 16,
            height: 62,
          },
          tabBarLabelStyle: { fontSize: 10, fontWeight: '500' },
        })}
      >
        <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Dashboard' }} />
        <Tab.Screen name="Orders" component={OrderScreen} options={{ title: 'Orders' }} />
        <Tab.Screen name="Customers" component={CustomerStackScreen} options={{ title: 'Customers' }} />
        <Tab.Screen name="Credits" component={CreditStackScreen} options={{ title: 'Credits' }} />
        <Tab.Screen
          name="Settings"
          options={{ title: 'Settings' }}
        >
          {() => <SettingsStackScreen onLogout={onLogout} />}
        </Tab.Screen>
      </Tab.Navigator>
    </View>
  );
}

type AppState = 'loading' | 'login' | 'pin' | 'main';

export default function AppNavigator() {
  const [appState, setAppState] = useState<AppState>('loading');
  const [failCount, setFailCount] = useState(0);

  useEffect(() => {
    (async () => {
      const loggedIn = await authService.isLoggedIn();
      if (!loggedIn) { setAppState('login'); return; }
      const pinEnabled = await pinService.isEnabled();
      setAppState(pinEnabled ? 'pin' : 'main');
    })();
  }, []);

  const handlePinSuccess = async (entered: string) => {
    const ok = await pinService.verify(entered);
    if (ok) {
      setFailCount(0);
      setAppState('main');
    } else {
      const next = failCount + 1;
      setFailCount(next);
      if (next >= 5) {
        Alert.alert('Too many attempts', 'Please log in again.', [
          { text: 'OK', onPress: () => { authService.logout(); setAppState('login'); } },
        ]);
      }
      // PinLockScreen resets automatically on wrong input — parent re-renders with error via key
    }
  };

  if (appState === 'loading') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (appState === 'login') {
    return (
      <NavigationContainer>
        <LoginScreen onLoginSuccess={async () => {
          const pinEnabled = await pinService.isEnabled();
          setAppState(pinEnabled ? 'pin' : 'main');
        }} />
      </NavigationContainer>
    );
  }

  if (appState === 'pin') {
    return (
      <PinLockScreen
        key={failCount}
        mode="unlock"
        subtitle={failCount > 0 ? `Incorrect PIN (${failCount}/5 attempts)` : undefined}
        onSuccess={handlePinSuccess}
      />
    );
  }

  return (
    <NavigationContainer>
      <MainTabs onLogout={() => { authService.logout(); setAppState('login'); }} />
    </NavigationContainer>
  );
}
