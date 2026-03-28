CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS ml_market_research_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id TEXT,
    category_id TEXT NOT NULL,
    category_name TEXT,
    subcategory_id TEXT,
    subcategory_name TEXT,
    search_term TEXT,
    scan_limit INTEGER NOT NULL DEFAULT 120,
    total_listings INTEGER NOT NULL DEFAULT 0,
    scanned_listings INTEGER NOT NULL DEFAULT 0,
    sort_applied TEXT,
    filters JSONB NOT NULL DEFAULT '{}'::jsonb,
    summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ml_market_research_snapshots_workspace_generated
    ON ml_market_research_snapshots(workspace_id, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_ml_market_research_snapshots_category_generated
    ON ml_market_research_snapshots(category_id, generated_at DESC);

CREATE TABLE IF NOT EXISTS ml_market_research_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    snapshot_id UUID NOT NULL REFERENCES ml_market_research_snapshots(id) ON DELETE CASCADE,
    ml_item_id TEXT NOT NULL,
    category_id TEXT,
    category_name TEXT,
    title TEXT NOT NULL,
    price NUMERIC(15, 2) NOT NULL DEFAULT 0,
    sold_quantity INTEGER NOT NULL DEFAULT 0,
    available_quantity INTEGER NOT NULL DEFAULT 0,
    permalink TEXT,
    thumbnail TEXT,
    date_created TIMESTAMP WITH TIME ZONE,
    ad_age_days NUMERIC(12, 2),
    sales_per_day NUMERIC(12, 4),
    official_store_id INTEGER,
    logistic_type TEXT,
    shipping_free_shipping BOOLEAN NOT NULL DEFAULT FALSE,
    seller_id TEXT,
    seller_nickname TEXT,
    seller_reputation_level TEXT,
    seller_reputation_score NUMERIC(8, 2),
    seller_transactions INTEGER,
    seller_power_seller_status TEXT,
    seller_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ml_market_research_items_snapshot
    ON ml_market_research_items(snapshot_id);

CREATE INDEX IF NOT EXISTS idx_ml_market_research_items_snapshot_sales
    ON ml_market_research_items(snapshot_id, sold_quantity DESC, sales_per_day DESC);

CREATE INDEX IF NOT EXISTS idx_ml_market_research_items_snapshot_category
    ON ml_market_research_items(snapshot_id, category_id);
