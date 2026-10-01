ALTER TABLE cars
ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'car';

ALTER TABLE cars
DROP CONSTRAINT IF EXISTS cars_category_check;

ALTER TABLE cars
ADD CONSTRAINT cars_category_check
CHECK (category IN ('car', 'bakkie', 'motorcycle', 'commercial', 'accessory'));

CREATE INDEX IF NOT EXISTS idx_cars_category_status_created
ON cars (category, is_sold, created_at DESC);
