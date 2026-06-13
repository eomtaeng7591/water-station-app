import AsyncStorage from '@react-native-async-storage/async-storage';

const PIN_KEY     = '@app_pin';
const PIN_ENABLED = '@app_pin_enabled';

export const pinService = {
  async isEnabled(): Promise<boolean> {
    const v = await AsyncStorage.getItem(PIN_ENABLED);
    return v === 'true';
  },

  async getPin(): Promise<string | null> {
    return AsyncStorage.getItem(PIN_KEY);
  },

  async setPin(pin: string): Promise<void> {
    await AsyncStorage.setItem(PIN_KEY, pin);
    await AsyncStorage.setItem(PIN_ENABLED, 'true');
  },

  async verify(pin: string): Promise<boolean> {
    const stored = await AsyncStorage.getItem(PIN_KEY);
    return stored === pin;
  },

  async disable(): Promise<void> {
    await AsyncStorage.removeItem(PIN_KEY);
    await AsyncStorage.setItem(PIN_ENABLED, 'false');
  },
};
