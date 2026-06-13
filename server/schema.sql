-- Purefect Water Station - MariaDB Schema

CREATE TABLE IF NOT EXISTS system_settings (
  setting_id     INT AUTO_INCREMENT PRIMARY KEY,
  delivery_price DECIMAL(10,2) NOT NULL DEFAULT 45.00,
  walkin_price   DECIMAL(10,2) NOT NULL DEFAULT 40.00,
  updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
INSERT IGNORE INTO system_settings (setting_id, delivery_price, walkin_price) VALUES (1, 45.00, 40.00);

CREATE TABLE IF NOT EXISTS customers (
  customer_id   INT AUTO_INCREMENT PRIMARY KEY,
  customer_name VARCHAR(100) NOT NULL,
  phone_number  VARCHAR(20)  NOT NULL UNIQUE,
  address       TEXT         NOT NULL,
  is_verified   TINYINT(1)   NOT NULL DEFAULT 0,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS riders (
  rider_id     INT AUTO_INCREMENT PRIMARY KEY,
  rider_name   VARCHAR(100) NOT NULL,
  phone_number VARCHAR(20),
  is_active    TINYINT(1) NOT NULL DEFAULT 1,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
  order_id        INT AUTO_INCREMENT PRIMARY KEY,
  customer_id     INT,
  order_type      VARCHAR(10)   NOT NULL,
  unit_price      DECIMAL(10,2) NOT NULL,
  quantity        INT           NOT NULL,
  total_amount    DECIMAL(10,2) NOT NULL,
  payment_type    VARCHAR(10)   NOT NULL,
  delivery_status VARCHAR(10)   NOT NULL DEFAULT 'COMPLETED',
  remarks         TEXT,
  rider_id        INT,
  receipt_no      VARCHAR(50),
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE SET NULL,
  FOREIGN KEY (rider_id)    REFERENCES riders(rider_id)    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS credits (
  credit_id         INT AUTO_INCREMENT PRIMARY KEY,
  customer_id       INT NOT NULL,
  order_id          INT NOT NULL,
  amount            DECIMAL(10,2) NOT NULL,
  remaining_balance DECIMAL(10,2) NOT NULL,
  status            VARCHAR(10) NOT NULL DEFAULT 'UNPAID',
  due_date          DATE,
  updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE RESTRICT,
  FOREIGN KEY (order_id)    REFERENCES orders(order_id)    ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS users (
  user_id    INT AUTO_INCREMENT PRIMARY KEY,
  email      VARCHAR(100) NOT NULL UNIQUE,
  password   VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
