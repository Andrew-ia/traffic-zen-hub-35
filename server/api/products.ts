import { Router } from "express";
import { getPool } from "../config/database.js";

const router = Router();
const db = getPool();

/**
 * Interface para Produto
 */
interface Product {
    id?: string;
    workspace_id: string;
    sku?: string;
    internal_code?: string;
    title: string;
    description?: string;
    ml_category_id?: string;
    ml_listing_type?: string;
    price: number;
    original_price?: number;
    cost_price?: number;
    currency?: string;
    available_quantity?: number;
    condition?: string;
    attributes?: any[];
    images?: string[];
    video_url?: string;
    weight_kg?: number;
    width_cm?: number;
    height_cm?: number;
    length_cm?: number;
    free_shipping?: boolean;
    shipping_mode?: string;
    local_pickup?: boolean;
    warranty_type?: string;
    warranty_time?: string;
    tags?: string[];
    keywords?: string[];
    status?: string;
    has_variations?: boolean;
    parent_id?: string;
    variation_attributes?: any;
    notes?: string;
}

/**
 * GET /api/products
 * Listar produtos do workspace
 */
router.get("/", async (req, res) => {
    try {
        console.log("🔍 GET /api/products - Query params:", req.query);
        const { workspaceId, search, category, status = "all", page = 1, limit = 50 } = req.query;

        if (!workspaceId) {
            return res.status(400).json({ error: "workspaceId is required" });
        }

        let query = `
      SELECT * FROM vw_products_summary
      WHERE workspace_id = $1 AND status != 'deleted'
    `;

        const params: any[] = [workspaceId];
        let paramIndex = 2;

        // Filtro de busca
        if (search) {
            query += ` AND (title ILIKE $${paramIndex} OR sku ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        // Filtro de categoria
        if (category && category !== "all") {
            query += ` AND ml_category_id = $${paramIndex}`;
            params.push(category);
            paramIndex++;
        }

        // Filtro de status
        if (status && status !== "all") {
            query += ` AND status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }

        // Paginação
        const offset = (Number(page) - 1) * Number(limit);
        query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limit, offset);

        const result = await db.query(query, params);

        // Contar total (excluindo deletados)
        const countQuery = `SELECT COUNT(*) FROM products WHERE workspace_id = $1 AND status != 'deleted'`;
        const countParams = [workspaceId];
        const countResult = await db.query(countQuery, countParams);
        const total = parseInt(countResult.rows[0].count);

        return res.json({
            products: result.rows,
            total,
            page: Number(page),
            limit: Number(limit),
            totalPages: Math.ceil(total / Number(limit)),
        });
    } catch (error: any) {
        console.error("Error fetching products:", error);
        return res.status(500).json({ error: "Failed to fetch products", details: error.message });
    }
});

/**
 * GET /api/products/:id
 * Buscar produto por ID
 */
router.get("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { workspaceId } = req.query;

        const result = await db.query(
            `SELECT * FROM vw_products_summary WHERE id = $1 AND workspace_id = $2`,
            [id, workspaceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Product not found" });
        }

        return res.json(result.rows[0]);
    } catch (error: any) {
        console.error("Error fetching product:", error);
        return res.status(500).json({ error: "Failed to fetch product", details: error.message });
    }
});

/**
 * POST /api/products
 * Criar novo produto
 */
router.post("/", async (req, res) => {
    try {
        console.log("📝 POST /api/products - Body:", req.body);
        const product: Product = req.body;

        // Validações básicas
        if (!product.workspace_id) {
            return res.status(400).json({ error: "workspace_id is required" });
        }
        if (!product.title) {
            return res.status(400).json({ error: "title is required" });
        }
        if (!product.price || product.price <= 0) {
            return res.status(400).json({ error: "price is required and must be greater than 0" });
        }

        const query = `
      INSERT INTO products (
        workspace_id, sku, internal_code, title, description,
        ml_category_id, ml_listing_type, price, original_price, cost_price,
        currency, available_quantity, condition, attributes, images,
        video_url, weight_kg, width_cm, height_cm, length_cm,
        free_shipping, shipping_mode, local_pickup,
        warranty_type, warranty_time, tags, keywords, status,
        has_variations, parent_id, variation_attributes, notes
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32
      ) RETURNING *
    `;

        const values = [
            product.workspace_id,
            product.sku,
            product.internal_code,
            product.title,
            product.description,
            product.ml_category_id,
            product.ml_listing_type || 'gold_special',
            product.price,
            product.original_price,
            product.cost_price,
            product.currency || 'BRL',
            product.available_quantity || 0,
            product.condition || 'new',
            JSON.stringify(product.attributes || []),
            JSON.stringify(product.images || []),
            product.video_url,
            product.weight_kg,
            product.width_cm,
            product.height_cm,
            product.length_cm,
            product.free_shipping || false,
            product.shipping_mode || 'me2',
            product.local_pickup || false,
            product.warranty_type,
            product.warranty_time,
            product.tags,
            product.keywords,
            product.status || 'draft',
            product.has_variations || false,
            product.parent_id,
            product.variation_attributes ? JSON.stringify(product.variation_attributes) : null,
            product.notes,
        ];

        const result = await db.query(query, values);

        return res.status(201).json({
            success: true,
            product: result.rows[0],
        });
    } catch (error: any) {
        console.error("Error creating product:", error);

        if (error.code === '23505') { // Unique violation
            return res.status(409).json({ error: "Product with this SKU already exists in workspace" });
        }

        return res.status(500).json({ error: "Failed to create product", details: error.message });
    }
});

