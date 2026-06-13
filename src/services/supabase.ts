import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ⚠️ Supabase 프로젝트 생성 후 아래 값을 교체하세요
// https://supabase.com → 새 프로젝트 → Settings → API
const SUPABASE_URL = 'https://gtjjpvkwtekumjuulgsh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ceGpjjXurs4pLEEXb18UeA_Q4skXBSx';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
