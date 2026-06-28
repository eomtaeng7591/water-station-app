import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

const PIN_KEY     = '@app_pin';
const PIN_ENABLED = '@app_pin_enabled';

const SHA256_LENGTH = 64;

async function hashPin(pin: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, pin);
}

function isHashed(value: string): boolean {
  return value.length === SHA256_LENGTH && /^[0-9a-f]+$/.test(value);
}

export const pinService = {
  async isEnabled(): Promise<boolean> {
    const v = await AsyncStorage.getItem(PIN_ENABLED);
    return v === 'true';
  },

  async getPin(): Promise<string | null> {
    return AsyncStorage.getItem(PIN_KEY);
  },

  async setPin(pin: string): Promise<void> {
    const hashed = await hashPin(pin);
    await AsyncStorage.setItem(PIN_KEY, hashed);
    await AsyncStorage.setItem(PIN_ENABLED, 'true');
  },

  async verify(pin: string): Promise<boolean> {
    const stored = await AsyncStorage.getItem(PIN_KEY);
    if (!stored) return false;
    // 이전 버전 평문 저장 데이터 마이그레이션: 일치하면 해시로 재저장
    if (!isHashed(stored)) {
      if (stored !== pin) return false;
      const hashed = await hashPin(pin);
      await AsyncStorage.setItem(PIN_KEY, hashed);
      return true;
    }
    const hashed = await hashPin(pin);
    return stored === hashed;
  },

  async disable(): Promise<void> {
    await AsyncStorage.removeItem(PIN_KEY);
    await AsyncStorage.setItem(PIN_ENABLED, 'false');
  },
};