/**
 * PUT /api/products/:id
 * Atualizar produto
 */
router.put("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const product: Product = req.body;

        const query = `
      UPDATE products SET
        sku = $1, internal_code = $2, title = $3, description = $4,
        ml_category_id = $5, ml_listing_type = $6, price = $7,
        original_price = $8, cost_price = $9, currency = $10,
        available_quantity = $11, condition = $12, attributes = $13,
        images = $14, video_url = $15, weight_kg = $16, width_cm = $17,
        height_cm = $18, length_cm = $19, free_shipping = $20,
        shipping_mode = $21, local_pickup = $22, warranty_type = $23,
        warranty_time = $24, tags = $25, keywords = $26, status = $27,
        has_variations = $28, parent_id = $29, variation_attributes = $30,
        notes = $31, updated_at = NOW()
      WHERE id = $32 AND workspace_id = $33
      RETURNING *
    `;

        const values = [
            product.sku,
            product.internal_code,
            product.title,
            product.description,
            product.ml_category_id,
            product.ml_listing_type,
            product.price,
            product.original_price,
            product.cost_price,
            product.currency,
            product.available_quantity,
            product.condition,
            JSON.stringify(product.attributes || []),
            JSON.stringify(product.images || []),
            product.video_url,
            product.weight_kg,
            product.width_cm,
            product.height_cm,
            product.length_cm,
            product.free_shipping,
            product.shipping_mode,
            product.local_pickup,
            product.warranty_type,
            product.warranty_time,
            product.tags,
            product.keywords,
            product.status,
            product.has_variations,
            product.parent_id,
            product.variation_attributes ? JSON.stringify(product.variation_attributes) : null,
            product.notes,
            id,
            product.workspace_id,
        ];

        const result = await db.query(query, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Product not found" });
        }

        return res.json({
            success: true,
            product: result.rows[0],
        });
    } catch (error: any) {
        console.error("Error updating product:", error);
        return res.status(500).json({ error: "Failed to update product", details: error.message });
    }
});

/**
 * GET /api/products/deleted/:workspaceId
 * Listar produtos deletados (para eventual recuperação)
 */
router.get("/deleted/:workspaceId", async (req, res) => {
    try {
        const { workspaceId } = req.params;

        const result = await db.query(`
            SELECT *, 'deleted' as status_label FROM vw_products_summary
            WHERE workspace_id = $1 AND status = 'deleted'
            ORDER BY updated_at DESC
        `, [workspaceId]);

        return res.json({
            products: result.rows,
            total: result.rows.length
        });

    } catch (error: any) {
        console.error("Error fetching deleted products:", error);
        return res.status(500).json({ error: "Failed to fetch deleted products", details: error.message });
    }
});

/**
 * POST /api/products/:id/restore
 * Restaurar produto deletado
 */
router.post("/:id/restore", async (req, res) => {
    try {
        const { id } = req.params;
        const { workspaceId } = req.body;

        if (!workspaceId) {
            return res.status(400).json({ error: "workspaceId is required" });
        }

        const result = await db.query(`
            UPDATE products 
            SET status = 'draft', updated_at = NOW() 
            WHERE id = $1 AND workspace_id = $2 AND status = 'deleted'
            RETURNING id, title
        `, [id, workspaceId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Deleted product not found" });
        }

        return res.json({ 
            success: true, 
            message: "Product restored successfully",
            product: result.rows[0]
        });

    } catch (error: any) {
        console.error("Error restoring product:", error);
        return res.status(500).json({ error: "Failed to restore product", details: error.message });
    }
});

/**
 * DELETE /api/products/:id
 * Deletar produto (soft delete - muda status para deleted)
 */
router.delete("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { workspaceId } = req.query;

        const result = await db.query(
            `UPDATE products SET status = 'deleted', updated_at = NOW() 
       WHERE id = $1 AND workspace_id = $2 RETURNING id`,
            [id, workspaceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Product not found" });
        }

        return res.json({ success: true, message: "Product deleted successfully" });
    } catch (error: any) {
        console.error("Error deleting product:", error);
        return res.status(500).json({ error: "Failed to delete product", details: error.message });
    }
});

