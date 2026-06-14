require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const pool = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET;

// ── Auth 미들웨어 ──────────────────────────────────────
function auth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ── 헬퍼: 오늘 날짜 receipt_no 생성 ──────────────────
async function generateReceiptNo() {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const [rows] = await pool.query(
    'SELECT COUNT(*) as cnt FROM orders WHERE DATE(created_at) = CURDATE()'
  );
  const seq = String(rows[0].cnt + 1).padStart(3, '0');
  return `PWS-${dateStr}-${seq}`;
}

// ═══════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════

// 회원가입
app.post('/auth/signup', async (req, res) => {
  const { email, password } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  try {
    await pool.query('INSERT INTO users (email, password) VALUES (?, ?)', [email, hashed]);
    res.json({ message: 'ok' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// 로그인
app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
  if (!rows.length) return res.status(401).json({ error: 'Invalid email or password.' });
  const valid = await bcrypt.compare(password, rows[0].password);
  if (!valid) return res.status(401).json({ error: 'Invalid email or password.' });
  const token = jwt.sign({ user_id: rows[0].user_id, email }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, email });
});

// ═══════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════

app.get('/settings', auth, async (_req, res) => {
  const [rows] = await pool.query('SELECT * FROM system_settings LIMIT 1');
  res.json(rows[0] || { delivery_price: 45, walkin_price: 40 });
});

app.put('/settings', auth, async (req, res) => {
  const { delivery_price, walkin_price, daily_target, monthly_target } = req.body;
  await pool.query(
    `UPDATE system_settings
     SET delivery_price = ?, walkin_price = ?,
         daily_target = COALESCE(?, daily_target),
         monthly_target = COALESCE(?, monthly_target)
     WHERE setting_id = 1`,
    [delivery_price, walkin_price,
     daily_target !== undefined ? daily_target : null,
     monthly_target !== undefined ? monthly_target : null]
  );
  const [rows] = await pool.query('SELECT * FROM system_settings WHERE setting_id = 1');
  res.json(rows[0]);
});

app.patch('/settings/targets', auth, async (req, res) => {
  const { daily_target, monthly_target } = req.body;
  await pool.query(
    'UPDATE system_settings SET daily_target = ?, monthly_target = ? WHERE setting_id = 1',
    [daily_target ?? 0, monthly_target ?? 0]
  );
  const [rows] = await pool.query('SELECT * FROM system_settings WHERE setting_id = 1');
  res.json(rows[0]);
});

app.get('/targets/progress', auth, async (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  const yearMonth = date.slice(0, 7);

  const [[settings]] = await pool.query('SELECT daily_target, monthly_target FROM system_settings WHERE setting_id = 1');
  const [[dayRow]]   = await pool.query(
    'SELECT COALESCE(SUM(total_amount),0) as total FROM orders WHERE DATE(created_at) = ?', [date]
  );
  const [[monRow]]   = await pool.query(
    "SELECT COALESCE(SUM(total_amount),0) as total FROM orders WHERE DATE_FORMAT(created_at,'%Y-%m') = ?", [yearMonth]
  );

  res.json({
    daily_target:    Number(settings.daily_target),
    monthly_target:  Number(settings.monthly_target),
    daily_actual:    Number(dayRow.total),
    monthly_actual:  Number(monRow.total),
    daily_pct:       settings.daily_target > 0
      ? Math.min(100, (Number(dayRow.total) / Number(settings.daily_target)) * 100) : 0,
    monthly_pct:     settings.monthly_target > 0
      ? Math.min(100, (Number(monRow.total) / Number(settings.monthly_target)) * 100) : 0,
  });
});

// ═══════════════════════════════════════════════════════
// CUSTOMERS
// ═══════════════════════════════════════════════════════

app.get('/customers', auth, async (req, res) => {
  const q = req.query.search || '';
  const [rows] = await pool.query(`
    SELECT c.*,
      COUNT(o.order_id)             AS total_orders,
      COALESCE(SUM(o.total_amount), 0) AS total_spend,
      COALESCE((
        SELECT SUM(cr.remaining_balance) FROM credits cr
        WHERE cr.customer_id = c.customer_id AND cr.status IN ('UNPAID','PARTIAL')
      ), 0) AS total_outstanding
    FROM customers c
    LEFT JOIN orders o ON o.customer_id = c.customer_id
    WHERE c.customer_name LIKE ? OR c.phone_number LIKE ?
    GROUP BY c.customer_id
    ORDER BY c.customer_name
    LIMIT 50
  `, [`%${q}%`, `%${q}%`]);
  res.json(rows.map(r => ({
    ...r,
    total_orders:      Number(r.total_orders),
    total_spend:       Number(r.total_spend),
    total_outstanding: Number(r.total_outstanding),
    tags: r.tags ? JSON.parse(r.tags) : [],
  })));
});

app.post('/customers', auth, async (req, res) => {
  try {
    await pool.query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT NULL`);
    await pool.query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS tags TEXT DEFAULT NULL`);
  } catch (_) {}
  const { customer_name, phone_number, address, notes, tags } = req.body;
  const tagsJson = tags ? JSON.stringify(tags) : null;
  const [result] = await pool.query(
    'INSERT INTO customers (customer_name, phone_number, address, notes, tags) VALUES (?, ?, ?, ?, ?)',
    [customer_name, phone_number, address, notes || null, tagsJson]
  );
  const [rows] = await pool.query('SELECT * FROM customers WHERE customer_id = ?', [result.insertId]);
  const row = rows[0];
  res.json({ ...row, tags: row.tags ? JSON.parse(row.tags) : [] });
});

app.get('/customers/:id', auth, async (req, res) => {
  const [rows] = await pool.query(`
    SELECT c.*,
      COUNT(o.order_id)             AS total_orders,
      COALESCE(SUM(o.total_amount), 0) AS total_spend,
      COALESCE((
        SELECT SUM(cr.remaining_balance) FROM credits cr
        WHERE cr.customer_id = c.customer_id AND cr.status IN ('UNPAID','PARTIAL')
      ), 0) AS total_outstanding
    FROM customers c
    LEFT JOIN orders o ON o.customer_id = c.customer_id
    WHERE c.customer_id = ?
    GROUP BY c.customer_id
  `, [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Not found' });
  const r = rows[0];
  res.json({
    ...r,
    total_orders:      Number(r.total_orders),
    total_spend:       Number(r.total_spend),
    total_outstanding: Number(r.total_outstanding),
    tags: r.tags ? JSON.parse(r.tags) : [],
  });
});

app.patch('/customers/:id', auth, async (req, res) => {
  try {
    await pool.query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT NULL`);
    await pool.query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS tags TEXT DEFAULT NULL`);
  } catch (_) {}
  const { customer_name, phone_number, address, notes, tags } = req.body;
  const tagsJson = tags !== undefined ? JSON.stringify(tags) : undefined;
  const fields = [];
  const vals = [];
  if (customer_name !== undefined) { fields.push('customer_name = ?'); vals.push(customer_name); }
  if (phone_number  !== undefined) { fields.push('phone_number = ?');  vals.push(phone_number); }
  if (address       !== undefined) { fields.push('address = ?');       vals.push(address); }
  if (notes         !== undefined) { fields.push('notes = ?');         vals.push(notes || null); }
  if (tagsJson      !== undefined) { fields.push('tags = ?');          vals.push(tagsJson); }
  if (fields.length) {
    vals.push(req.params.id);
    await pool.query(`UPDATE customers SET ${fields.join(', ')} WHERE customer_id = ?`, vals);
  }
  const [rows] = await pool.query('SELECT * FROM customers WHERE customer_id = ?', [req.params.id]);
  const row = rows[0];
  res.json({ ...row, tags: row.tags ? JSON.parse(row.tags) : [] });
});

app.delete('/customers/:id', auth, async (req, res) => {
  await pool.query('DELETE FROM customers WHERE customer_id = ?', [req.params.id]);
  res.json({ message: 'ok' });
});

// ═══════════════════════════════════════════════════════
// ORDERS
// ═══════════════════════════════════════════════════════

app.get('/orders/by-date', auth, async (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  const [rows] = await pool.query(`
    SELECT o.*, c.customer_name, c.phone_number, c.address
    FROM orders o
    LEFT JOIN customers c ON o.customer_id = c.customer_id
    WHERE DATE(o.created_at) = ?
    ORDER BY o.created_at DESC
  `, [date]);
  res.json(rows.map(r => ({
    ...r,
    customer: r.customer_name ? { customer_id: r.customer_id, customer_name: r.customer_name, phone_number: r.phone_number, address: r.address } : null,
  })));
});

app.get('/orders/today', auth, async (_req, res) => {
  const [rows] = await pool.query(`
    SELECT o.*, c.customer_name, c.phone_number, c.address
    FROM orders o
    LEFT JOIN customers c ON o.customer_id = c.customer_id
    WHERE DATE(o.created_at) = CURDATE()
    ORDER BY o.created_at DESC
  `);
  res.json(rows.map(r => ({
    ...r,
    customer: r.customer_name ? { customer_id: r.customer_id, customer_name: r.customer_name, phone_number: r.phone_number, address: r.address } : null,
  })));
});

app.get('/orders/pending', auth, async (_req, res) => {
  const [rows] = await pool.query(`
    SELECT o.*, c.customer_name, c.phone_number, c.address
    FROM orders o
    LEFT JOIN customers c ON o.customer_id = c.customer_id
    WHERE o.order_type = 'DELIVERY' AND o.delivery_status = 'PENDING'
    ORDER BY o.created_at DESC
  `);
  res.json(rows.map(r => ({
    ...r,
    customer: r.customer_name ? { customer_id: r.customer_id, customer_name: r.customer_name, phone_number: r.phone_number, address: r.address } : null,
  })));
});

app.get('/orders/customer/:id', auth, async (req, res) => {
  const [rows] = await pool.query(
    'SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC LIMIT 30',
    [req.params.id]
  );
  res.json(rows);
});

app.post('/orders', auth, async (req, res) => {
  const { customer_id, order_type, unit_price, quantity, total_amount, payment_type, delivery_status, remarks, gcash_ref, rider_id, due_date } = req.body;
  const receipt_no = await generateReceiptNo();
  const [result] = await pool.query(
    `INSERT INTO orders (customer_id, order_type, unit_price, quantity, total_amount, payment_type, delivery_status, remarks, gcash_ref, rider_id, receipt_no)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [customer_id || null, order_type, unit_price, quantity, total_amount, payment_type, delivery_status, remarks || null, gcash_ref || null, rider_id || null, receipt_no]
  );
  const order_id = result.insertId;

  if (payment_type === 'CREDIT' && customer_id) {
    await pool.query(
      'INSERT INTO credits (customer_id, order_id, amount, remaining_balance, status, due_date) VALUES (?, ?, ?, ?, "UNPAID", ?)',
      [customer_id, order_id, total_amount, total_amount, due_date || null]
    );
  }

  // auto-decrement filled gallon inventory
  await pool.query(
    'UPDATE inventory SET current_stock = GREATEST(current_stock - ?, 0) WHERE item_id = 1',
    [quantity]
  );
  await pool.query(
    'INSERT INTO inventory_logs (item_id, change_type, quantity, note) VALUES (1, "SALE", ?, ?)',
    [quantity, `Order ${receipt_no}`]
  );

  const [rows] = await pool.query(
    `SELECT o.*, c.customer_name, c.phone_number, c.address
     FROM orders o LEFT JOIN customers c ON o.customer_id = c.customer_id
     WHERE o.order_id = ?`, [order_id]
  );
  const r = rows[0];
  res.json({
    ...r,
    customer: r.customer_name ? { customer_id: r.customer_id, customer_name: r.customer_name, phone_number: r.phone_number, address: r.address } : null,
  });
});

app.patch('/orders/:id/status', auth, async (req, res) => {
  const { delivery_status } = req.body;
  await pool.query('UPDATE orders SET delivery_status = ? WHERE order_id = ?', [delivery_status, req.params.id]);
  res.json({ message: 'ok' });
});

app.delete('/orders/:id', auth, async (req, res) => {
  const [orderRows] = await pool.query('SELECT quantity, receipt_no FROM orders WHERE order_id = ?', [req.params.id]);
  await pool.query('DELETE FROM credits WHERE order_id = ?', [req.params.id]);
  await pool.query('DELETE FROM orders WHERE order_id = ?', [req.params.id]);
  if (orderRows.length) {
    const { quantity, receipt_no } = orderRows[0];
    await pool.query('UPDATE inventory SET current_stock = current_stock + ? WHERE item_id = 1', [quantity]);
    await pool.query(
      'INSERT INTO inventory_logs (item_id, change_type, quantity, note) VALUES (1, "ADJUSTMENT", ?, ?)',
      [quantity, `Restored: deleted ${receipt_no}`]
    );
  }
  res.json({ message: 'ok' });
});

// ═══════════════════════════════════════════════════════
// INVENTORY
// ═══════════════════════════════════════════════════════

app.get('/inventory', auth, async (_req, res) => {
  const [items] = await pool.query('SELECT * FROM inventory ORDER BY item_id');
  res.json(items.map(i => ({ ...i, current_stock: Number(i.current_stock) })));
});

app.patch('/inventory/:id/restock', auth, async (req, res) => {
  const { quantity, note } = req.body;
  if (!quantity || quantity <= 0) return res.status(400).json({ error: 'Invalid quantity' });
  await pool.query('UPDATE inventory SET current_stock = current_stock + ? WHERE item_id = ?', [quantity, req.params.id]);
  await pool.query(
    'INSERT INTO inventory_logs (item_id, change_type, quantity, note) VALUES (?, "RESTOCK", ?, ?)',
    [req.params.id, quantity, note || null]
  );
  const [rows] = await pool.query('SELECT * FROM inventory WHERE item_id = ?', [req.params.id]);
  res.json({ ...rows[0], current_stock: Number(rows[0].current_stock) });
});

app.patch('/inventory/:id/adjust', auth, async (req, res) => {
  const { quantity, note } = req.body;
  if (quantity === undefined || quantity === 0) return res.status(400).json({ error: 'Invalid quantity' });
  await pool.query(
    'UPDATE inventory SET current_stock = GREATEST(current_stock + ?, 0) WHERE item_id = ?',
    [quantity, req.params.id]
  );
  await pool.query(
    'INSERT INTO inventory_logs (item_id, change_type, quantity, note) VALUES (?, "ADJUSTMENT", ?, ?)',
    [req.params.id, quantity, note || null]
  );
  const [rows] = await pool.query('SELECT * FROM inventory WHERE item_id = ?', [req.params.id]);
  res.json({ ...rows[0], current_stock: Number(rows[0].current_stock) });
});

app.patch('/inventory/:id/threshold', auth, async (req, res) => {
  const { threshold } = req.body;
  await pool.query('UPDATE inventory SET low_stock_threshold = ? WHERE item_id = ?', [threshold, req.params.id]);
  const [rows] = await pool.query('SELECT * FROM inventory WHERE item_id = ?', [req.params.id]);
  res.json({ ...rows[0], current_stock: Number(rows[0].current_stock) });
});

app.get('/inventory/logs', auth, async (req, res) => {
  const limit = parseInt(req.query.limit) || 30;
  const itemId = req.query.item_id ? parseInt(req.query.item_id) : null;
  const where = itemId ? 'WHERE l.item_id = ?' : '';
  const params = itemId ? [itemId, limit] : [limit];
  const [rows] = await pool.query(`
    SELECT l.*, i.item_name, i.unit
    FROM inventory_logs l
    JOIN inventory i ON l.item_id = i.item_id
    ${where}
    ORDER BY l.created_at DESC
    LIMIT ?
  `, params);
  res.json(rows.map(r => ({ ...r, quantity: Number(r.quantity) })));
});

// ═══════════════════════════════════════════════════════
// CREDITS
// ═══════════════════════════════════════════════════════

app.get('/credits/outstanding', auth, async (_req, res) => {
  const [rows] = await pool.query(`
    SELECT cr.*, c.customer_name, c.phone_number
    FROM credits cr
    JOIN customers c ON cr.customer_id = c.customer_id
    WHERE cr.status IN ('UNPAID', 'PARTIAL')
    ORDER BY cr.updated_at DESC
  `);
  res.json(rows.map(r => ({
    ...r,
    customer: { customer_id: r.customer_id, customer_name: r.customer_name, phone_number: r.phone_number },
  })));
});

app.get('/credits/total', auth, async (_req, res) => {
  const [rows] = await pool.query(
    'SELECT COALESCE(SUM(remaining_balance), 0) as total FROM credits WHERE status IN ("UNPAID", "PARTIAL")'
  );
  res.json({ total: rows[0].total });
});

app.get('/credits/customer/:id', auth, async (req, res) => {
  const [rows] = await pool.query(
    'SELECT * FROM credits WHERE customer_id = ? AND status != "PAID" ORDER BY updated_at DESC',
    [req.params.id]
  );
  res.json(rows);
});

app.patch('/credits/:id/collect', auth, async (req, res) => {
  const { amount } = req.body;
  const [rows] = await pool.query('SELECT * FROM credits WHERE credit_id = ?', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Not found' });
  const credit = rows[0];
  const newBalance = Math.max(0, parseFloat(credit.remaining_balance) - parseFloat(amount));
  let newStatus = newBalance <= 0 ? 'PAID' : newBalance < credit.amount ? 'PARTIAL' : 'UNPAID';
  await pool.query(
    'UPDATE credits SET remaining_balance = ?, status = ? WHERE credit_id = ?',
    [newBalance, newStatus, req.params.id]
  );
  const [updated] = await pool.query('SELECT * FROM credits WHERE credit_id = ?', [req.params.id]);
  res.json(updated[0]);
});

// ═══════════════════════════════════════════════════════
// RIDERS
// ═══════════════════════════════════════════════════════

app.get('/riders', auth, async (req, res) => {
  const activeOnly = req.query.active === 'true';
  const [rows] = await pool.query(
    activeOnly
      ? 'SELECT * FROM riders WHERE is_active = 1 ORDER BY rider_name'
      : 'SELECT * FROM riders ORDER BY is_active DESC, rider_name'
  );
  res.json(rows);
});

app.post('/riders', auth, async (req, res) => {
  const { rider_name, phone_number } = req.body;
  const [result] = await pool.query(
    'INSERT INTO riders (rider_name, phone_number) VALUES (?, ?)',
    [rider_name, phone_number || null]
  );
  const [rows] = await pool.query('SELECT * FROM riders WHERE rider_id = ?', [result.insertId]);
  res.json(rows[0]);
});

app.patch('/riders/:id', auth, async (req, res) => {
  const { is_active, rider_name, phone_number } = req.body;
  const fields = [];
  const vals = [];
  if (is_active !== undefined) { fields.push('is_active = ?'); vals.push(is_active ? 1 : 0); }
  if (rider_name  !== undefined) { fields.push('rider_name = ?');   vals.push(rider_name); }
  if (phone_number !== undefined) { fields.push('phone_number = ?'); vals.push(phone_number || null); }
  if (fields.length) {
    vals.push(req.params.id);
    await pool.query(`UPDATE riders SET ${fields.join(', ')} WHERE rider_id = ?`, vals);
  }
  const [rows] = await pool.query('SELECT * FROM riders WHERE rider_id = ?', [req.params.id]);
  res.json(rows[0]);
});

app.delete('/riders/:id', auth, async (req, res) => {
  await pool.query('DELETE FROM riders WHERE rider_id = ?', [req.params.id]);
  res.json({ message: 'ok' });
});

// ═══════════════════════════════════════════════════════
// DASHBOARD (매출 요약)
// ═══════════════════════════════════════════════════════

app.get('/dashboard', auth, async (req, res) => {
  const dateParam = req.query.date;
  const dateFilter = dateParam ? `DATE(created_at) = ?` : `DATE(created_at) = CURDATE()`;
  const dateArgs = dateParam ? [dateParam] : [];

  const [[today]] = await pool.query(`
    SELECT
      COUNT(*) as today_orders,
      COALESCE(SUM(total_amount), 0) as today_revenue,
      COALESCE(SUM(CASE WHEN payment_type = 'CASH'     THEN total_amount ELSE 0 END), 0) as cash_total,
      COALESCE(SUM(CASE WHEN payment_type IN ('E-WALLET','GCASH') THEN total_amount ELSE 0 END), 0) as ewallet_total,
      COALESCE(SUM(CASE WHEN payment_type = 'CREDIT'   THEN total_amount ELSE 0 END), 0) as credit_total,
      COALESCE(SUM(CASE WHEN order_type  = 'DELIVERY'  THEN total_amount ELSE 0 END), 0) as delivery_total,
      COALESCE(SUM(CASE WHEN order_type  = 'WALK-IN'   THEN total_amount ELSE 0 END), 0) as walkin_total,
      COALESCE(SUM(CASE WHEN order_type  = 'DELIVERY'  THEN 1 ELSE 0 END), 0) as delivery_count,
      COALESCE(SUM(CASE WHEN order_type  = 'WALK-IN'   THEN 1 ELSE 0 END), 0) as walkin_count
    FROM orders WHERE ${dateFilter}
  `, dateArgs);
  const [[outstanding]] = await pool.query(
    'SELECT COALESCE(SUM(remaining_balance), 0) as total FROM credits WHERE status IN ("UNPAID", "PARTIAL")'
  );
  res.json({ ...today, outstanding_total: outstanding.total });
});

// ═══════════════════════════════════════════════════════
// REPORTS
// ═══════════════════════════════════════════════════════

app.get('/reports/riders', auth, async (req, res) => {
  const month = req.query.month || new Date().toISOString().slice(0, 7);
  const [rows] = await pool.query(`
    SELECT
      r.rider_id, r.rider_name, r.phone_number, r.is_active,
      COUNT(o.order_id)          as delivery_count,
      COALESCE(SUM(o.total_amount), 0) as delivery_total,
      COALESCE(SUM(CASE WHEN o.delivery_status = 'COMPLETED' THEN 1 ELSE 0 END), 0) as completed_count
    FROM riders r
    LEFT JOIN orders o
      ON o.rider_id = r.rider_id
      AND o.order_type = 'DELIVERY'
      AND DATE_FORMAT(o.created_at, '%Y-%m') = ?
    GROUP BY r.rider_id, r.rider_name, r.phone_number, r.is_active
    ORDER BY delivery_count DESC
  `, [month]);
  res.json(rows.map(r => ({
    ...r,
    delivery_count:  Number(r.delivery_count),
    delivery_total:  Number(r.delivery_total),
    completed_count: Number(r.completed_count),
  })));
});

app.get('/reports/trend', auth, async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 7, 90);
    const [rows] = await pool.query(`
      SELECT
        DATE(created_at) as date,
        COALESCE(SUM(CASE WHEN order_type = 'WALK-IN'  THEN total_amount ELSE 0 END), 0) as walkin,
        COALESCE(SUM(CASE WHEN order_type = 'DELIVERY' THEN total_amount ELSE 0 END), 0) as delivery,
        COALESCE(SUM(total_amount), 0) as total,
        COUNT(*) as order_count
      FROM orders
      WHERE DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL ? - 1 DAY)
      GROUP BY DATE(created_at)
      ORDER BY DATE(created_at) ASC
    `, [days]);

    const byDate = {};
    rows.forEach(r => {
      const key = r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date).slice(0, 10);
      byDate[key] = r;
    });

    const result = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${day}`;
      const row = byDate[dateStr];
      result.push({
        date: dateStr,
        walkin: row ? Number(row.walkin) : 0,
        delivery: row ? Number(row.delivery) : 0,
        total: row ? Number(row.total) : 0,
        order_count: row ? Number(row.order_count) : 0,
      });
    }
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.get('/reports/weekly', auth, async (req, res) => {
  // Monday of current week (MariaDB WEEKDAY: 0=Mon … 6=Sun)
  const [rows] = await pool.query(`
    SELECT
      WEEKDAY(created_at) as dow,
      COALESCE(SUM(CASE WHEN order_type = 'WALK-IN'  THEN total_amount ELSE 0 END), 0) as walkin,
      COALESCE(SUM(CASE WHEN order_type = 'DELIVERY' THEN total_amount ELSE 0 END), 0) as delivery,
      COALESCE(SUM(total_amount), 0) as total
    FROM orders
    WHERE DATE(created_at) BETWEEN
      DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)
      AND DATE_ADD(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 6 DAY)
    GROUP BY WEEKDAY(created_at)
    ORDER BY WEEKDAY(created_at) ASC
  `);

  const byDow = {};
  rows.forEach(r => { byDow[r.dow] = r; });

  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  res.json(labels.map((day, i) => {
    const row = byDow[i];
    return {
      day,
      walkin:   row ? Number(row.walkin)   : 0,
      delivery: row ? Number(row.delivery) : 0,
      total:    row ? Number(row.total)    : 0,
    };
  }));
});

app.get('/reports/monthly', auth, async (req, res) => {
  const year  = parseInt(req.query.year)  || new Date().getFullYear();
  const month = parseInt(req.query.month) || (new Date().getMonth() + 1);

  const [rows] = await pool.query(`
    SELECT
      DATE(created_at) as date,
      COALESCE(SUM(CASE WHEN order_type = 'WALK-IN'  THEN total_amount ELSE 0 END), 0) as walkin_sales,
      COALESCE(SUM(CASE WHEN order_type = 'DELIVERY' THEN total_amount ELSE 0 END), 0) as delivery_sales,
      COALESCE(SUM(total_amount), 0) as daily_total
    FROM orders
    WHERE YEAR(created_at) = ? AND MONTH(created_at) = ?
    GROUP BY DATE(created_at)
    ORDER BY DATE(created_at) ASC
  `, [year, month]);

  const byDate = {};
  rows.forEach(r => { byDate[r.date.toISOString().slice(0, 10)] = r; });

  const daysInMonth = new Date(year, month, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const d = String(i + 1).padStart(2, '0');
    const m = String(month).padStart(2, '0');
    const dateStr = `${year}-${m}-${d}`;
    const row = byDate[dateStr];
    return {
      date: dateStr,
      walkin_sales:   row ? Number(row.walkin_sales)   : 0,
      delivery_sales: row ? Number(row.delivery_sales) : 0,
      daily_total:    row ? Number(row.daily_total)    : 0,
    };
  });

  const walkin_total   = days.reduce((s, d) => s + d.walkin_sales,   0);
  const delivery_total = days.reduce((s, d) => s + d.delivery_sales, 0);
  res.json({ days, walkin_total, delivery_total, grand_total_sales: walkin_total + delivery_total });
});

app.get('/reports/yearly', auth, async (req, res) => {
  const year = parseInt(req.query.year) || new Date().getFullYear();

  const [rows] = await pool.query(`
    SELECT
      MONTH(created_at) as month_num,
      COALESCE(SUM(CASE WHEN order_type = 'WALK-IN'  THEN total_amount ELSE 0 END), 0) as walkin,
      COALESCE(SUM(CASE WHEN order_type = 'DELIVERY' THEN total_amount ELSE 0 END), 0) as delivery,
      COALESCE(SUM(total_amount), 0) as total
    FROM orders
    WHERE YEAR(created_at) = ?
    GROUP BY MONTH(created_at)
    ORDER BY MONTH(created_at) ASC
  `, [year]);

  const byMonth = {};
  rows.forEach(r => { byMonth[r.month_num] = r; });

  const labels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const result = labels.map((label, i) => {
    const row = byMonth[i + 1];
    return {
      month:    label,
      walkin:   row ? Number(row.walkin)   : 0,
      delivery: row ? Number(row.delivery) : 0,
      total:    row ? Number(row.total)    : 0,
    };
  });
  res.json(result);
});

app.get('/reports/daily', auth, async (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  const [orders] = await pool.query(`
    SELECT o.*, c.customer_name, c.phone_number
    FROM orders o
    LEFT JOIN customers c ON o.customer_id = c.customer_id
    WHERE DATE(o.created_at) = ?
    ORDER BY o.created_at ASC
  `, [date]);

  const toNum = v => Number(v) || 0;
  const sum = (filter, field = 'total_amount') =>
    orders.filter(filter).reduce((s, o) => s + toNum(o[field]), 0);

  res.json({
    summary: {
      date,
      order_count: orders.length,
      walkin_total:   sum(o => o.order_type   === 'WALK-IN'),
      delivery_total: sum(o => o.order_type   === 'DELIVERY'),
      cash_total:     sum(o => o.payment_type === 'CASH'),
      ewallet_total:  sum(o => o.payment_type === 'GCASH' || o.payment_type === 'E-WALLET'),
      credit_total:   sum(o => o.payment_type === 'CREDIT'),
      grand_total:    sum(() => true),
    },
    orders: orders.map(o => ({ ...o, customer_name: o.customer_name || 'Walk-in' })),
  });
});

// ═══════════════════════════════════════════════════════
// START
// ═══════════════════════════════════════════════════════

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Purefect API 서버 실행 중: http://0.0.0.0:${PORT}`);
});
