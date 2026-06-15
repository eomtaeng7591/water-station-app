-- =====================================================
-- Purefect Water Station DB Schema v1.0
-- PostgreSQL (Supabase)
-- =====================================================

-- 1. system_settings: 매장 단가 정책
CREATE TABLE IF NOT EXISTS system_settings (
  setting_id   SERIAL PRIMARY KEY,
  delivery_price DECIMAL(10,2) NOT NULL DEFAULT 45.00,
  walkin_price   DECIMAL(10,2) NOT NULL DEFAULT 40.00,
  updated_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 초기 단가 데이터 삽입
INSERT INTO system_settings (delivery_price, walkin_price)
VALUES (45.00, 40.00)
ON CONFLICT DO NOTHING;

-- 2. customers: 고객 정보
CREATE TABLE IF NOT EXISTS customers (
  customer_id   SERIAL PRIMARY KEY,
  customer_name VARCHAR(100) NOT NULL,
  phone_number  VARCHAR(20)  NOT NULL UNIQUE,
  address       TEXT         NOT NULL,
  is_verified   BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone_number);
CREATE INDEX IF NOT EXISTS idx_customers_name  ON customers(customer_name);

-- 3. orders: 주문 및 판매 기록
CREATE TABLE IF NOT EXISTS orders (
  order_id        SERIAL PRIMARY KEY,
  customer_id     INTEGER REFERENCES customers(customer_id) ON DELETE SET NULL,
  order_type      VARCHAR(10)    NOT NULL CHECK (order_type IN ('WALK-IN','DELIVERY')),
  unit_price      DECIMAL(10,2)  NOT NULL,
  quantity        INTEGER        NOT NULL CHECK (quantity > 0),
  total_amount    DECIMAL(10,2)  NOT NULL,
  payment_type    VARCHAR(10)    NOT NULL CHECK (payment_type IN ('CASH','E-WALLET','CREDIT')),
  delivery_status VARCHAR(10)    NOT NULL DEFAULT 'COMPLETED' CHECK (delivery_status IN ('PENDING','COMPLETED')),
  remarks         TEXT,
  -- 확장 예약 컬럼 (Phase 2 이후 활성화)
  rider_id        INTEGER,        -- 라이더 배정 (추후 riders 테이블 FK)
  receipt_no      VARCHAR(50),    -- 영수증 번호
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_customer    ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at  ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_type        ON orders(order_type);
CREATE INDEX IF NOT EXISTS idx_orders_payment     ON orders(payment_type);

-- 4. credits: 외상(Utang) 관리
CREATE TABLE IF NOT EXISTS credits (
  credit_id         SERIAL PRIMARY KEY,
  customer_id       INTEGER NOT NULL REFERENCES customers(customer_id) ON DELETE RESTRICT,
  order_id          INTEGER NOT NULL REFERENCES orders(order_id) ON DELETE RESTRICT,
  amount            DECIMAL(10,2) NOT NULL,
  remaining_balance DECIMAL(10,2) NOT NULL,
  status            VARCHAR(10) NOT NULL DEFAULT 'UNPAID' CHECK (status IN ('UNPAID','PARTIAL','PAID')),
  -- 확장 예약 컬럼
  due_date          DATE,           -- 외상 만기일 (추후 활성화)
  updated_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credits_customer ON credits(customer_id);
CREATE INDEX IF NOT EXISTS idx_credits_status   ON credits(status);
CREATE INDEX IF NOT EXISTS idx_credits_order    ON credits(order_id);

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- updated_at 자동 갱신 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- system_settings updated_at 트리거
CREATE TRIGGER trg_system_settings_updated_at
  BEFORE UPDATE ON system_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- credits updated_at 트리거
CREATE TRIGGER trg_credits_updated_at
  BEFORE UPDATE ON credits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 외상 상태 자동 전환 함수
CREATE OR REPLACE FUNCTION update_credit_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.remaining_balance <= 0 THEN
    NEW.remaining_balance := 0;
    NEW.status := 'PAID';
  ELSIF NEW.remaining_balance < NEW.amount THEN
    NEW.status := 'PARTIAL';
  ELSE
    NEW.status := 'UNPAID';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_credit_status_update
  BEFORE UPDATE ON credits
  FOR EACH ROW EXECUTE FUNCTION update_credit_status();

-- =====================================================
-- VIEWS
-- =====================================================

-- 고객별 미수금 합계 뷰
CREATE OR REPLACE VIEW customer_outstanding AS
SELECT
  c.customer_id,
  c.customer_name,
  c.phone_number,
  COALESCE(SUM(cr.remaining_balance), 0) AS total_outstanding
FROM customers c
LEFT JOIN credits cr ON cr.customer_id = c.customer_id
  AND cr.status IN ('UNPAID', 'PARTIAL')
GROUP BY c.customer_id, c.customer_name, c.phone_number;

-- =====================================================
-- ROW LEVEL SECURITY (Supabase)
-- =====================================================

ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders          ENABLE ROW LEVEL SECURITY;
ALTER TABLE credits         ENABLE ROW LEVEL SECURITY;

-- 싱글 어드민 정책: 인증된 유저만 전체 접근
CREATE POLICY "admin_all_settings"  ON system_settings FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "admin_all_customers" ON customers       FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "admin_all_orders"    ON orders          FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "admin_all_credits"   ON credits         FOR ALL USING (auth.role() = 'authenticated');
