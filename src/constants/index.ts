export const COLORS = {
  primary: '#0F6E56',
  primaryLight: '#1D9E75',
  primaryDark: '#085041',
  accent: '#EF9F27',
  accentLight: '#FAC775',
  danger: '#E24B4A',
  dangerLight: '#F09595',
  background: '#F5F5F0',
  surface: '#FFFFFF',
  textPrimary: '#2C2C2A',
  textSecondary: '#5F5E5A',
  textMuted: '#888780',
  border: '#D3D1C7',
  walkin: '#185FA5',
  delivery: '#BA7517',
  cash: '#3B6D11',
  ewallet: '#534AB7',
  credit: '#993556',
};

export const INITIAL_WALKIN_PRICE = 40;
export const INITIAL_DELIVERY_PRICE = 45;

export const ORDER_TYPES = {
  WALKIN: 'WALK-IN',
  DELIVERY: 'DELIVERY',
} as const;

export const PAYMENT_TYPES = {
  CASH: 'CASH',
  EWALLET: 'GCASH',
  CREDIT: 'CREDIT',
} as const;

export const DELIVERY_STATUS = {
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
} as const;

export const CREDIT_STATUS = {
  UNPAID: 'UNPAID',
  PARTIAL: 'PARTIAL',
  PAID: 'PAID',
} as const;
