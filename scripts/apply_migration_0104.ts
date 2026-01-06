import { getPool } from "../server/config/database";
import fs from "fs";
import path from "path";

async function applyMigration() {
    try {
        const pool = getPool();
        const migrationFile = "db/migrations/0104_ml_orders_analytics.sql";
        const sql = fs.readFileSync(path.join(process.cwd(), migrationFile), "utf8");

        console.log(`Applying migration: ${migrationFile}`);
        await pool.query(sql);
        console.log("Migration applied successfully.");
        process.exit(0);
    } catch (e) {
        console.error("Migration failed:", e);
        process.exit(1);
    }
}

applyMigration();
