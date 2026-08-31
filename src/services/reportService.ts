import { supabase } from './supabase';
import { settingsService } from './settingsService';
import { riderService } from './riderService';
import { MonthlySummary, YearlyStat, TargetProgress, TrendPoint, DailyStat, RiderStat } from '../types';

export interface DailyStatsResult {
  walkin: number;
  delivery: number;
  total: number;
  orderCount: number;
  cash: number;
  gcash: number;
  maya: number;
}

function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dayRange(date: string): { start: string; end: string } {
  const start = new Date(`${date}T00:00:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

async function fetchOrdersInRange(startIso: string, endIso: string) {
  const { data, error } = await supabase
    .from('orders')
    .select('order_type, status, total_amount, ordered_at, rider_id, payments(method)')
    .gte('ordered_at', startIso)
    .lt('ordered_at', endIso);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export const reportService = {
  async getDailyStats(): Promise<DailyStatsResult> {
    const { start, end } = dayRange(localDateStr(new Date()));
    const rows = await fetchOrdersInRange(start, end);

    let walkin = 0, delivery = 0, cash = 0, gcash = 0, maya = 0;
    rows.forEach((r: any) => {
      const amt = Number(r.total_amount ?? 0);
      if (r.order_type === 'walk_in') walkin += amt; else delivery += amt;
      const method = r.payments?.[0]?.method;
      if (method === 'cash') cash += amt;
      else if (method === 'gcash') gcash += amt;
      else if (method === 'maya') maya += amt;
    });

    return { walkin, delivery, total: walkin + delivery, orderCount: rows.length, cash, gcash, maya };
  },

  async getMonthlyStats(year: number, month: number): Promise<MonthlySummary> {
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 1);
    const rows = await fetchOrdersInRange(monthStart.toISOString(), monthEnd.toISOString());

    const daysInMonth = monthEnd.getDate() === 1 ? new Date(year, month, 0).getDate() : monthEnd.getDate();
    const byDate = new Map<string, { walkin: number; delivery: number }>();

    rows.forEach((r: any) => {
      const d = localDateStr(new Date(r.ordered_at));
      const amt = Number(r.total_amount ?? 0);
      const entry = byDate.get(d) ?? { walkin: 0, delivery: 0 };
      if (r.order_type === 'walk_in') entry.walkin += amt; else entry.delivery += amt;
      byDate.set(d, entry);
    });

    const days: DailyStat[] = [];
    let walkinTotal = 0, deliveryTotal = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const entry = byDate.get(dateStr) ?? { walkin: 0, delivery: 0 };
      walkinTotal += entry.walkin;
      deliveryTotal += entry.delivery;
      days.push({ date: dateStr, walkin_sales: entry.walkin, delivery_sales: entry.delivery, daily_total: entry.walkin + entry.delivery });
    }

    return { days, walkin_total: walkinTotal, delivery_total: deliveryTotal, grand_total_sales: walkinTotal + deliveryTotal };
  },

  async getYearlyStats(year: number): Promise<YearlyStat[]> {
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year + 1, 0, 1);
    const rows = await fetchOrdersInRange(yearStart.toISOString(), yearEnd.toISOString());

    const byMonth = Array.from({ length: 12 }, () => ({ walkin: 0, delivery: 0 }));
    rows.forEach((r: any) => {
      const monthIdx = new Date(r.ordered_at).getMonth();
      const amt = Number(r.total_amount ?? 0);
      if (r.order_type === 'walk_in') byMonth[monthIdx].walkin += amt; else byMonth[monthIdx].delivery += amt;
    });

    const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return byMonth.map((m, i) => ({ month: monthLabels[i], walkin: m.walkin, delivery: m.delivery, total: m.walkin + m.delivery }));
  },

  async getTrend(days: 7 | 14 | 30): Promise<TrendPoint[]> {
    const today = new Date();
    const rangeStart = new Date(today);
    rangeStart.setDate(rangeStart.getDate() - (days - 1));
    const { start } = dayRange(localDateStr(rangeStart));
    const { end } = dayRange(localDateStr(today));
    const rows = await fetchOrdersInRange(start, end);

    const byDate = new Map<string, { walkin: number; delivery: number; count: number }>();
    rows.forEach((r: any) => {
      const d = localDateStr(new Date(r.ordered_at));
      const amt = Number(r.total_amount ?? 0);
      const entry = byDate.get(d) ?? { walkin: 0, delivery: 0, count: 0 };
      if (r.order_type === 'walk_in') entry.walkin += amt; else entry.delivery += amt;
      entry.count += 1;
      byDate.set(d, entry);
    });

    const points: TrendPoint[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(rangeStart);
      d.setDate(d.getDate() + i);
      const dateStr = localDateStr(d);
      const entry = byDate.get(dateStr) ?? { walkin: 0, delivery: 0, count: 0 };
      points.push({ date: dateStr, walkin: entry.walkin, delivery: entry.delivery, total: entry.walkin + entry.delivery, order_count: entry.count });
    }
    return points;
  },

  async getTargetProgress(date?: string): Promise<TargetProgress> {
    const targetDate = date ?? localDateStr(new Date());
    const [y, m] = targetDate.split('-').map(Number);

    const [settings, dailyRows, monthRows] = await Promise.all([
      settingsService.getSettings(),
      (async () => {
        const { start, end } = dayRange(targetDate);
        return fetchOrdersInRange(start, end);
      })(),
      (async () => {
        const monthStart = new Date(y, m - 1, 1);
        const monthEndExclusive = new Date(`${targetDate}T00:00:00`);
        monthEndExclusive.setDate(monthEndExclusive.getDate() + 1);
        return fetchOrdersInRange(monthStart.toISOString(), monthEndExclusive.toISOString());
      })(),
    ]);

    const dailyActual = dailyRows.reduce((s: number, r: any) => s + Number(r.total_amount ?? 0), 0);
    const monthlyActual = monthRows.reduce((s: number, r: any) => s + Number(r.total_amount ?? 0), 0);

    return {
      daily_target: settings.daily_target,
      monthly_target: settings.monthly_target,
      daily_actual: dailyActual,
      monthly_actual: monthlyActual,
      daily_pct: settings.daily_target > 0 ? (dailyActual / settings.daily_target) * 100 : 0,
      monthly_pct: settings.monthly_target > 0 ? (monthlyActual / settings.monthly_target) * 100 : 0,
    };
  },

  async getRiderStats(year: number, month: number): Promise<RiderStat[]> {
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 1);
    const [rows, riders] = await Promise.all([
      fetchOrdersInRange(monthStart.toISOString(), monthEnd.toISOString()),
      riderService.getAllRiders(),
    ]);

    const byRider = new Map<string, { count: number; total: number; completed: number }>();
    rows.forEach((r: any) => {
      if (!r.rider_id) return;
      const entry = byRider.get(r.rider_id) ?? { count: 0, total: 0, completed: 0 };
      entry.count += 1;
      entry.total += Number(r.total_amount ?? 0);
      if (r.status === 'completed') entry.completed += 1;
      byRider.set(r.rider_id, entry);
    });

    return riders
      .map(rider => {
        const s = byRider.get(rider.rider_id);
        return {
          rider_id: rider.rider_id,
          rider_name: rider.rider_name,
          phone_number: rider.phone_number,
          is_active: rider.is_active,
          delivery_count: s?.count ?? 0,
          delivery_total: s?.total ?? 0,
          completed_count: s?.completed ?? 0,
        };
      })
      .filter(r => r.delivery_count > 0 || r.is_active);
  },
};
