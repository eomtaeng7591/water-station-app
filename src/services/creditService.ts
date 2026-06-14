import { api } from './apiClient';
import { Credit } from '../types';

export const creditService = {
  async getOutstandingCredits(): Promise<Credit[]> {
    return api.get<Credit[]>('/credits/outstanding');
  },
  async getCustomerCredits(customerId: number): Promise<Credit[]> {
    return api.get<Credit[]>(`/credits/customer/${customerId}`);
  },
  async collectPayment(creditId: number, amount: number): Promise<Credit> {
    return api.patch<Credit>(`/credits/${creditId}/collect`, { amount });
  },
  async getTotalOutstanding(): Promise<number> {
    const res = await api.get<{ total: number }>('/credits/total');
    return Number(res.total);
  },
  async getOverdueCount(): Promise<number> {
    const res = await api.get<{ count: number }>('/credits/overdue-count');
    return Number(res.count);
  },
};
