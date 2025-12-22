import { getPool } from "../config/database.js";
import { syncFullAnalyticsForWorkspace } from "../services/mercadolivre/full-analytics.service.js";

const SYNC_INTERVAL_MS = 60 * 60 * 1000; // Check every hour
const SYNC_COOLDOWN_HOURS = 24;

export function startFullAnalyticsScheduler() {
    console.log("[Full Analytics Scheduler] Starting scheduler...");
    
    // Run immediately on startup
    checkAndRunSync();

    // Schedule periodic checks
    setInterval(checkAndRunSync, SYNC_INTERVAL_MS);
}

async function checkAndRunSync() {
    const pool = getPool();
    console.log("[Full Analytics Scheduler] Checking for workspaces to sync...");

    try {
        // 1. Get all workspaces with Mercado Livre credentials
        const workspacesRes = await pool.query(`
            SELECT DISTINCT workspace_id 
            FROM integration_credentials 
            WHERE platform_key = 'mercadolivre'
        `);

        const workspaceIds = workspacesRes.rows.map(row => row.workspace_id);

        if (workspaceIds.length === 0) {
            console.log("[Full Analytics Scheduler] No workspaces with Mercado Livre credentials found.");
            return;
        }

        // 2. For each workspace, check if sync is needed
        for (const workspaceId of workspaceIds) {
            try {
                const lastRunRes = await pool.query(`
                    SELECT MAX(last_analyzed_at) as last_run 
                    FROM products 
                    WHERE workspace_id = $1
                `, [workspaceId]);

                const lastRun = lastRunRes.rows[0]?.last_run ? new Date(lastRunRes.rows[0].last_run) : null;
                const now = new Date();
                
                let shouldRun = false;

                if (!lastRun) {
                    shouldRun = true; // Never ran
                    console.log(`[Full Analytics Scheduler] Workspace ${workspaceId}: Never ran. Scheduling sync.`);
                } else {
                    const hoursSinceLastRun = (now.getTime() - lastRun.getTime()) / (1000 * 60 * 60);
                    if (hoursSinceLastRun >= SYNC_COOLDOWN_HOURS) {
                        shouldRun = true;
                        console.log(`[Full Analytics Scheduler] Workspace ${workspaceId}: Last run ${hoursSinceLastRun.toFixed(1)}h ago. Scheduling sync.`);
                    } else {
                        console.log(`[Full Analytics Scheduler] Workspace ${workspaceId}: Last run ${hoursSinceLastRun.toFixed(1)}h ago. Skipping.`);
                    }
                }

                if (shouldRun) {
                    console.log(`[Full Analytics Scheduler] Starting sync for workspace ${workspaceId}...`);
                    const result = await syncFullAnalyticsForWorkspace(workspaceId);
                    if (result.success) {
                        console.log(`[Full Analytics Scheduler] Workspace ${workspaceId}: Sync completed successfully.`);
                    } else {
                        console.error(`[Full Analytics Scheduler] Workspace ${workspaceId}: Sync failed.`, result.error);
                    }
                }

            } catch (err) {
                console.error(`[Full Analytics Scheduler] Error checking/running sync for workspace ${workspaceId}:`, err);
            }
        }

    } catch (error) {
        console.error("[Full Analytics Scheduler] Error in scheduler loop:", error);
    }
}
