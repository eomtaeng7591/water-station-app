import { supabase } from './supabase';
import { getCurrentStoreId, getCurrentUserId } from './storeContext';
import { CreditBalance } from '../types';

export const creditService = {
  async getCustomerBalance(customerId: string): Promise<CreditBalance> {
    const { data, error } = await supabase
      .from('customer_credit_balances')
      .select('*')
      .eq('customer_id', customerId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      customer_id: customerId,
      credit_charged: Number(data?.credit_charged ?? 0),
      credit_paid: Number(data?.credit_paid ?? 0),
      balance: Number(data?.balance ?? 0),
    };
  },
  async recordPayment(customerId: string, amount: number, notes?: string): Promise<void> {
    const storeId = await getCurrentStoreId();
    const userId = await getCurrentUserId();
    const { error } = await supabase.from('credit_payments').insert({
      store_id: storeId,
      customer_id: customerId,
      amount,
      notes: notes || null,
      created_by: userId,
    });
    if (error) throw new Error(error.message);
  },
};
