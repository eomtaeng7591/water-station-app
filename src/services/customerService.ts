import { api } from './apiClient';
import { Customer } from '../types';

export const customerService = {
  async getAllCustomers(): Promise<Customer[]> {
    return api.get<Customer[]>('/customers?search=');
  },
  async searchCustomers(query: string): Promise<Customer[]> {
    return api.get<Customer[]>(`/customers?search=${encodeURIComponent(query)}`);
  },
  async getCustomerById(id: number): Promise<Customer> {
    return api.get<Customer>(`/customers/${id}`);
  },
  async createCustomer(name: string, phone: string, address: string, notes?: string, tags?: string[]): Promise<Customer> {
    return api.post<Customer>('/customers', { customer_name: name, phone_number: phone, address, notes, tags });
  },
  async updateCustomer(id: number, updates: Partial<Pick<Customer, 'customer_name' | 'phone_number' | 'address' | 'notes' | 'tags'>>): Promise<Customer> {
    return api.patch<Customer>(`/customers/${id}`, updates);
  },
  async deleteCustomer(id: number): Promise<void> {
    await api.delete(`/customers/${id}`);
  },
};
