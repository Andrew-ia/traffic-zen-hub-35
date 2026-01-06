
-- Migration to add Replenishment fields to products table

ALTER TABLE products
ADD COLUMN IF NOT EXISTS stock_cover_days DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS replenishment_suggestion INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_replenishment_calc_at TIMESTAMP WITH TIME ZONE;
