import { api } from './apiClient';
import { SystemSettings } from '../types';

export const settingsService = {
  async getSettings(): Promise<SystemSettings> {
    return api.get<SystemSettings>('/settings');
  },
  async updatePrices(deliveryPrice: number, walkinPrice: number): Promise<SystemSettings> {
    return api.put<SystemSettings>('/settings', { delivery_price: deliveryPrice, walkin_price: walkinPrice });
  },
  async updateTargets(dailyTarget: number, monthlyTarget: number): Promise<SystemSettings> {
    return api.patch<SystemSettings>('/settings/targets', {
      daily_target: dailyTarget,
      monthly_target: monthlyTarget,
    });
  },
};
