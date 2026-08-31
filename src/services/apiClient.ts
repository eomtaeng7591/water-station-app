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

async function request<T>(method: string, path: string, body?: any): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: any;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Server error (${res.status}): ${text.slice(0, 200) || 'Empty response'}`);
  }
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
