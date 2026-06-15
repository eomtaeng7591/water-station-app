-- =====================================================
-- Phase 2: Riders table
-- =====================================================

CREATE TABLE IF NOT EXISTS riders (
  rider_id    SERIAL PRIMARY KEY,
  rider_name  VARCHAR(100) NOT NULL,
  phone_number VARCHAR(20),
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_riders_active ON riders(is_active);

-- riders 테이블 FK 활성화
ALTER TABLE orders
  ADD CONSTRAINT fk_orders_rider
  FOREIGN KEY (rider_id) REFERENCES riders(rider_id) ON DELETE SET NULL;

-- RLS
ALTER TABLE riders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_riders" ON riders FOR ALL USING (auth.role() = 'authenticated');
