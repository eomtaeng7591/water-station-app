import { api, saveToken, clearToken } from './apiClient';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const authService = {
  async login(email: string, password: string): Promise<void> {
    const res = await api.post<{ token: string }>('/auth/login', { email, password });
    await saveToken(res.token);
  },
  async logout(): Promise<void> {
    await clearToken();
  },
  async isLoggedIn(): Promise<boolean> {
    const token = await AsyncStorage.getItem('auth_token');
    return !!token;
  },
};
