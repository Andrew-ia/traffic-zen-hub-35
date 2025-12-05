import { Router } from "express";
import { getPool } from "../config/database.js";

const router = Router();
const db = getPool();

/**
 * Interface para Log de Sincronização
 */
interface SyncLog {
    product_id: string;
    workspace_id: string;
    sync_type: 'import_from_ml' | 'export_to_ml' | 'resolve_conflict';
    direction: 'ml_to_traffic' | 'traffic_to_ml' | 'bidirectional';
    status: 'success' | 'error' | 'conflict' | 'skipped';
    before_data?: any;
    after_data?: any;
    ml_data?: any;
    error_message?: string;
    conflict_reason?: string;
}

/**
 * GET /api/sync/conflicts/:workspaceId
 * Listar produtos com conflitos de sincronização
 */
router.get('/conflicts/:workspaceId', async (req, res) => {
    try {
        const { workspaceId } = req.params;

        const result = await db.query(`
            SELECT * FROM vw_products_conflicts 
            WHERE workspace_id = $1 
            ORDER BY conflict_detected_at DESC
        `, [workspaceId]);

        return res.json({
            conflicts: result.rows,
            total: result.rows.length
        });

    } catch (error: any) {
        console.error("Error fetching conflicts:", error);
        return res.status(500).json({ error: "Failed to fetch conflicts", details: error.message });
    }
});

/**
 * GET /api/sync/pending/:workspaceId
 * Listar produtos pendentes de sincronização
 */
router.get('/pending/:workspaceId', async (req, res) => {
    try {
        const { workspaceId } = req.params;

        const result = await db.query(`
            SELECT p.*, 
                   CASE 
                       WHEN p.ml_item_id IS NULL THEN 'needs_export'
                       WHEN p.updated_at > p.last_synced_at THEN 'needs_update'
                       ELSE 'needs_check'
                   END as sync_action
            FROM products p 
            WHERE p.workspace_id = $1 
            AND p.sync_status = 'pending'
            ORDER BY p.updated_at DESC
        `, [workspaceId]);

        return res.json({
            pending: result.rows,
            total: result.rows.length
        });

    } catch (error: any) {
        console.error("Error fetching pending products:", error);
        return res.status(500).json({ error: "Failed to fetch pending products", details: error.message });
    }
});

/**
 * POST /api/sync/resolve-conflict/:productId
 * Resolver conflito de sincronização
 */
