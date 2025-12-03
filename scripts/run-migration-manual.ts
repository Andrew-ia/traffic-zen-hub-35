
import 'dotenv/config';
import { getPool } from '../server/config/database';
import fs from 'fs';
import path from 'path';

async function runMigration() {
    console.log('🔄 Running migration 0041 manually...');

    try {
        const pool = getPool();
        const client = await pool.connect();

        const migrationPath = path.join(process.cwd(), 'db', 'migrations', '0041_create_performance_daily_view.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');

        await client.query(sql);
        console.log('✅ Migration 0041 executed successfully.');

        client.release();
    } catch (err) {
        console.error('❌ Migration failed:', err);
    }
    process.exit(0);
}

runMigration();
