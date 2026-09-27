import { supabase } from './supabase';
import { getCurrentStoreId, getCurrentUserId } from './storeContext';
import { ContainerType, ContainerTxnInput, CustomerContainerBalance, StoreContainerSummary, UnpaidContainerFee } from '../types';

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
  async applyStockTxn(
    containerTypeId: string,
    txnType: 'restock' | 'dispose',
    quantity: number,
    notes?: string
  ): Promise<void> {
    const userId = await getCurrentUserId();
    const { error } = await supabase.rpc('fn_apply_container_stock_txn', {
      p_container_type_id: containerTypeId,
      p_txn_type: txnType,
      p_quantity: quantity,
      p_notes: notes || null,
      p_created_by: userId,
    });
    if (error) throw new Error(error.message);
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
        fee_amount: e.fee_amount ?? null,
        fee_paid: e.fee_paid ?? false,
      }))
    );
    if (error) throw new Error(error.message);
  },
  async getCustomerBalances(customerId: string): Promise<CustomerContainerBalance[]> {
    const { data, error } = await supabase
      .from('customer_container_balances')
      .select('container_type_id, label, borrowed_qty, returned_qty, purchased_qty, outstanding_qty')
      .eq('customer_id', customerId);
    if (error) throw new Error(error.message);
    return (data ?? []).map(r => ({
      container_type_id: r.container_type_id,
      label: r.label,
      borrowed_qty: Number(r.borrowed_qty),
      returned_qty: Number(r.returned_qty),
      purchased_qty: Number(r.purchased_qty),
      outstanding_qty: Number(r.outstanding_qty),
    }));
  },
  async getUnpaidFees(customerId: string): Promise<UnpaidContainerFee[]> {
    const { data, error } = await supabase
      .from('container_transactions')
      .select('id, container_type_id, txn_type, quantity, fee_amount, created_at, container_types(label)')
      .eq('customer_id', customerId)
      .eq('txn_type', 'borrow')
      .eq('fee_paid', false)
      .not('fee_amount', 'is', null)
      .order('created_at');
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => ({
      transaction_id: r.id,
      container_type_id: r.container_type_id,
      label: r.container_types?.label ?? '',
      txn_type: r.txn_type,
      quantity: r.quantity,
      fee_amount: Number(r.fee_amount),
      created_at: r.created_at,
    }));
  },
  async markFeePaid(transactionId: string): Promise<void> {
    const { error } = await supabase
      .from('container_transactions')
      .update({ fee_paid: true, fee_paid_at: new Date().toISOString() })
      .eq('id', transactionId);
    if (error) throw new Error(error.message);
  },
  async getStoreSummary(): Promise<StoreContainerSummary[]> {
    const { data, error } = await supabase
      .from('store_container_summary')
      .select('*')
      .order('label');
    if (error) throw new Error(error.message);
    return (data ?? []).map(r => ({
      container_type_id: r.container_type_id,
      label: r.label,
      owned_qty: Number(r.owned_qty),
      out_with_customers: Number(r.out_with_customers),
      sold_permanently: Number(r.sold_permanently),
      available_in_shop: Number(r.available_in_shop),
    }));
  },
};
