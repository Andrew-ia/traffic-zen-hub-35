import { getPool } from "../../server/config/database.js";
import { syncFullAnalyticsForWorkspace } from "../../server/services/mercadolivre/full-analytics.service.js";
import { requestWithAuth, getMercadoLivreCredentials } from "../../server/api/integrations/mercadolivre.js";
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MERCADO_LIVRE_API_BASE = "https://api.mercadolibre.com";

async function debugSales() {
    const pool = getPool();
    console.log("Starting Debug for Sales Logic...");

    try {
        // Get workspace ID
        let workspaceId = process.argv[2] || process.env.WORKSPACE_ID;

        if (!workspaceId) {
            const res = await pool.query("SELECT workspace_id FROM integration_credentials WHERE platform_key = 'mercadolivre' LIMIT 1");
            if (res.rows.length > 0) {
                workspaceId = res.rows[0].workspace_id;
            } else {
                console.error("No workspace ID.");
                process.exit(1);
            }
        }

        const credentials = await getMercadoLivreCredentials(workspaceId);
        if (!credentials) {
            console.error("No credentials.");
            process.exit(1);
        }

        // 1. Fetch Orders (Last 30 days) - Replicating service logic
        console.log("Fetching orders...");
        const dateFrom = new Date();
        dateFrom.setDate(dateFrom.getDate() - 30);
        const dateFromStr = dateFrom.toISOString();

        console.log(`Date From: ${dateFromStr}`);

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
        console.log(`Found ${ordersRes.paging?.total || 0} orders in total.`);
        console.log(`Fetched ${orders.length} orders in first page.`);

        // 2. Check for specific product
        // "Brinco Redondo Tubo Trançado Dourado" - we need to find its ID first or just search in orders
        
        let foundInOrders = false;
        const itemCounts: Record<string, number> = {};

        for (const order of orders) {
            for (const item of order.order_items) {
                itemCounts[item.item.id] = (itemCounts[item.item.id] || 0) + item.quantity;
                
                if (item.item.title.toLowerCase().includes("brinco redondo tubo trançado dourado")) {
                    console.log(`FOUND TARGET PRODUCT IN ORDER: ${order.id}`);
                    console.log(`Item ID: ${item.item.id}`);
                    console.log(`Title: ${item.item.title}`);
                    console.log(`Quantity: ${item.quantity}`);
                    console.log(`Date: ${order.date_created}`);
                    foundInOrders = true;
                }
            }
        }

        if (!foundInOrders) {
            console.log("Target product NOT found in the first 50 orders.");
        }

        // 3. List top 5 items by sales in this batch
        console.log("\nTop 5 Items in this batch:");
        const sortedItems = Object.entries(itemCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
        for (const [id, qty] of sortedItems) {
            console.log(`${id}: ${qty}`);
        }

    } catch (error) {
        console.error("Fatal error:", error);
    } finally {
        setTimeout(() => process.exit(0), 1000);
    }
}

debugSales();
