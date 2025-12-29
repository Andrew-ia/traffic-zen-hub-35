-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table for Mercado Livre Categories
CREATE TABLE IF NOT EXISTS ml_categories (
    id TEXT PRIMARY KEY, -- e.g. MLB3937
    name TEXT NOT NULL,
    parent_id TEXT, -- Self reference, can be null for root
    permalink TEXT,
    total_items_in_this_category INTEGER,
    path_from_root TEXT, -- JSON or comma separated string for breadcrumbs
    children_categories_count INTEGER,
    picture TEXT,
    settings JSONB, -- Store additional settings/attributes
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for parent_id for faster traversal
CREATE INDEX IF NOT EXISTS idx_ml_categories_parent_id ON ml_categories(parent_id);


-- Table for Mercado Livre Trends (Most Searched Terms)
CREATE TABLE IF NOT EXISTS ml_trends (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id TEXT REFERENCES ml_categories(id),
    keyword TEXT NOT NULL,
    url TEXT,
    position INTEGER, -- Rank in the list
    captured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for querying trends by category and time
CREATE INDEX IF NOT EXISTS idx_ml_trends_category_captured ON ml_trends(category_id, captured_at);


-- Table for Mercado Livre Products (Analyzed/Saved Products)
CREATE TABLE IF NOT EXISTS ml_products (
    id TEXT PRIMARY KEY, -- Mercado Livre Item ID (e.g. MLB...)
    title TEXT NOT NULL,
    price NUMERIC(15, 2),
    original_price NUMERIC(15, 2),
    currency_id TEXT DEFAULT 'BRL',
    
    -- Sales & Performance
    sold_quantity INTEGER,
    available_quantity INTEGER,
    
    -- Listing Details
    permalink TEXT,
    thumbnail TEXT,
    condition TEXT, -- new, used
    listing_type_id TEXT, -- gold_pro, gold_special, etc.
    accepts_mercadopago BOOLEAN,
    
    -- Seller Info
    seller_id BIGINT,
    seller_nickname TEXT,
    seller_reputation_level_id TEXT,
    
    -- Category
    category_id TEXT, -- Can be a category we haven't scraped yet, so maybe not strict FK? 
                      -- Let's make it FK but ensure we save categories first or allow null if strictness is issue.
                      -- For now, loose coupling is safer for partial syncs.
    
    -- Dates
    stop_time TIMESTAMP WITH TIME ZONE,
    date_created TIMESTAMP WITH TIME ZONE, -- Important for "Ad Age"
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Analysis
    status TEXT, -- active, paused
    catalog_product_id TEXT,
    
    -- Workspace context (if we want to associate who saved it, though products are public)
    -- If multiple workspaces save the same product, we just update it.
    -- But maybe we want to know WHICH workspace is tracking it?
    -- For now, let's keep it as a global product repository.
    
    attributes JSONB -- Flexible storage for other attributes
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ml_products_category_id ON ml_products(category_id);
CREATE INDEX IF NOT EXISTS idx_ml_products_seller_id ON ml_products(seller_id);
CREATE INDEX IF NOT EXISTS idx_ml_products_sold_quantity ON ml_products(sold_quantity DESC);
CREATE INDEX IF NOT EXISTS idx_ml_products_date_created ON ml_products(date_created);

-- Table for tracking specific products per workspace (Optional but good for "My List")
CREATE TABLE IF NOT EXISTS ml_tracked_products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id TEXT NOT NULL, -- Assuming workspace_id is TEXT based on other tables
    product_id TEXT REFERENCES ml_products(id),
    notes TEXT,
    target_price NUMERIC(15, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(workspace_id, product_id)
);
