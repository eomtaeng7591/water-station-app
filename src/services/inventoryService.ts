import { api } from './apiClient';

export interface InventoryItem {
  item_id: number;
  item_name: string;
  current_stock: number;
  unit: string;
  low_stock_threshold: number;
  updated_at: string;
}

export interface InventoryLog {
  log_id: number;
  item_id: number;
  item_name: string;
  unit: string;
  change_type: 'RESTOCK' | 'SALE' | 'RETURN' | 'ADJUSTMENT';
  quantity: number;
  note: string | null;
  created_at: string;
}

export const inventoryService = {
  async getAll(): Promise<InventoryItem[]> {
    return api.get<InventoryItem[]>('/inventory');
  },

  async restock(itemId: number, quantity: number, note?: string): Promise<InventoryItem> {
    return api.patch<InventoryItem>(`/inventory/${itemId}/restock`, { quantity, note });
  },

  async adjust(itemId: number, quantity: number, note?: string): Promise<InventoryItem> {
    return api.patch<InventoryItem>(`/inventory/${itemId}/adjust`, { quantity, note });
  },

  async setThreshold(itemId: number, threshold: number): Promise<InventoryItem> {
    return api.patch<InventoryItem>(`/inventory/${itemId}/threshold`, { threshold });
  },

  async getLogs(itemId?: number, limit = 30): Promise<InventoryLog[]> {
    const q = itemId ? `?item_id=${itemId}&limit=${limit}` : `?limit=${limit}`;
    return api.get<InventoryLog[]>(`/inventory/logs${q}`);
  },
};
