import { supabase } from './supabase';
import { getCurrentStoreId, getCurrentUserId } from './storeContext';
import { Order, OrderInput, OrderType, PaymentType } from '../types';

const ORDER_TYPE_TO_DB: Record<OrderType, string> = { 'WALK-IN': 'walk_in', 'DELIVERY': 'delivery' };
const ORDER_TYPE_FROM_DB: Record<string, OrderType> = { walk_in: 'WALK-IN', delivery: 'DELIVERY' };
const PAYMENT_TO_DB: Record<PaymentType, string> = { CASH: 'cash', GCASH: 'gcash', MAYA: 'maya', CREDIT: 'credit' };
const PAYMENT_FROM_DB: Record<string, PaymentType> = { cash: 'CASH', gcash: 'GCASH', maya: 'MAYA', credit: 'CREDIT' };

const ORDER_SELECT = `
  id, customer_id, order_type, status, total_amount, gallon_qty, notes,
  ordered_at, completed_at, rider_id,
  customers ( id, name, phone, address ),
  payments ( method ),
  riders ( name )
`;

function mapOrder(row: any): Order {
  const qty = Number(row.gallon_qty ?? 0);
  const total = Number(row.total_amount ?? 0);
  const payment = row.payments?.[0];
  return {
    order_id: row.id,
    customer_id: row.customer_id,
    order_type: ORDER_TYPE_FROM_DB[row.order_type] ?? 'WALK-IN',
    unit_price: qty > 0 ? total / qty : 0,
    quantity: qty,
    total_amount: total,
    payment_type: PAYMENT_FROM_DB[payment?.method] ?? 'CASH',
    delivery_status: row.status === 'completed' ? 'COMPLETED' : 'PENDING',
    remarks: row.notes ?? null,
    gcash_ref: null,
    receipt_no: `ORD-${String(row.id).slice(0, 8).toUpperCase()}`,
    rider_id: row.rider_id,
    rider_name: row.riders?.name ?? null,
    created_at: row.ordered_at,
    customer: row.customers ? {
      customer_id: row.customers.id,
      customer_name: row.customers.name,
      phone_number: row.customers.phone ?? '',
      address: row.customers.address ?? '',
      created_at: '',
    } : undefined,
  };
}

async function getOrderById(id: string): Promise<Order> {
  const { data, error } = await supabase.from('orders').select(ORDER_SELECT).eq('id', id).single();
  if (error) throw new Error(error.message);
  return mapOrder(data);
}

export const orderService = {
  async createOrder(input: OrderInput): Promise<Order> {
    const storeId = await getCurrentStoreId();
    const userId = await getCurrentUserId();
    const isCompleted = input.order_type === 'WALK-IN' || input.delivery_status === 'COMPLETED';
    const nowIso = new Date().toISOString();

    const { data: orderRow, error: orderErr } = await supabase
      .from('orders')
      .insert({
        store_id: storeId,
        customer_id: input.customer_id ?? null,
        staff_id: userId,
        order_type: ORDER_TYPE_TO_DB[input.order_type],
        status: isCompleted ? 'completed' : 'pending',
        total_amount: input.total_amount,
        gallon_qty: input.quantity,
        notes: input.remarks || null,
        rider_id: input.rider_id ?? null,
        container_type_id: input.container_type_id ?? null,
        completed_at: isCompleted ? nowIso : null,
      })
      .select('id')
      .single();
    if (orderErr) throw new Error(orderErr.message);

    const { error: payErr } = await supabase.from('payments').insert({
      order_id: orderRow.id,
      store_id: storeId,
      method: PAYMENT_TO_DB[input.payment_type],
      amount: input.total_amount,
    });
    if (payErr) throw new Error(payErr.message);

    return getOrderById(orderRow.id);
  },

  async getTodayOrders(): Promise<Order[]> {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return orderService.getOrdersByDate(`${y}-${m}-${d}`);
  },

  async getOrdersByDate(date: string): Promise<Order[]> {
    const start = new Date(`${date}T00:00:00`);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    const { data, error } = await supabase
      .from('orders')
      .select(ORDER_SELECT)
      .gte('ordered_at', start.toISOString())
      .lt('ordered_at', end.toISOString())
      .order('ordered_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapOrder);
  },

  async getPendingDeliveries(): Promise<Order[]> {
    const { data, error } = await supabase
      .from('orders')
      .select(ORDER_SELECT)
      .eq('order_type', 'delivery')
      .eq('status', 'pending')
      .order('ordered_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapOrder);
  },

  async updateDeliveryStatus(orderId: string, status: 'PENDING' | 'COMPLETED'): Promise<void> {
    const { error } = await supabase
      .from('orders')
      .update({
        status: status === 'COMPLETED' ? 'completed' : 'pending',
        completed_at: status === 'COMPLETED' ? new Date().toISOString() : null,
      })
      .eq('id', orderId);
    if (error) throw new Error(error.message);
  },

  async getOrdersByCustomer(customerId: string): Promise<Order[]> {
    const { data, error } = await supabase
      .from('orders')
      .select(ORDER_SELECT)
      .eq('customer_id', customerId)
      .order('ordered_at', { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapOrder);
  },

  async deleteOrder(orderId: string): Promise<void> {
    const { error } = await supabase.from('orders').delete().eq('id', orderId);
    if (error) throw new Error(error.message);
  },
};
