import { supabase } from './supabase';
import { StoreMember } from '../types';

// aquashop(Next.js) 배포 — water-station-app 자체 웹 배포(Vercel)와는 별개 프로젝트.
const AQUASHOP_API_BASE = 'https://watershop-platform.vercel.app';

interface StaffListResponse {
  success: boolean;
  members?: StoreMember[];
  error?: string;
}

interface StaffCreateResponse {
  success: boolean;
  user_id?: string;
  error?: string;
}

async function authedRequest<T>(path: string, method: string, body?: any): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Not logged in.');

  const res = await fetch(`${AQUASHOP_API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json: any;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Server error (${res.status}): ${text.slice(0, 200) || 'Empty response'}`);
  }
  if (!res.ok || json.success === false) {
    throw new Error(json.error || `HTTP ${res.status}`);
  }
  return json;
}

export const staffService = {
  async listStaff(): Promise<StoreMember[]> {
    const json = await authedRequest<StaffListResponse>('/api/store/staff', 'GET');
    return json.members ?? [];
  },
  async addStaff(name: string, email: string, password: string): Promise<string> {
    const json = await authedRequest<StaffCreateResponse>('/api/store/staff', 'POST', { name, email, password });
    if (!json.user_id) throw new Error('Server did not return a new user id.');
    return json.user_id;
  },
};
