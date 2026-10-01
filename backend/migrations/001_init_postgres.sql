CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS schema_migrations (
  filename text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL UNIQUE,
  email text UNIQUE,
  password_hash text NOT NULL,
  name text NOT NULL,
  role text NOT NULL DEFAULT 'manager' CHECK (role IN ('admin', 'manager', 'editor', 'viewer')),
  is_active boolean NOT NULL DEFAULT true,
  failed_login_attempts integer NOT NULL DEFAULT 0,
  lock_until timestamptz,
  last_login timestamptz,
  password_changed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sellers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_type text NOT NULL CHECK (seller_type IN ('dealer', 'individual')),
  dealership_name text,
  owner_name text,
  contact_person text,
  primary_phone text NOT NULL,
  whatsapp_number text,
  email text,
  district_town text NOT NULL,
  physical_address text,
  private_notes text,
  created_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sellers_required_name CHECK (
    (seller_type = 'dealer' AND dealership_name IS NOT NULL AND btrim(dealership_name) <> '')
    OR
    (seller_type = 'individual' AND owner_name IS NOT NULL AND btrim(owner_name) <> '')
  )
);

CREATE TABLE IF NOT EXISTS cars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  brand text NOT NULL,
  model text,
  year integer CHECK (year IS NULL OR (year >= 1900 AND year <= 2100)),
  price numeric(12, 2) NOT NULL CHECK (price >= 0),
  mileage integer NOT NULL CHECK (mileage >= 0),
  fuel_type text NOT NULL DEFAULT 'other' CHECK (fuel_type IN ('petrol', 'diesel', 'hybrid', 'electric', 'other')),
  transmission text NOT NULL DEFAULT 'other' CHECK (transmission IN ('manual', 'automatic', 'other')),
  description text,
  image_urls text[] NOT NULL DEFAULT ARRAY[]::text[],
  location text,
  is_auction boolean NOT NULL DEFAULT false,
  is_special_offer boolean NOT NULL DEFAULT false,
  is_sold boolean NOT NULL DEFAULT false,
  sold_at timestamptz,
  seller_id uuid REFERENCES sellers(id) ON DELETE SET NULL,
  created_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  admin_user_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  replaced_by_token_hash text,
  created_by_ip text,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_admin_user_id uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  actor_name text,
  actor_username text,
  actor_role text,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sell_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  make text NOT NULL,
  model text NOT NULL,
  year integer NOT NULL CHECK (year >= 1900 AND year <= 2100),
  mileage integer NOT NULL CHECK (mileage >= 0),
  expected_price numeric(12, 2) CHECK (expected_price IS NULL OR expected_price >= 0),
  condition text NOT NULL DEFAULT 'good' CHECK (condition IN ('excellent', 'good', 'fair', 'needs_work')),
  fuel_type text NOT NULL DEFAULT 'petrol' CHECK (fuel_type IN ('petrol', 'diesel', 'hybrid', 'electric')),
  transmission text NOT NULL DEFAULT 'automatic' CHECK (transmission IN ('automatic', 'manual')),
  location text NOT NULL,
  owner_name text NOT NULL,
  phone text NOT NULL,
  email text,
  notes text,
  images jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'contacted', 'converted', 'declined')),
  admin_notes text,
  reviewed_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sellers_type_dealer ON sellers (seller_type, dealership_name, district_town);
CREATE INDEX IF NOT EXISTS idx_sellers_type_owner ON sellers (seller_type, owner_name, primary_phone);
CREATE INDEX IF NOT EXISTS idx_cars_brand_price_mileage_created ON cars (brand, price, mileage, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cars_flags_created ON cars (is_auction, is_special_offer, is_sold, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cars_seller ON cars (seller_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_admin_user ON refresh_tokens (admin_user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens (expires_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_username ON audit_logs (actor_username);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sell_requests_status_created ON sell_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sell_requests_vehicle_status_created ON sell_requests (make, model, status, created_at DESC);

DROP TRIGGER IF EXISTS admin_users_set_updated_at ON admin_users;
CREATE TRIGGER admin_users_set_updated_at
BEFORE UPDATE ON admin_users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS sellers_set_updated_at ON sellers;
CREATE TRIGGER sellers_set_updated_at
BEFORE UPDATE ON sellers
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS cars_set_updated_at ON cars;
CREATE TRIGGER cars_set_updated_at
BEFORE UPDATE ON cars
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS refresh_tokens_set_updated_at ON refresh_tokens;
CREATE TRIGGER refresh_tokens_set_updated_at
BEFORE UPDATE ON refresh_tokens
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS audit_logs_set_updated_at ON audit_logs;
CREATE TRIGGER audit_logs_set_updated_at
BEFORE UPDATE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS sell_requests_set_updated_at ON sell_requests;
CREATE TRIGGER sell_requests_set_updated_at
BEFORE UPDATE ON sell_requests
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
