import { api } from './apiClient';
import { Rider } from '../types';

export const riderService = {
  async getActiveRiders(): Promise<Rider[]> {
    return api.get<Rider[]>('/riders?active=true');
  },
  async getAllRiders(): Promise<Rider[]> {
    return api.get<Rider[]>('/riders');
  },
  async createRider(name: string, phone?: string): Promise<Rider> {
    return api.post<Rider>('/riders', { rider_name: name, phone_number: phone || null });
  },
  async toggleActive(riderId: number, isActive: boolean): Promise<Rider> {
    return api.patch<Rider>(`/riders/${riderId}`, { is_active: isActive });
  },
  async updateRider(riderId: number, updates: { rider_name?: string; phone_number?: string }): Promise<Rider> {
    return api.patch<Rider>(`/riders/${riderId}`, updates);
  },
  async deleteRider(riderId: number): Promise<void> {
    await api.delete(`/riders/${riderId}`);
  },
};
