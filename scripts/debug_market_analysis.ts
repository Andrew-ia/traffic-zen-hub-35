
import { MarketAnalysisService } from "../server/services/mercadolivre/market-analysis.service";
import { getPool } from "../server/config/database";

const service = new MarketAnalysisService();

async function debug() {
    const categoryId = "MLB1431"; // Default Jewelry
    console.log(`Checking category: ${categoryId}`);
    
    // 1. Check if category exists in DB
    const pool = getPool();
    const catCheck = await pool.query("SELECT * FROM ml_categories WHERE id = $1", [categoryId]);
    console.log("Category in DB:", catCheck.rows[0]);

    if (!catCheck.rows[0]) {
        console.log("Category not found in DB. Attempting fetch...");
        try {
            await service.syncCategoryHierarchy(categoryId);
            console.log("Sync success.");
        } catch (e) {
            console.error("Sync failed:", e.message);
        }
    }

    // 2. Check stats
    console.log("Checking total products in DB...");
    const prodCount = await pool.query("SELECT COUNT(*) FROM ml_products");
    console.log("Total products:", prodCount.rows[0].count);

    if (prodCount.rows[0].count === '0') {
        console.log("No products found. Attempting syncTopProducts...");
        try {
            const products = await service.syncTopProducts(categoryId);
            console.log(`Synced ${products.length} products.`);
        } catch (e) {
            console.error("Sync products failed:", e);
        }
    }

    console.log("Fetching stats...");
    const stats = await service.getCategoryStatistics(categoryId);
    console.log("Stats:", stats);

    // 3. Check products
    console.log("Fetching report...");
    const report = await service.getCategoryAnalysisReport(categoryId);
    console.log("Products found:", report.products.length);
    console.log("Trends found:", report.trends.length);

    process.exit(0);
}

debug();
