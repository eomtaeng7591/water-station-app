import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { orderService } from './orderService';
import { OrderInput } from '../types';

const isNative = Platform.OS !== 'web';
let db: any = null;

if (isNative) {
  const SQLite = require('expo-sqlite');
  db = SQLite.openDatabaseSync('waterstation_offline.db');
}

// ─── 초기화 ──────────────────────────────────────────
export function initOfflineDB(): Promise<void> {
  if (!isNative || !db) return Promise.resolve();
  try {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS pending_orders (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        payload       TEXT    NOT NULL,
        created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
        retry_count   INTEGER NOT NULL DEFAULT 0,
        last_error    TEXT
      );
      CREATE TABLE IF NOT EXISTS settings_cache (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        ts    TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS customers_cache (
        customer_id   INTEGER PRIMARY KEY,
        customer_name TEXT NOT NULL,
        phone_number  TEXT NOT NULL,
        address       TEXT NOT NULL,
        ts            TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    return Promise.resolve();
  } catch (e) {
    return Promise.reject(e);
  }
}

// ─── 오프라인 주문 저장 ───────────────────────────────
export function enqueueOrder(input: OrderInput): Promise<void> {
  if (!isNative || !db) return Promise.resolve();
  try {
    db.runSync(
      `INSERT INTO pending_orders (payload) VALUES (?)`,
      [JSON.stringify(input)]
    );
    return Promise.resolve();
  } catch (e) {
    return Promise.reject(e);
  }
}

// ─── 큐 조회 ─────────────────────────────────────────
export function getPendingOrders(): Promise<Array<{ id: number; payload: OrderInput; retry_count: number }>> {
  if (!isNative || !db) return Promise.resolve([]);
  try {
    const rows = db.getAllSync(
      `SELECT id, payload, retry_count FROM pending_orders ORDER BY created_at ASC`
    );
    return Promise.resolve(
      rows.map((r: any) => ({ id: r.id, payload: JSON.parse(r.payload), retry_count: r.retry_count }))
    );
  } catch {
    return Promise.resolve([]);
  }
}

function deletePendingOrder(id: number): Promise<void> {
  if (!db) return Promise.resolve();
  try {
    db.runSync(`DELETE FROM pending_orders WHERE id = ?`, [id]);
    return Promise.resolve();
  } catch (e) {
    return Promise.reject(e);
  }
}

function incrementRetry(id: number, error: string): Promise<void> {
  if (!db) return Promise.resolve();
  try {
    db.runSync(
      `UPDATE pending_orders SET retry_count = retry_count + 1, last_error = ? WHERE id = ?`,
      [error, id]
    );
    return Promise.resolve();
  } catch {
    return Promise.resolve();
  }
}

// ─── 설정 캐시 ────────────────────────────────────────
export function cacheSettings(deliveryPrice: number, walkinPrice: number): Promise<void> {
  if (!isNative || !db) return Promise.resolve();
  try {
    db.runSync(`INSERT OR REPLACE INTO settings_cache (key, value) VALUES ('delivery_price', ?)`, [String(deliveryPrice)]);
    db.runSync(`INSERT OR REPLACE INTO settings_cache (key, value) VALUES ('walkin_price', ?)`, [String(walkinPrice)]);
    return Promise.resolve();
  } catch {
    return Promise.resolve();
  }
}

export function getCachedSettings(): Promise<{ delivery_price: number; walkin_price: number }> {
  if (!isNative || !db) return Promise.resolve({ delivery_price: 45, walkin_price: 40 });
  try {
    const rows = db.getAllSync(
      `SELECT key, value FROM settings_cache WHERE key IN ('delivery_price', 'walkin_price')`
    );
    const map: Record<string, string> = {};
    rows.forEach((r: any) => { map[r.key] = r.value; });
    return Promise.resolve({
      delivery_price: parseFloat(map['delivery_price'] ?? '45'),
      walkin_price: parseFloat(map['walkin_price'] ?? '40'),
    });
  } catch {
    return Promise.resolve({ delivery_price: 45, walkin_price: 40 });
  }
}

// ─── 고객 캐시 ────────────────────────────────────────
export function cacheCustomers(customers: Array<{ customer_id: number; customer_name: string; phone_number: string; address: string }>): Promise<void> {
  if (!isNative || !db) return Promise.resolve();
  try {
    db.withTransactionSync(() => {
      customers.forEach(c => {
        db.runSync(
          `INSERT OR REPLACE INTO customers_cache (customer_id, customer_name, phone_number, address) VALUES (?,?,?,?)`,
          [c.customer_id, c.customer_name, c.phone_number, c.address]
        );
      });
    });
    return Promise.resolve();
  } catch {
    return Promise.resolve();
  }
}

export function searchCachedCustomers(query: string): Promise<Array<{ customer_id: number; customer_name: string; phone_number: string; address: string }>> {
  if (!isNative || !db) return Promise.resolve([]);
  try {
    const rows = db.getAllSync(
      `SELECT * FROM customers_cache WHERE customer_name LIKE ? OR phone_number LIKE ? LIMIT 20`,
      [`%${query}%`, `%${query}%`]
    );
    return Promise.resolve(rows);
  } catch {
    return Promise.resolve([]);
  }
}

// ─── 동기화 ────────────────────────────────────────────
export async function syncPendingOrders(): Promise<{ synced: number; failed: number }> {
  const netState = await NetInfo.fetch();
  if (!netState.isConnected) return { synced: 0, failed: 0 };

  const pending = await getPendingOrders();
  let synced = 0, failed = 0;

  for (const item of pending) {
    if (item.retry_count >= 3) { failed++; continue; }
    try {
      await orderService.createOrder(item.payload);
      await deletePendingOrder(item.id);
      synced++;
    } catch (e: any) {
      await incrementRetry(item.id, e.message || 'unknown');
      failed++;
    }
  }

  return { synced, failed };
}

export function getPendingCount(): Promise<number> {
  if (!isNative || !db) return Promise.resolve(0);
  try {
    const row = db.getFirstSync(`SELECT COUNT(*) as cnt FROM pending_orders`);
    return Promise.resolve(row?.cnt ?? 0);
  } catch {
    return Promise.resolve(0);
  }
}
