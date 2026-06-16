import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

function resolveApiBase(): string {
  // Metro bundler host에서 Mac IP를 추출 (실기기 포함 자동 감지)
  const hostUri = Constants.expoConfig?.hostUri as string | undefined;
  if (hostUri) {
    const host = hostUri.split(':')[0];
    return `http://${host}:3000`;
  }
  return 'http://localhost:3000';
}

export const API_BASE = resolveApiBase();

async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem('auth_token');
}

export async function saveToken(token: string): Promise<void> {
  await AsyncStorage.setItem('auth_token', token);
}

export async function clearToken(): Promise<void> {
  await AsyncStorage.removeItem('auth_token');
}

async function request<T>(method: string, path: string, body?: any): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const api = {
  get:    <T>(path: string)              => request<T>('GET',    path),
  post:   <T>(path: string, body: any)   => request<T>('POST',   path, body),
  patch:  <T>(path: string, body: any)   => request<T>('PATCH',  path, body),
  put:    <T>(path: string, body: any)   => request<T>('PUT',    path, body),
  delete: <T>(path: string)              => request<T>('DELETE', path),
};