/**
 * POST /api/products/:id/duplicate
 * Duplicar produto existente
 */
router.post("/:id/duplicate", async (req, res) => {
    try {
        const { id } = req.params;
        const { workspaceId, modifications = {} } = req.body;

        if (!workspaceId) {
            return res.status(400).json({ error: "workspaceId is required" });
        }

        // Buscar produto original
        const originalResult = await db.query(
            `SELECT * FROM products WHERE id = $1 AND workspace_id = $2`,
            [id, workspaceId]
        );

        if (originalResult.rows.length === 0) {
            return res.status(404).json({ error: "Product not found" });
        }

        const original = originalResult.rows[0];

        // Gerar novo SKU se não fornecido
        let newSku = modifications.sku;
        if (!newSku && original.sku) {
            // Adicionar sufixo "-COPY" ou incremental
            const baseSku = original.sku;
            let counter = 1;
            
            while (!newSku) {
                const candidateSku = `${baseSku}-${counter}`;
                const existingResult = await db.query(
                    `SELECT id FROM products WHERE sku = $1 AND workspace_id = $2`,
                    [candidateSku, workspaceId]
                );
                
                if (existingResult.rows.length === 0) {
                    newSku = candidateSku;
                } else {
                    counter++;
                }
            }
        }

        // Preparar dados do produto duplicado
        const duplicatedProduct = {
            ...original,
            // Remover campos únicos/específicos
            id: undefined,
            created_at: undefined,
            updated_at: undefined,
            ml_item_id: null,
            ml_permalink: null,
            published_on_ml: false,
            last_synced_at: null,
            
            // Aplicar modificações
            ...modifications,
            sku: newSku,
            title: modifications.title || `${original.title} (Cópia)`,
            
            // Resetar status de sincronização
            sync_status: 'pending',
            source_of_truth: 'traffic_pro'
        };

        // Inserir produto duplicado
        const insertQuery = `
            INSERT INTO products (
                workspace_id, sku, internal_code, title, description,
                ml_category_id, ml_listing_type, price, original_price, cost_price,
                currency, available_quantity, condition, attributes, images,
                video_url, weight_kg, width_cm, height_cm, length_cm,
                free_shipping, shipping_mode, local_pickup,
                warranty_type, warranty_time, tags, keywords, status,
                has_variations, parent_id, variation_attributes, notes,
                source_of_truth, sync_status
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
                $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34
            ) RETURNING *
        `;

        const values = [
            duplicatedProduct.workspace_id,
            duplicatedProduct.sku,
            duplicatedProduct.internal_code,
            duplicatedProduct.title,
            duplicatedProduct.description,
            duplicatedProduct.ml_category_id,
            duplicatedProduct.ml_listing_type,
            duplicatedProduct.price,
            duplicatedProduct.original_price,
            duplicatedProduct.cost_price,
            duplicatedProduct.currency,
            duplicatedProduct.available_quantity,
            duplicatedProduct.condition,
            JSON.stringify(duplicatedProduct.attributes || []),
            JSON.stringify(duplicatedProduct.images || []),
            duplicatedProduct.video_url,
            duplicatedProduct.weight_kg,
            duplicatedProduct.width_cm,
            duplicatedProduct.height_cm,
            duplicatedProduct.length_cm,
            duplicatedProduct.free_shipping,
            duplicatedProduct.shipping_mode,
            duplicatedProduct.local_pickup,
            duplicatedProduct.warranty_type,
            duplicatedProduct.warranty_time,
            duplicatedProduct.tags,
            duplicatedProduct.keywords,
            duplicatedProduct.status,
            duplicatedProduct.has_variations,
            duplicatedProduct.parent_id,
            duplicatedProduct.variation_attributes ? JSON.stringify(duplicatedProduct.variation_attributes) : null,
            duplicatedProduct.notes,
            duplicatedProduct.source_of_truth,
            duplicatedProduct.sync_status
        ];

        const result = await db.query(insertQuery, values);

        return res.status(201).json({
            success: true,
            product: result.rows[0],
            message: "Product duplicated successfully"
        });

    } catch (error: any) {
        console.error("Error duplicating product:", error);
        
        if (error.code === '23505') { // Unique violation
            return res.status(409).json({ error: "SKU already exists. Please provide a different SKU." });
        }

        return res.status(500).json({ error: "Failed to duplicate product", details: error.message });
    }
});

