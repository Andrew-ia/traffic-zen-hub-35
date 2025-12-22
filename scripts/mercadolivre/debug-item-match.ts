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

async function debugSpecificItem() {
    const pool = getPool();
    console.log("Starting Debug for Specific Item...");

    try {
        let workspaceId = process.argv[2] || process.env.WORKSPACE_ID;
        if (!workspaceId) {
            const res = await pool.query("SELECT workspace_id FROM integration_credentials WHERE platform_key = 'mercadolivre' LIMIT 1");
            if (res.rows.length > 0) workspaceId = res.rows[0].workspace_id;
            else process.exit(1);
        }

        const credentials = await getMercadoLivreCredentials(workspaceId);
        
        // 1. Fetch orders again to find the ID used in orders
        const dateFrom = new Date();
        dateFrom.setDate(dateFrom.getDate() - 30);
        const dateFromStr = dateFrom.toISOString();

        const ordersRes = await requestWithAuth<any>(
            workspaceId,
            `${MERCADO_LIVRE_API_BASE}/orders/search`,
            {
                params: {
                    seller: credentials.userId,
                    'order.date_created.from': dateFromStr,
                    limit: 50,
                    sort: 'date_desc'
                }
            }
        );

        const orders = ordersRes.results || [];
        let targetItemId = "";
        
        for (const order of orders) {
            for (const item of order.order_items) {
                if (item.item.title.toLowerCase().includes("brinco redondo tubo trançado dourado")) {
                    console.log(`[ORDER] Found item in order: ${item.item.title}`);
                    console.log(`[ORDER] Item ID from Order: ${item.item.id}`);
                    targetItemId = item.item.id;
                    break;
                }
            }
            if (targetItemId) break;
        }

        if (!targetItemId) {
            console.log("Could not find target item in recent orders.");
            process.exit(0);
        }

        // 2. Fetch Item Details using the ID from Order
        console.log(`\nFetching details for Item ID: ${targetItemId}`);
        const itemRes = await requestWithAuth<any>(
            workspaceId,
            `${MERCADO_LIVRE_API_BASE}/items/${targetItemId}`,
            {}
        );

        console.log(`[ITEM API] ID: ${itemRes.id}`);
        console.log(`[ITEM API] Title: ${itemRes.title}`);
        console.log(`[ITEM API] Status: ${itemRes.status}`);
        console.log(`[ITEM API] Logistic Type: ${itemRes.shipping?.logistic_type}`);
        console.log(`[ITEM API] Available Quantity: ${itemRes.available_quantity}`);

    } catch (error) {
        console.error("Fatal error:", error);
    } finally {
        setTimeout(() => process.exit(0), 1000);
    }
}

debugSpecificItem();
