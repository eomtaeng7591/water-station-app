import { supabase } from './supabase';
import { getCurrentStoreId } from './storeContext';
import { SystemSettings } from '../types';

function mapSettings(row: any): SystemSettings {
  return {
    store_id: row.store_id,
    delivery_price: Number(row.delivery_price),
    walkin_price: Number(row.walkin_price),
    daily_target: Number(row.daily_target ?? 0),
    monthly_target: Number(row.monthly_target ?? 0),
    updated_at: row.updated_at,
  };
}

export const settingsService = {
  async getSettings(): Promise<SystemSettings> {
    const storeId = await getCurrentStoreId();
    const { data, error } = await supabase
      .from('system_settings')
      .select('*')
      .eq('store_id', storeId)
      .single();
    if (error) throw new Error(error.message);
    return mapSettings(data);
  },
  async updatePrices(deliveryPrice: number, walkinPrice: number): Promise<SystemSettings> {
    const storeId = await getCurrentStoreId();
    const { data, error } = await supabase
      .from('system_settings')
      .update({ delivery_price: deliveryPrice, walkin_price: walkinPrice })
      .eq('store_id', storeId)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return mapSettings(data);
  },
  async updateTargets(dailyTarget: number, monthlyTarget: number): Promise<SystemSettings> {
    const storeId = await getCurrentStoreId();
    const { data, error } = await supabase
      .from('system_settings')
      .update({ daily_target: dailyTarget, monthly_target: monthlyTarget })
      .eq('store_id', storeId)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return mapSettings(data);
  },
};
