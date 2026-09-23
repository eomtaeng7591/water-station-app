import { supabase } from './supabase';
import { getCurrentStoreId } from './storeContext';
import { ContainerType, ContainerTxnInput, CustomerContainerBalance } from '../types';

function mapContainerType(row: any): ContainerType {
  return {
    container_type_id: row.id,
    label: row.label,
    owned_qty: row.owned_qty,
    sort_order: row.sort_order,
    is_active: row.is_active,
    walkin_price: row.walkin_price === null || row.walkin_price === undefined ? null : Number(row.walkin_price),
    delivery_price: row.delivery_price === null || row.delivery_price === undefined ? null : Number(row.delivery_price),
  };
}

export const containerService = {
  async getContainerTypes(): Promise<ContainerType[]> {
    const { data, error } = await supabase
      .from('container_types')
      .select('*')
      .order('sort_order')
      .order('label');
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapContainerType);
  },
  async getActiveContainerTypes(): Promise<ContainerType[]> {
    const { data, error } = await supabase
      .from('container_types')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
      .order('label');
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapContainerType);
  },
  async addContainerType(label: string, ownedQty: number): Promise<ContainerType> {
    const storeId = await getCurrentStoreId();
    const { data, error } = await supabase
      .from('container_types')
      .insert({ store_id: storeId, label, owned_qty: ownedQty })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return mapContainerType(data);
  },
  async updateOwnedQty(containerTypeId: string, ownedQty: number): Promise<ContainerType> {
    const { data, error } = await supabase
      .from('container_types')
      .update({ owned_qty: ownedQty })
      .eq('id', containerTypeId)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return mapContainerType(data);
  },
  async setActive(containerTypeId: string, isActive: boolean): Promise<ContainerType> {
    const { data, error } = await supabase
      .from('container_types')
      .update({ is_active: isActive })
      .eq('id', containerTypeId)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return mapContainerType(data);
  },
  async recordTransactions(
    orderId: string,
    customerId: string | null,
    entries: ContainerTxnInput[]
  ): Promise<void> {
    if (entries.length === 0) return;
    const storeId = await getCurrentStoreId();
    const { error } = await supabase.from('container_transactions').insert(
      entries.map(e => ({
        store_id: storeId,
        customer_id: customerId,
        order_id: orderId,
        container_type_id: e.container_type_id,
        txn_type: e.txn_type,
        quantity: e.quantity,
      }))
    );
    if (error) throw new Error(error.message);
  },
  async getCustomerBalances(customerId: string): Promise<CustomerContainerBalance[]> {
    const { data, error } = await supabase
      .from('customer_container_balances')
      .select('container_type_id, label, outstanding_qty')
      .eq('customer_id', customerId);
    if (error) throw new Error(error.message);
    return (data ?? [])
      .map(r => ({
        container_type_id: r.container_type_id,
        label: r.label,
        outstanding_qty: Number(r.outstanding_qty),
      }))
      .filter(r => r.outstanding_qty > 0);
  },
};
