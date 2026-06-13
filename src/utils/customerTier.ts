export interface TierInfo {
  label: 'VIP' | 'Regular' | 'New';
  emoji: string;
  color: string;
  bgColor: string;
}

// VIP:     10+ orders  OR  ₱5,000+ spend
// Regular:  3+ orders  OR  ₱500+   spend
// New:      otherwise
export function getCustomerTier(totalOrders: number, totalSpend: number): TierInfo {
  if (totalOrders >= 10 || totalSpend >= 5000) {
    return { label: 'VIP', emoji: '👑', color: '#B45309', bgColor: '#FEF3C7' };
  }
  if (totalOrders >= 3 || totalSpend >= 500) {
    return { label: 'Regular', emoji: '⭐', color: '#6D28D9', bgColor: '#EDE9FE' };
  }
  return { label: 'New', emoji: '🆕', color: '#0369A1', bgColor: '#E0F2FE' };
}
