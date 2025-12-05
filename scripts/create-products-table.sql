-- =====================================================
-- Tabela de Produtos - Traffic Pro
-- Centralização de produtos para publicação no Mercado Livre
-- =====================================================

-- Drop table if exists (cuidado em produção!)
-- DROP TABLE IF EXISTS products CASCADE;

-- Criar tabela de produtos
CREATE TABLE IF NOT EXISTS products (
    -- Identificação
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- SKU e identificação interna
    sku VARCHAR(100),
    internal_code VARCHAR(100),
    
    -- Dados básicos
    title VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Categoria do Mercado Livre
    ml_category_id VARCHAR(50), -- Ex: MLB1276 (Tênis)
    ml_listing_type VARCHAR(50) DEFAULT 'gold_special', -- gold_special, gold_pro, free
    
    -- Preço e estoque
    price DECIMAL(10,2) NOT NULL,
    original_price DECIMAL(10,2), -- Preço original (para mostrar desconto)
    cost_price DECIMAL(10,2), -- Custo (para cálculo de margem)
    currency VARCHAR(3) DEFAULT 'BRL',
    
    -- Estoques separados para Full vs Normal
    available_quantity INTEGER DEFAULT 0, -- Estoque total disponível
    ml_full_stock INTEGER DEFAULT 0, -- Estoque dedicado para Mercado Livre Full
    ml_normal_stock INTEGER DEFAULT 0, -- Estoque para anúncios normais
    reserved_stock INTEGER DEFAULT 0, -- Estoque reservado (vendas pendentes)
    minimum_stock INTEGER DEFAULT 0, -- Estoque mínimo para alerta
    
    sold_quantity INTEGER DEFAULT 0,
    
    -- Condição
    condition VARCHAR(20) DEFAULT 'new', -- new, used, refurbished
    
    -- Atributos do produto (JSON flexível para diferentes categorias)
    attributes JSONB DEFAULT '[]', 
    -- Exemplo: [{"id":"BRAND","value_name":"Nike"},{"id":"MODEL","value_name":"Air Max"}]
    
    -- Imagens (array de URLs)
    images JSONB DEFAULT '[]',
    -- Exemplo: ["https://...", "https://..."]
    
    video_url VARCHAR(500), -- URL do vídeo (YouTube, etc)
    
    -- Dimensões e peso (para cálculo de frete)
    weight_kg DECIMAL(8,3), -- Peso em kg
    width_cm DECIMAL(8,2), -- Largura em cm
    height_cm DECIMAL(8,2), -- Altura em cm
    length_cm DECIMAL(8,2), -- Comprimento em cm
    
    -- Frete
    free_shipping BOOLEAN DEFAULT false,
    shipping_mode VARCHAR(50) DEFAULT 'me2', -- me2 (flex), custom
    local_pickup BOOLEAN DEFAULT false,
    
    -- Garantia
    warranty_type VARCHAR(50), -- manufacturer, seller, without_warranty
    warranty_time VARCHAR(50), -- Ex: "12 months", "90 days"
    
    -- SEO e Marketing
    tags TEXT[], -- Tags para busca interna
    keywords TEXT[], -- Palavras-chave
    
    -- Status
    status VARCHAR(20) DEFAULT 'draft', -- draft, active, paused, deleted
    published_on_ml BOOLEAN DEFAULT false,
    ml_item_id VARCHAR(50), -- ID do item no Mercado Livre (após publicação)
    ml_permalink VARCHAR(500), -- Link do anúncio no ML
    
    -- Variações (para produtos com cores/tamanhos diferentes)
    has_variations BOOLEAN DEFAULT false,
    parent_id UUID REFERENCES products(id) ON DELETE SET NULL, -- Produto pai (se for variação)
    variation_attributes JSONB, -- Ex: {"color": "Azul", "size": "42"}
    
    -- Metadados
    notes TEXT, -- Observações internas
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    published_at TIMESTAMP WITH TIME ZONE, -- Data de publicação no ML
    
    -- Índices para performance
    CONSTRAINT products_workspace_sku_unique UNIQUE(workspace_id, sku)
);

-- Criar índices
CREATE INDEX idx_products_workspace ON products(workspace_id);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_ml_item_id ON products(ml_item_id);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_category ON products(ml_category_id);
CREATE INDEX idx_products_parent ON products(parent_id);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_products_updated_at();

-- RLS (Row Level Security)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Policy: Usuários podem ver produtos do seu workspace
CREATE POLICY products_select_policy ON products
    FOR SELECT
    USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members 
            WHERE user_id = auth.uid()
        )
    );

-- Policy: Usuários podem inserir produtos no seu workspace
CREATE POLICY products_insert_policy ON products
    FOR INSERT
    WITH CHECK (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members 
            WHERE user_id = auth.uid()
        )
    );

-- Policy: Usuários podem atualizar produtos do seu workspace
CREATE POLICY products_update_policy ON products
    FOR UPDATE
    USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members 
            WHERE user_id = auth.uid()
        )
    );

-- Policy: Usuários podem deletar produtos do seu workspace
CREATE POLICY products_delete_policy ON products
    FOR DELETE
    USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members 
            WHERE user_id = auth.uid()
        )
    );

-- Comentários nas colunas
COMMENT ON TABLE products IS 'Catálogo centralizado de produtos para publicação no Mercado Livre';
COMMENT ON COLUMN products.sku IS 'SKU único do produto (código de barras, referência interna)';
COMMENT ON COLUMN products.ml_category_id IS 'ID da categoria no Mercado Livre (ex: MLB1276)';
COMMENT ON COLUMN products.ml_listing_type IS 'Tipo de anúncio: gold_special (clássico), gold_pro (premium), free (grátis)';
COMMENT ON COLUMN products.attributes IS 'Atributos do produto em formato JSON compatível com ML';
COMMENT ON COLUMN products.images IS 'Array de URLs das imagens do produto';
COMMENT ON COLUMN products.ml_item_id IS 'ID do item após publicação no Mercado Livre';

-- =====================================================
-- Tabela de Histórico de Publicações
-- =====================================================

CREATE TABLE IF NOT EXISTS product_publications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- Dados da publicação
    ml_item_id VARCHAR(50) NOT NULL,
    ml_permalink VARCHAR(500),
    
    -- Status
    status VARCHAR(50), -- active, paused, closed
    
    -- Métricas
    views INTEGER DEFAULT 0,
    visits INTEGER DEFAULT 0,
    sold_quantity INTEGER DEFAULT 0,
    
    -- Timestamps
    published_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    closed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_product_publications_product ON product_publications(product_id);
CREATE INDEX idx_product_publications_ml_item ON product_publications(ml_item_id);

-- =====================================================
-- View para produtos com informações agregadas
-- =====================================================

CREATE OR REPLACE VIEW vw_products_summary AS
SELECT 
    p.*,
    u.email as created_by_email,
    u.full_name as created_by_name,
    COALESCE(pp.views, 0) as ml_views,
    COALESCE(pp.visits, 0) as ml_visits,
    COALESCE(pp.sold_quantity, 0) as ml_sold_quantity,
    pp.ml_permalink as ml_current_permalink,
    pp.status as ml_current_status
FROM products p
LEFT JOIN users u ON p.created_by = u.id
LEFT JOIN LATERAL (
    SELECT * FROM product_publications 
    WHERE product_id = p.id 
    ORDER BY published_at DESC 
    LIMIT 1
) pp ON true;

-- Grant permissions
GRANT SELECT ON vw_products_summary TO authenticated;

COMMENT ON VIEW vw_products_summary IS 'View com informações agregadas dos produtos incluindo métricas do ML';