router.post('/resolve-conflict/:productId', async (req, res) => {
    try {
        const { productId } = req.params;
        const { resolution, workspaceId } = req.body;
        // resolution: 'use_traffic_pro' | 'use_mercado_livre' | 'merge_manual'

        if (!resolution || !workspaceId) {
            return res.status(400).json({ error: "resolution and workspaceId are required" });
        }

        // Buscar produto atual
        const productResult = await db.query(
            `SELECT * FROM products WHERE id = $1 AND workspace_id = $2`,
            [productId, workspaceId]
        );

        if (productResult.rows.length === 0) {
            return res.status(404).json({ error: "Product not found" });
        }

        const product = productResult.rows[0];

        let updateData: any = {};
        const syncLogData: SyncLog = {
            product_id: productId,
            workspace_id: workspaceId,
            sync_type: 'resolve_conflict',
            direction: 'bidirectional',
            status: 'success',
            before_data: product
        };

        switch (resolution) {
            case 'use_traffic_pro':
                updateData = {
                    sync_status: 'pending', // Será sincronizado com ML
                    source_of_truth: 'traffic_pro',
                    last_synced_at: null // Forçar nova sincronização
                };
                break;

            case 'use_mercado_livre':
                updateData = {
                    sync_status: 'pending', // Será importado do ML
                    source_of_truth: 'mercado_livre',
                    last_synced_at: null
                };
                break;

            case 'merge_manual':
                // Para merge manual, não alterar status ainda
                updateData = {
                    source_of_truth: 'both'
                };
                break;

            default:
                return res.status(400).json({ error: "Invalid resolution type" });
        }

        // Atualizar produto
        await db.query(`
            UPDATE products 
            SET ${Object.keys(updateData).map((key, i) => `${key} = $${i + 2}`).join(', ')}, updated_at = NOW()
            WHERE id = $1
        `, [productId, ...Object.values(updateData)]);

        // Log da resolução
        await db.query(`
            INSERT INTO sync_logs (product_id, workspace_id, sync_type, direction, status, before_data, after_data, conflict_reason)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
            syncLogData.product_id,
            syncLogData.workspace_id,
            syncLogData.sync_type,
            syncLogData.direction,
            syncLogData.status,
            JSON.stringify(syncLogData.before_data),
            JSON.stringify(updateData),
            `Resolved via ${resolution}`
        ]);

        return res.json({
            success: true,
            message: "Conflict resolved successfully",
            resolution: resolution,
            product_id: productId
        });

    } catch (error: any) {
        console.error("Error resolving conflict:", error);
        return res.status(500).json({ error: "Failed to resolve conflict", details: error.message });
    }
});

/**
 * POST /api/sync/mark-as-synced/:productId
 * Marcar produto como sincronizado
 */
router.post('/mark-as-synced/:productId', async (req, res) => {
    try {
        const { productId } = req.params;
        const { workspaceId, mlData } = req.body;

        if (!workspaceId) {
            return res.status(400).json({ error: "workspaceId is required" });
        }

        await db.query(`
            UPDATE products 
            SET sync_status = 'synced', 
                last_synced_at = NOW(),
                ml_last_modified = $3,
                updated_at = NOW()
            WHERE id = $1 AND workspace_id = $2
        `, [productId, workspaceId, mlData?.last_updated || new Date().toISOString()]);

        // Log da sincronização
        await db.query(`
            INSERT INTO sync_logs (product_id, workspace_id, sync_type, direction, status, ml_data)
            VALUES ($1, $2, 'export_to_ml', 'traffic_to_ml', 'success', $3)
        `, [productId, workspaceId, JSON.stringify(mlData)]);

        return res.json({ success: true, message: "Product marked as synced" });

    } catch (error: any) {
        console.error("Error marking as synced:", error);
        return res.status(500).json({ error: "Failed to mark as synced", details: error.message });
    }
});

/**
 * POST /api/sync/detect-conflicts/:workspaceId
 * Detectar conflitos comparando com dados do ML
 */
router.post('/detect-conflicts/:workspaceId', async (req, res) => {
    try {
        const { workspaceId } = req.params;
        const { mlProducts } = req.body; // Array de produtos do ML

        if (!Array.isArray(mlProducts)) {
            return res.status(400).json({ error: "mlProducts must be an array" });
        }

        let conflictsDetected = 0;
        const conflicts = [];

        for (const mlProduct of mlProducts) {
            // Buscar produto correspondente
            const localResult = await db.query(`
                SELECT * FROM products 
                WHERE ml_item_id = $1 AND workspace_id = $2
            `, [mlProduct.id, workspaceId]);

            if (localResult.rows.length === 0) continue;

            const localProduct = localResult.rows[0];
            
            // Verificar se há conflito
            const mlLastModified = new Date(mlProduct.last_updated);
            const localLastModified = new Date(localProduct.updated_at);
            const lastSynced = localProduct.last_synced_at ? new Date(localProduct.last_synced_at) : null;

            const hasConflict = 
                lastSynced && 
                mlLastModified > lastSynced && 
                localLastModified > lastSynced &&
                localProduct.source_of_truth === 'traffic_pro';

            if (hasConflict) {
                // Marcar como conflito
                await db.query(`
                    UPDATE products 
                    SET sync_status = 'conflict',
                        ml_last_modified = $3,
                        updated_at = NOW()
                    WHERE id = $1 AND workspace_id = $2
                `, [localProduct.id, workspaceId, mlProduct.last_updated]);

                // Log do conflito
                await db.query(`
                    INSERT INTO sync_logs (product_id, workspace_id, sync_type, direction, status, before_data, ml_data, conflict_reason)
                    VALUES ($1, $2, 'import_from_ml', 'ml_to_traffic', 'conflict', $3, $4, $5)
                `, [
                    localProduct.id,
                    workspaceId,
                    JSON.stringify(localProduct),
                    JSON.stringify(mlProduct),
                    'Both products modified since last sync'
                ]);

                conflictsDetected++;
                conflicts.push({
                    productId: localProduct.id,
                    title: localProduct.title,
                    mlItemId: mlProduct.id
                });
            }
        }

        return res.json({
            success: true,
            conflictsDetected,
            conflicts,
            message: `Detected ${conflictsDetected} conflicts`
        });

    } catch (error: any) {
        console.error("Error detecting conflicts:", error);
        return res.status(500).json({ error: "Failed to detect conflicts", details: error.message });
    }
});

/**
 * GET /api/sync/status/:workspaceId
 * Obter status geral de sincronização do workspace
 */
router.get('/status/:workspaceId', async (req, res) => {
    try {
        const { workspaceId } = req.params;

        // Status dos produtos
        const statusResult = await db.query(`
            SELECT 
                sync_status,
                source_of_truth,
                COUNT(*) as count
            FROM products 
            WHERE workspace_id = $1 
            GROUP BY sync_status, source_of_truth
            ORDER BY sync_status, source_of_truth
        `, [workspaceId]);

        // Últimos logs
        const logsResult = await db.query(`
            SELECT sl.*, p.title, p.sku
            FROM sync_logs sl
            LEFT JOIN products p ON sl.product_id = p.id
            WHERE sl.workspace_id = $1
            ORDER BY sl.created_at DESC
            LIMIT 10
        `, [workspaceId]);

        // Configurações de sincronização
        const settingsResult = await db.query(`
            SELECT * FROM workspace_sync_settings 
            WHERE workspace_id = $1
        `, [workspaceId]);

        return res.json({
            statusBreakdown: statusResult.rows,
            recentLogs: logsResult.rows,
            settings: settingsResult.rows[0] || null
        });

    } catch (error: any) {
        console.error("Error fetching sync status:", error);
        return res.status(500).json({ error: "Failed to fetch sync status", details: error.message });
    }
});

export default router;
