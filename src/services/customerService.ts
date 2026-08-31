import { supabase } from './supabase';
import { getCurrentStoreId } from './storeContext';
import { Customer } from '../types';

function mapCustomer(row: any): Customer {
  return {
    customer_id: row.id,
    customer_name: row.name,
    phone_number: row.phone ?? '',
    address: row.address ?? '',
    notes: row.notes ?? undefined,
    created_at: row.created_at,
  };
}

async function withOrderStats(rows: any[]): Promise<Customer[]> {
  const customers = rows.map(mapCustomer);
  if (customers.length === 0) return customers;

  const { data: orderRows } = await supabase
    .from('orders')
    .select('customer_id, total_amount')
    .not('customer_id', 'is', null);

  const stats = new Map<string, { count: number; spend: number }>();
  (orderRows ?? []).forEach((o: any) => {
    if (!o.customer_id) return;
    const s = stats.get(o.customer_id) ?? { count: 0, spend: 0 };
    s.count += 1;
    s.spend += Number(o.total_amount ?? 0);
    stats.set(o.customer_id, s);
  });

  return customers.map(c => {
    const s = stats.get(c.customer_id);
    return { ...c, total_orders: s?.count ?? 0, total_spend: s?.spend ?? 0 };
  });
}

export const customerService = {
  async getAllCustomers(): Promise<Customer[]> {
    const { data, error } = await supabase.from('customers').select('*').order('name');
    if (error) throw new Error(error.message);
    return withOrderStats(data ?? []);
  },
  async searchCustomers(query: string): Promise<Customer[]> {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .or(`name.ilike.%${query}%,phone.ilike.%${query}%`)
      .order('name')
      .limit(30);
    if (error) throw new Error(error.message);
    return withOrderStats(data ?? []);
  },
  async getCustomerById(id: string): Promise<Customer> {
    const { data, error } = await supabase.from('customers').select('*').eq('id', id).single();
    if (error) throw new Error(error.message);
    const [withStats] = await withOrderStats([data]);
    return withStats;
  },
  async createCustomer(name: string, phone: string, address: string, notes?: string): Promise<Customer> {
    const storeId = await getCurrentStoreId();
    const { data, error } = await supabase
      .from('customers')
      .insert({ store_id: storeId, name, phone, address, notes: notes || null })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return mapCustomer(data);
  },
  async updateCustomer(
    id: string,
    updates: Partial<Pick<Customer, 'customer_name' | 'phone_number' | 'address' | 'notes'>>
  ): Promise<Customer> {
    const patch: Record<string, any> = {};
    if (updates.customer_name !== undefined) patch.name = updates.customer_name;
    if (updates.phone_number !== undefined) patch.phone = updates.phone_number;
    if (updates.address !== undefined) patch.address = updates.address;
    if (updates.notes !== undefined) patch.notes = updates.notes || null;
    const { data, error } = await supabase.from('customers').update(patch).eq('id', id).select('*').single();
    if (error) throw new Error(error.message);
    return mapCustomer(data);
  },
  async deleteCustomer(id: string): Promise<void> {
    const { error } = await supabase.from('customers').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },
};
