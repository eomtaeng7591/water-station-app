import { supabase } from './supabase';

let cachedStoreId: string | null = null;
let cachedUserId: string | null = null;
let cachedStoreName: string | null = null;

export async function getCurrentUserId(): Promise<string> {
  if (cachedUserId) return cachedUserId;
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.user) throw new Error('Not logged in');
  cachedUserId = data.session.user.id;
  return cachedUserId;
}

export async function getCurrentStoreId(): Promise<string> {
  if (cachedStoreId) return cachedStoreId;
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('users')
    .select('store_id')
    .eq('id', userId)
    .single();
  if (error) throw new Error(error.message);
  if (!data?.store_id) throw new Error('This account is not linked to a store yet.');
  const storeId: string = data.store_id;
  cachedStoreId = storeId;
  return storeId;
}

export async function getCurrentStoreName(): Promise<string> {
  if (cachedStoreName) return cachedStoreName;
  const storeId = await getCurrentStoreId();
  const { data, error } = await supabase
    .from('stores')
    .select('name')
    .eq('id', storeId)
    .single();
  if (error) throw new Error(error.message);
  const storeName: string = data?.name ?? '';
  cachedStoreName = storeName;
  return storeName;
}

export function clearStoreContextCache(): void {
  cachedStoreId = null;
  cachedUserId = null;
  cachedStoreName = null;
}
