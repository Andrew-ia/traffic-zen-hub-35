CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS ml_catalog_sourcing_imports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id TEXT,
    supplier_name TEXT NOT NULL,
    source_file_name TEXT,
    source_type TEXT NOT NULL DEFAULT 'spreadsheet',
    item_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ml_catalog_sourcing_imports_workspace_created
    ON ml_catalog_sourcing_imports(workspace_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ml_catalog_sourcing_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    import_id UUID NOT NULL REFERENCES ml_catalog_sourcing_imports(id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL DEFAULT 0,
    supplier_sku TEXT,
    product_name TEXT NOT NULL,
    normalized_name TEXT,
    search_term TEXT,
    category_hint TEXT,
    supplier_cost NUMERIC(15, 2) NOT NULL DEFAULT 0,
    raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'imported',
    approved_for_purchase BOOLEAN NOT NULL DEFAULT FALSE,
    selected_match_ml_item_id TEXT,
    analyzed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ml_catalog_sourcing_items_import_line
    ON ml_catalog_sourcing_items(import_id, line_number);

CREATE INDEX IF NOT EXISTS idx_ml_catalog_sourcing_items_import_status
    ON ml_catalog_sourcing_items(import_id, status);

CREATE TABLE IF NOT EXISTS ml_catalog_sourcing_matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    import_item_id UUID NOT NULL REFERENCES ml_catalog_sourcing_items(id) ON DELETE CASCADE,
    ml_item_id TEXT NOT NULL,
    title TEXT NOT NULL,
    price NUMERIC(15, 2) NOT NULL DEFAULT 0,
    sold_quantity INTEGER NOT NULL DEFAULT 0,
    available_quantity INTEGER NOT NULL DEFAULT 0,
    sales_per_day NUMERIC(12, 4),
    permalink TEXT,
    thumbnail TEXT,
    date_created TIMESTAMPTZ,
    ad_age_days INTEGER,
    official_store_id INTEGER,
    logistic_type TEXT,
    shipping_free_shipping BOOLEAN NOT NULL DEFAULT FALSE,
    seller_id TEXT,
    seller_nickname TEXT,
    seller_reputation_level TEXT,
    seller_reputation_score NUMERIC(8, 2),
    seller_transactions INTEGER,
    seller_type TEXT,
    match_score NUMERIC(8, 2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(import_item_id, ml_item_id)
);

CREATE INDEX IF NOT EXISTS idx_ml_catalog_sourcing_matches_item_score
    ON ml_catalog_sourcing_matches(import_item_id, match_score DESC, sold_quantity DESC);
