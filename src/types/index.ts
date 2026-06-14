export interface Customer {
  customer_id: number;
  customer_name: string;
  phone_number: string;
  address: string;
  is_verified: boolean;
  created_at: string;
  total_outstanding?: number;
  total_orders?: number;
  total_spend?: number;
  notes?: string;
  tags?: string[];
}

export interface SystemSettings {
  setting_id: number;
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
export type PaymentType = 'CASH' | 'GCASH' | 'CREDIT';
export type DeliveryStatus = 'PENDING' | 'COMPLETED';
export type CreditStatus = 'UNPAID' | 'PARTIAL' | 'PAID';

export interface Order {
  order_id: number;
  customer_id: number | null;
  order_type: OrderType;
  unit_price: number;
  quantity: number;
  total_amount: number;
  payment_type: PaymentType;
  delivery_status: DeliveryStatus;
  remarks: string | null;
  gcash_ref: string | null;
  receipt_no: string | null;
  rider_id: number | null;
  created_at: string;
  customer?: Customer;
}

export interface Rider {
  rider_id: number;
  rider_name: string;
  phone_number: string | null;
  is_active: boolean;
  created_at: string;
}

export interface OrderInput {
  customer_id?: number | null;
  order_type: OrderType;
  unit_price: number;
  quantity: number;
  total_amount: number;
  payment_type: PaymentType;
  delivery_status: DeliveryStatus;
  remarks?: string;
  gcash_ref?: string | null;
  rider_id?: number | null;
  due_date?: string | null;
}

export interface Credit {
  credit_id: number;
  customer_id: number;
  order_id: number;
  amount: number;
  remaining_balance: number;
  status: CreditStatus;
  due_date: string | null;
  updated_at: string;
  customer?: Customer;
  order?: Order;
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
  rider_id: number;
  rider_name: string;
  phone_number: string | null;
  is_active: boolean;
  delivery_count: number;
  delivery_total: number;
  completed_count: number;
}
