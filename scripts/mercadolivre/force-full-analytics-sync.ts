import { syncFullAnalyticsForWorkspace } from "../../server/services/mercadolivre/full-analytics.service.js";
import { getPool } from "../../server/config/database.js";
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function forceSync() {
    const pool = getPool();
    console.log("Starting Force Sync for Full Analytics...");

    try {
        let workspaceId = process.argv[2] || process.env.WORKSPACE_ID;
        if (!workspaceId) {
            const res = await pool.query("SELECT workspace_id FROM integration_credentials WHERE platform_key = 'mercadolivre' LIMIT 1");
            if (res.rows.length > 0) workspaceId = res.rows[0].workspace_id;
            else {
                console.error("No workspace found.");
                process.exit(1);
            }
        }

        console.log(`Syncing workspace: ${workspaceId}`);
        const result = await syncFullAnalyticsForWorkspace(workspaceId);
        console.log("Sync Result:", result);

    } catch (error) {
        console.error("Fatal error:", error);
    } finally {
        setTimeout(() => process.exit(0), 1000);
    }
}

forceSync();
