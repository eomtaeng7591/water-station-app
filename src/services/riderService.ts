import { supabase } from './supabase';
import { getCurrentStoreId } from './storeContext';
import { Rider } from '../types';

function mapRider(row: any): Rider {
  return {
    rider_id: row.id,
    rider_name: row.name,
    phone_number: row.phone ?? null,
    is_active: row.is_active,
    created_at: row.created_at,
  };
}

export const riderService = {
  async getActiveRiders(): Promise<Rider[]> {
    const { data, error } = await supabase.from('riders').select('*').eq('is_active', true).order('name');
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapRider);
  },
  async getAllRiders(): Promise<Rider[]> {
    const { data, error } = await supabase.from('riders').select('*').order('name');
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapRider);
  },
  async createRider(name: string, phone?: string): Promise<Rider> {
    const storeId = await getCurrentStoreId();
    const { data, error } = await supabase
      .from('riders')
      .insert({ store_id: storeId, name, phone: phone || null })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return mapRider(data);
  },
  async toggleActive(riderId: string, isActive: boolean): Promise<Rider> {
    const { data, error } = await supabase
      .from('riders')
      .update({ is_active: isActive })
      .eq('id', riderId)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return mapRider(data);
  },
  async updateRider(riderId: string, updates: { rider_name?: string; phone_number?: string }): Promise<Rider> {
    const patch: Record<string, any> = {};
    if (updates.rider_name !== undefined) patch.name = updates.rider_name;
    if (updates.phone_number !== undefined) patch.phone = updates.phone_number || null;
    const { data, error } = await supabase.from('riders').update(patch).eq('id', riderId).select('*').single();
    if (error) throw new Error(error.message);
    return mapRider(data);
  },
  async deleteRider(riderId: string): Promise<void> {
    const { error } = await supabase.from('riders').delete().eq('id', riderId);
    if (error) throw new Error(error.message);
  },
};
