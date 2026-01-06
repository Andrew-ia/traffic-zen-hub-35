
import { getPool } from '../server/config/database';
import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function applyMigration() {
    try {
        const pool = getPool();
        const migrationFile = 'db/migrations/0045_replenishment_fields.sql';
        const sql = fs.readFileSync(path.join(process.cwd(), migrationFile), 'utf8');
        
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
