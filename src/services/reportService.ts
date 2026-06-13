import { api } from './apiClient';
import { MonthlySummary, WeeklyStat, YearlyStat, TargetProgress, TrendPoint } from '../types';

export interface DailyStatsResult {
  walkin: number;
  delivery: number;
  total: number;
  orderCount: number;
  cash: number;
  ewallet: number;
  credit: number;
}

export const reportService = {
  async getDailyStats(): Promise<DailyStatsResult> {
    const res = await api.get<any>('/dashboard');
    return {
      walkin:      Number(res.walkin_total   ?? 0),
      delivery:    Number(res.delivery_total  ?? 0),
      total:       Number(res.today_revenue   ?? 0),
      orderCount:  Number(res.today_orders    ?? 0),
      cash:        Number(res.cash_total      ?? 0),
      ewallet:     Number(res.ewallet_total   ?? 0),
      credit:      Number(res.credit_total    ?? 0),
    };
  },

  async getWeeklyStats(): Promise<WeeklyStat[]> {
    return api.get<WeeklyStat[]>('/reports/weekly');
  },

  async getMonthlyStats(year: number, month: number): Promise<MonthlySummary> {
    return api.get<MonthlySummary>(`/reports/monthly?year=${year}&month=${month}`);
  },

  async getYearlyStats(year: number): Promise<YearlyStat[]> {
    return api.get<YearlyStat[]>(`/reports/yearly?year=${year}`);
  },

  async getTrend(days: 7 | 14 | 30): Promise<TrendPoint[]> {
    return api.get<TrendPoint[]>(`/reports/trend?days=${days}`);
  },

  async getTargetProgress(date?: string): Promise<TargetProgress> {
    const q = date ? `?date=${date}` : '';
    return api.get<TargetProgress>(`/targets/progress${q}`);
  },
};
