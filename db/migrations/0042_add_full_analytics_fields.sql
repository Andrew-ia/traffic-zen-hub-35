
-- Migration to add Full Analytics fields to products table

ALTER TABLE products
ADD COLUMN IF NOT EXISTS classification VARCHAR(10), -- A, B, C, D
ADD COLUMN IF NOT EXISTS recommendation TEXT,
ADD COLUMN IF NOT EXISTS ml_logistic_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS revenue_30d DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS sales_30d INTEGER DEFAULT 0, -- Distinct from lifetime sold_quantity
ADD COLUMN IF NOT EXISTS impressions_30d INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS clicks_30d INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS conversion_rate_30d DECIMAL(5,4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS ads_active BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ml_tax_rate DECIMAL(5,4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS fixed_fee DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS overhead_cost DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS cac DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS ml_full_stock INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS profit_unit DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_analyzed_at TIMESTAMP WITH TIME ZONE;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_products_classification ON products(classification);
CREATE INDEX IF NOT EXISTS idx_products_logistic_type ON products(ml_logistic_type);
