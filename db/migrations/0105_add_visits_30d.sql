-- Add demand metrics to products (visits + conversion)

ALTER TABLE products
ADD COLUMN IF NOT EXISTS visits_30d INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS conversion_rate_30d DECIMAL(10,4) DEFAULT 0;
