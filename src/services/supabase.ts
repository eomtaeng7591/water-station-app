import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// aquashop Supabase 프로젝트 (멀티테넌트 워터샵 플랫폼 공용 백엔드)
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
