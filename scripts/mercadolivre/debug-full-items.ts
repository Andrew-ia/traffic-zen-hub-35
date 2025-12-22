import { getPool } from "../../server/config/database.js";
import { requestWithAuth, getMercadoLivreCredentials } from "../../server/api/integrations/mercadolivre.js";
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MERCADO_LIVRE_API_BASE = "https://api.mercadolibre.com";

// Helper function
function chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}

async function debugFullItems() {
    const pool = getPool();
    console.log("Starting Debug for Full Items Collection...");

    try {
        let workspaceId = process.argv[2] || process.env.WORKSPACE_ID;
        if (!workspaceId) {
            const res = await pool.query("SELECT workspace_id FROM integration_credentials WHERE platform_key = 'mercadolivre' LIMIT 1");
            if (res.rows.length > 0) workspaceId = res.rows[0].workspace_id;
            else process.exit(1);
        }

        const credentials = await getMercadoLivreCredentials(workspaceId);
        
        // 1. Fetch all items (active and paused)
        const allItemIds: string[] = [];
        const statuses = ['active', 'paused'];
        const targetId = "MLB5528244534";
        let foundInSearch = false;

        for (const status of statuses) {
            let offset = 0;
            let limit = 50;
            let hasMore = true;
            let count = 0;

            console.log(`Searching for ${status} items...`);

            while (hasMore) {
                const searchRes = await requestWithAuth<any>(
                    workspaceId,
                    `${MERCADO_LIVRE_API_BASE}/users/${credentials.userId}/items/search`,
                    { params: { limit, offset, status } }
                );
                
                if (searchRes.results && searchRes.results.length > 0) {
                    allItemIds.push(...searchRes.results);
                    count += searchRes.results.length;
                    
                    if (searchRes.results.includes(targetId)) {
                        console.log(`✅ FOUND TARGET ID ${targetId} in ${status} search!`);
                        foundInSearch = true;
                    }

                    offset += limit;
                    if (offset >= (searchRes.paging?.total || 0)) hasMore = false;
                } else {
                    hasMore = false;
                }
            }
            console.log(`Found ${count} ${status} items.`);
        }

        if (!foundInSearch) {
            console.error(`❌ Target ID ${targetId} NOT found in search results.`);
        }

        // 2. Fetch Item Details (Multiget) to filter Full
        console.log("\nChecking Full Items details...");
        const fullItems: any[] = [];
        const chunks = chunk(allItemIds, 20);
        let foundInFull = false;

        for (const batch of chunks) {
            const idsStr = batch.join(",");
            const itemsRes = await requestWithAuth<any[]>(
                workspaceId,
                `${MERCADO_LIVRE_API_BASE}/items`,
                { params: { ids: idsStr } }
            );
            
            for (const item of itemsRes) {
                if (item.code === 200 && item.body.shipping?.logistic_type === "fulfillment") {
                    fullItems.push(item.body);
                    if (item.body.id === targetId) {
                        console.log(`✅ FOUND TARGET ID ${targetId} in Full Items list!`);
                        console.log(`Status: ${item.body.status}`);
                        console.log(`Logistic Type: ${item.body.shipping?.logistic_type}`);
                        foundInFull = true;
                    }
                }
            }
        }

        if (!foundInFull) {
             console.error(`❌ Target ID ${targetId} NOT found in Full Items list (maybe not fulfillment?).`);
             // Check individual item if missed
             if (foundInSearch) {
                 const singleRes = await requestWithAuth<any>(workspaceId, `${MERCADO_LIVRE_API_BASE}/items/${targetId}`, {});
                 console.log("Individual Check:", singleRes.shipping?.logistic_type);
             }
        }

    } catch (error) {
        console.error("Fatal error:", error);
    } finally {
        setTimeout(() => process.exit(0), 1000);
    }
}

debugFullItems();
