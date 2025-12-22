
import { Router } from "express";
import { getPool } from "../../config/database.js";
import { resolveWorkspaceId } from "../../utils/workspace.js";
import { syncFullAnalyticsForWorkspace } from "../../services/mercadolivre/full-analytics.service.js";

const router = Router();

// Sync Endpoint
router.post("/sync-full", async (req, res) => {
    try {
        const { id: workspaceId } = resolveWorkspaceId(req);
        if (!workspaceId) {
            return res.status(400).json({ error: "Workspace ID is required" });
        }

        const result = await syncFullAnalyticsForWorkspace(String(workspaceId));
        
        if (!result.success) {
            return res.status(500).json(result);
        }

        return res.json(result);

    } catch (error: any) {
        console.error("Sync Full error:", error);
        return res.status(500).json({ error: "Failed to sync full products", details: error.message });
    }
});

// Get Products Endpoint
router.get("/products", async (req, res) => {
    try {
        const { id: workspaceId } = resolveWorkspaceId(req);
        if (!workspaceId) return res.status(400).json({ error: "Workspace ID required" });

        const pool = getPool();
        const result = await pool.query(`
            SELECT * FROM products 
            WHERE workspace_id = $1 AND ml_logistic_type = 'fulfillment'
            ORDER BY classification ASC, profit_unit DESC
        `, [workspaceId]);

        return res.json(result.rows);
    } catch (error: any) {
        return res.status(500).json({ error: "Failed to fetch products", details: error.message });
    }
});

export default router;

