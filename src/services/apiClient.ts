import AsyncStorage from '@react-native-async-storage/async-storage';

// iOS 시뮬레이터: localhost:3000 / 실기기: Mac LAN IP로 교체
export const API_BASE = 'http://localhost:3000';

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