/**
 * POST /api/products/generate-description
 * Gerar descrição com IA baseada no título do produto
 */
router.post("/generate-description", async (req, res) => {
    try {
        const { title, category, price } = req.body;

        if (!title) {
            return res.status(400).json({ error: "Title is required" });
        }

        // Simular chamada para IA - você pode substituir por chamada real para GPT/Claude
        const generateDescription = (productTitle: string, productCategory?: string, productPrice?: number) => {
            // Templates base para diferentes tipos de produtos
            const templates = {
                electronics: [
                    "tecnologia avançada e design moderno",
                    "qualidade premium e performance excepcional",
                    "ideal para uso diário com máxima eficiência"
                ],
                fashion: [
                    "estilo elegante e conforto incomparável",
                    "design moderno e versatilidade para todas as ocasiões",
                    "qualidade premium em cada detalhe"
                ],
                home: [
                    "funcionalidade e design pensados para seu lar",
                    "praticidade e estilo em perfeita harmonia",
                    "qualidade e durabilidade garantidas"
                ],
                beauty: [
                    "cuidado especial para realçar sua beleza natural",
                    "fórmula desenvolvida com ingredientes selecionados",
                    "resultados visíveis e duradouros"
                ],
                default: [
                    "qualidade premium e design cuidadoso",
                    "produto desenvolvido pensando em suas necessidades",
                    "excelência em cada detalhe"
                ]
            };

            // Detectar categoria baseada no título
            const titleLower = productTitle.toLowerCase();
            let categoryKey = 'default';
            
            if (titleLower.includes('celular') || titleLower.includes('smartphone') || titleLower.includes('fone') || titleLower.includes('notebook')) {
                categoryKey = 'electronics';
            } else if (titleLower.includes('roupa') || titleLower.includes('camiseta') || titleLower.includes('vestido') || titleLower.includes('calça')) {
                categoryKey = 'fashion';
            } else if (titleLower.includes('casa') || titleLower.includes('cozinha') || titleLower.includes('decoração')) {
                categoryKey = 'home';
            } else if (titleLower.includes('maquiagem') || titleLower.includes('perfume') || titleLower.includes('creme')) {
                categoryKey = 'beauty';
            }

            const selectedTemplates = templates[categoryKey as keyof typeof templates] || templates.default;
            const randomTemplate = selectedTemplates[Math.floor(Math.random() * selectedTemplates.length)];

            // Gerar descrição mais elaborada
            const description = `
${productTitle} oferece ${randomTemplate}.

✨ **Características principais:**
• Design cuidadosamente pensado para atender suas expectativas
• Qualidade superior em materiais e acabamento
• Produto versátil e prático para o dia a dia
• Excelente custo-benefício

🎯 **Por que escolher este produto:**
• Marca confiável com tradição no mercado
• Garantia de qualidade e satisfação
• Entrega rápida e segura
• Atendimento especializado

📦 **O que você recebe:**
• 1x ${productTitle}
• Garantia do fabricante
• Manual de instruções (quando aplicável)

${productPrice ? `💰 **Oferta especial por apenas R$ ${productPrice.toFixed(2)}**` : ''}

⚡ Aproveite esta oportunidade única! Estoque limitado.

#QualidadePremium #MelhorPreço #EntregaRápida
            `.trim();

            return description;
        };

        const generatedDescription = generateDescription(title, category, price);

        return res.json({
            success: true,
            description: generatedDescription,
            message: "Descrição gerada com sucesso!"
        });

    } catch (error: any) {
        console.error("Error generating description:", error);
        return res.status(500).json({ error: "Failed to generate description", details: error.message });
    }
});

/**
 * POST /api/products/:id/publish-ml
 * Publicar produto no Mercado Livre
 */
router.post("/:id/publish-ml", async (req, res) => {
    try {
        const { id } = req.params;
        const { workspaceId } = req.body;

        // TODO: Implementar publicação no ML
        // 1. Buscar produto
        // 2. Validar campos obrigatórios
        // 3. Formatar payload para API do ML
        // 4. Enviar para ML
        // 5. Salvar ml_item_id e permalink
        // 6. Criar registro em product_publications

        return res.json({
            success: false,
            message: "Not implemented yet - coming soon!",
        });
    } catch (error: any) {
        console.error("Error publishing to ML:", error);
        return res.status(500).json({ error: "Failed to publish", details: error.message });
    }
});

export default router;
