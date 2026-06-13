/**
 * 오프라인 캐싱 레이어
 * - expo-sqlite로 로컬 DB 관리
 * - 네트워크 없을 때 주문을 pending_queue에 저장
 * - 네트워크 복구 시 자동으로 Supabase에 업로드 (sync)
 */
import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { orderService } from './orderService';
import { OrderInput } from '../types';

// expo-sqlite는 네이티브 전용 — 웹에서는 no-op으로 동작
const isNative = Platform.OS !== 'web';
let db: any = null;
if (isNative) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const SQLite = require('expo-sqlite');
  db = SQLite.openDatabase('waterstation_offline.db');
}

// ─── 초기화 ──────────────────────────────────────────
export function initOfflineDB(): Promise<void> {
  if (!isNative) return Promise.resolve();
  return new Promise((resolve, reject) => {
    db.transaction((tx: any) => {
      // 오프라인 주문 큐
      tx.executeSql(`
        CREATE TABLE IF NOT EXISTS pending_orders (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          payload       TEXT    NOT NULL,
          created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
          retry_count   INTEGER NOT NULL DEFAULT 0,
          last_error    TEXT
        )
      `);
      // 설정 캐시 (단가 등)
      tx.executeSql(`
        CREATE TABLE IF NOT EXISTS settings_cache (
          key   TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          ts    TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);
      // 고객 캐시 (검색용)
      tx.executeSql(`
        CREATE TABLE IF NOT EXISTS customers_cache (
          customer_id   INTEGER PRIMARY KEY,
          customer_name TEXT NOT NULL,
          phone_number  TEXT NOT NULL,
          address       TEXT NOT NULL,
          ts            TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);
    },
    reject,
    () => resolve());
  });
}

// ─── 오프라인 주문 저장 ───────────────────────────────
export function enqueueOrder(input: OrderInput): Promise<void> {
  if (!isNative) return Promise.resolve();
  return new Promise((resolve, reject) => {
    db.transaction((tx: any) => {
      tx.executeSql(
        `INSERT INTO pending_orders (payload) VALUES (?)`,
        [JSON.stringify(input)],
        () => resolve(),
        (_: any, e: any) => { reject(e); return false; }
      );
    });
  });
}

// ─── 큐 조회 ─────────────────────────────────────────
export function getPendingOrders(): Promise<Array<{ id: number; payload: OrderInput; retry_count: number }>> {
  if (!isNative) return Promise.resolve([]);
  return new Promise((resolve, reject) => {
    db.transaction((tx: any) => {
      tx.executeSql(
        `SELECT id, payload, retry_count FROM pending_orders ORDER BY created_at ASC`,
        [],
        (_: any, result: any) => {
          const rows = [];
          for (let i = 0; i < result.rows.length; i++) {
            const r = result.rows.item(i);
            rows.push({ id: r.id, payload: JSON.parse(r.payload), retry_count: r.retry_count });
          }
          resolve(rows);
        },
        (_: any, e: any) => { reject(e); return false; }
      );
    });
  });
}

function deletePendingOrder(id: number): Promise<void> {
  return new Promise((resolve, reject) => {
    db.transaction((tx: any) => {
      tx.executeSql(`DELETE FROM pending_orders WHERE id = ?`, [id],
        () => resolve(),
        (_: any, e: any) => { reject(e); return false; }
      );
    });
  });
}

function incrementRetry(id: number, error: string): Promise<void> {
  return new Promise((resolve) => {
    db.transaction((tx: any) => {
      tx.executeSql(
        `UPDATE pending_orders SET retry_count = retry_count + 1, last_error = ? WHERE id = ?`,
        [error, id]
      );
    }, undefined, resolve);
  });
}

// ─── 설정 캐시 ────────────────────────────────────────
export function cacheSettings(deliveryPrice: number, walkinPrice: number): Promise<void> {
  if (!isNative) return Promise.resolve();
  return new Promise((resolve) => {
    db.transaction((tx: any) => {
      tx.executeSql(`INSERT OR REPLACE INTO settings_cache (key, value) VALUES ('delivery_price', ?)`, [String(deliveryPrice)]);
      tx.executeSql(`INSERT OR REPLACE INTO settings_cache (key, value) VALUES ('walkin_price', ?)`, [String(walkinPrice)]);
    }, undefined, resolve);
  });
}

export function getCachedSettings(): Promise<{ delivery_price: number; walkin_price: number }> {
  if (!isNative) return Promise.resolve({ delivery_price: 45, walkin_price: 40 });
  return new Promise((resolve) => {
    db.transaction((tx: any) => {
      tx.executeSql(
        `SELECT key, value FROM settings_cache WHERE key IN ('delivery_price', 'walkin_price')`,
        [],
        (_: any, result: any) => {
          const map: Record<string, string> = {};
          for (let i = 0; i < result.rows.length; i++) {
            const r = result.rows.item(i);
            map[r.key] = r.value;
          }
          resolve({
            delivery_price: parseFloat(map['delivery_price'] ?? '45'),
            walkin_price: parseFloat(map['walkin_price'] ?? '40'),
          });
        }
      );
    });
  });
}

// ─── 고객 캐시 ────────────────────────────────────────
export function cacheCustomers(customers: Array<{ customer_id: number; customer_name: string; phone_number: string; address: string }>): Promise<void> {
  if (!isNative) return Promise.resolve();
  return new Promise((resolve) => {
    db.transaction((tx: any) => {
      customers.forEach(c => {
        tx.executeSql(
          `INSERT OR REPLACE INTO customers_cache (customer_id, customer_name, phone_number, address) VALUES (?,?,?,?)`,
          [c.customer_id, c.customer_name, c.phone_number, c.address]
        );
      });
    }, undefined, resolve);
  });
}

export function searchCachedCustomers(query: string): Promise<Array<{ customer_id: number; customer_name: string; phone_number: string; address: string }>> {
  if (!isNative) return Promise.resolve([]);
  return new Promise((resolve) => {
    db.transaction((tx: any) => {
      tx.executeSql(
        `SELECT * FROM customers_cache WHERE customer_name LIKE ? OR phone_number LIKE ? LIMIT 20`,
        [`%${query}%`, `%${query}%`],
        (_: any, result: any) => {
          const rows = [];
          for (let i = 0; i < result.rows.length; i++) rows.push(result.rows.item(i));
          resolve(rows);
        }
      );
    });
  });
}

// ─── 동기화 (핵심) ────────────────────────────────────
/**
 * syncPendingOrders()
 * 네트워크 연결 시 호출 — 큐에 쌓인 주문을 순서대로 Supabase에 업로드합니다.
 * 실패 시 retry_count 증가, 3회 초과 시 건너뜁니다.
 */
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

// 큐에 남은 개수
export function getPendingCount(): Promise<number> {
  if (!isNative) return Promise.resolve(0);
  return new Promise((resolve) => {
    db.transaction((tx: any) => {
      tx.executeSql(`SELECT COUNT(*) as cnt FROM pending_orders`, [],
        (_: any, result: any) => resolve(result.rows.item(0).cnt)
      );
    });
  });
}
