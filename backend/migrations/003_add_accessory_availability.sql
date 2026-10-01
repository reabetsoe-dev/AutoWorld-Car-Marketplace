ALTER TABLE cars
ADD COLUMN IF NOT EXISTS availability_status text NOT NULL DEFAULT 'readily_available';

ALTER TABLE cars
DROP CONSTRAINT IF EXISTS cars_availability_status_check;

ALTER TABLE cars
ADD CONSTRAINT cars_availability_status_check
CHECK (availability_status IN ('readily_available', 'on_order'));

CREATE INDEX IF NOT EXISTS idx_cars_accessory_availability_created
ON cars (category, availability_status, created_at DESC);
