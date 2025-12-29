
-- Add columns for deeper analysis (Shipping, Seller Status, Official Store)
ALTER TABLE ml_products 
ADD COLUMN IF NOT EXISTS shipping_free_shipping BOOLEAN,
ADD COLUMN IF NOT EXISTS logistic_type TEXT, -- fulfillment, cross_docking, etc.
ADD COLUMN IF NOT EXISTS official_store_id INTEGER,
ADD COLUMN IF NOT EXISTS seller_power_seller_status TEXT; -- platinum, gold, etc.

-- Indexes for these new analysis columns
CREATE INDEX IF NOT EXISTS idx_ml_products_official_store ON ml_products(official_store_id);
CREATE INDEX IF NOT EXISTS idx_ml_products_logistic_type ON ml_products(logistic_type);
