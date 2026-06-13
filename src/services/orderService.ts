import { api } from './apiClient';
import { Order, OrderInput } from '../types';

export const orderService = {
  async createOrder(input: OrderInput): Promise<Order> {
    return api.post<Order>('/orders', input);
  },
  async getTodayOrders(): Promise<Order[]> {
    return api.get<Order[]>('/orders/today');
  },
  async getOrdersByDate(date: string): Promise<Order[]> {
    return api.get<Order[]>(`/orders/by-date?date=${date}`);
  },
  async getPendingDeliveries(): Promise<Order[]> {
    return api.get<Order[]>('/orders/pending');
  },
  async updateDeliveryStatus(orderId: number, status: 'PENDING' | 'COMPLETED'): Promise<void> {
    await api.patch(`/orders/${orderId}/status`, { delivery_status: status });
  },
  async getOrdersByCustomer(customerId: number): Promise<Order[]> {
    return api.get<Order[]>(`/orders/customer/${customerId}`);
  },
  async deleteOrder(orderId: number): Promise<void> {
    await api.delete(`/orders/${orderId}`);
  },
};
