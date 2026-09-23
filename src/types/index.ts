export interface Customer {
  customer_id: string;
  customer_name: string;
  phone_number: string;
  address: string;
  created_at: string;
  total_orders?: number;
  total_spend?: number;
  notes?: string;
}

export interface SystemSettings {
  store_id: string;
  delivery_price: number;
  walkin_price: number;
  daily_target: number;
  monthly_target: number;
  updated_at: string;
}

export interface TargetProgress {
  daily_target: number;
  monthly_target: number;
  daily_actual: number;
  monthly_actual: number;
  daily_pct: number;
  monthly_pct: number;
}

export type OrderType = 'WALK-IN' | 'DELIVERY';
export type PaymentType = 'CASH' | 'GCASH' | 'MAYA' | 'CREDIT';
export type DeliveryStatus = 'PENDING' | 'COMPLETED';

export interface Order {
  order_id: string;
  customer_id: string | null;
  order_type: OrderType;
  unit_price: number;
  quantity: number;
  total_amount: number;
  payment_type: PaymentType;
  delivery_status: DeliveryStatus;
  remarks: string | null;
  gcash_ref: string | null;
  receipt_no: string | null;
  rider_id: string | null;
  rider_name?: string | null;
  created_at: string;
  customer?: Customer;
}

export interface Rider {
  rider_id: string;
  rider_name: string;
  phone_number: string | null;
  is_active: boolean;
  created_at: string;
}

export interface ContainerType {
  container_type_id: string;
  label: string;
  owned_qty: number;
  sort_order: number;
  is_active: boolean;
  walkin_price: number | null;
  delivery_price: number | null;
}

export type ContainerTxnType = 'borrow' | 'purchase' | 'return';

export interface ContainerTxnInput {
  container_type_id: string;
  txn_type: ContainerTxnType;
  quantity: number;
}

export interface CustomerContainerBalance {
  container_type_id: string;
  label: string;
  outstanding_qty: number;
}

export interface CreditBalance {
  customer_id: string;
  credit_charged: number;
  credit_paid: number;
  balance: number;
}

export interface OrderInput {
  customer_id?: string | null;
  order_type: OrderType;
  unit_price: number;
  quantity: number;
  total_amount: number;
  payment_type: PaymentType;
  delivery_status: DeliveryStatus;
  remarks?: string;
  rider_id?: string | null;
  container_type_id?: string | null;
}

export interface DailyStat {
  date: string;
  walkin_sales: number;
  delivery_sales: number;
  daily_total: number;
}

export interface MonthlySummary {
  days: DailyStat[];
  walkin_total: number;
  delivery_total: number;
  grand_total_sales: number;
}

export interface WeeklyStat {
  day: string;
  walkin: number;
  delivery: number;
  total: number;
}

export interface TrendPoint {
  date: string;
  walkin: number;
  delivery: number;
  total: number;
  order_count: number;
}

export interface YearlyStat {
  month: string;
  walkin: number;
  delivery: number;
  total: number;
}

export interface RiderStat {
  rider_id: string;
  rider_name: string;
  phone_number: string | null;
  is_active: boolean;
  delivery_count: number;
  delivery_total: number;
  completed_count: number;
}
