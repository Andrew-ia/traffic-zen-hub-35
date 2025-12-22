
import { getPool } from './server/config/database';
import fs from 'fs';
import path from 'path';

async function applyMigration() {
    try {
        const pool = getPool();
        const sql = fs.readFileSync(path.join(process.cwd(), 'db/migrations/0042_add_full_analytics_fields.sql'), 'utf8');
        await pool.query(sql);
        console.log("Migration applied successfully.");
        process.exit(0);
    } catch (e) {
        console.error("Migration failed:", e);
        process.exit(1);
    }
}

applyMigration();
