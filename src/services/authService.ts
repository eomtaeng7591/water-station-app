import { supabase } from './supabase';
import { clearStoreContextCache } from './storeContext';

export const authService = {
  async login(email: string, password: string): Promise<void> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  },
  async logout(): Promise<void> {
    await supabase.auth.signOut();
    clearStoreContextCache();
  },
  async isLoggedIn(): Promise<boolean> {
    const { data } = await supabase.auth.getSession();
    return !!data.session;
  },
};
