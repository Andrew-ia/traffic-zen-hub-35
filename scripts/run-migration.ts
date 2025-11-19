import { readFileSync } from 'fs';
import { getPool } from '../server/config/database.js';

async function runMigration() {
    const migrationFile = process.argv[2];

    if (!migrationFile) {
        console.error('❌ Usage: npx tsx scripts/run-migration.ts <migration-file>');
        process.exit(1);
    }

    console.log(`📝 Running migration: ${migrationFile}`);

    try {
        const sql = readFileSync(migrationFile, 'utf-8');
        const pool = getPool();

        await pool.query(sql);

        console.log('✅ Migration completed successfully!');
        process.exit(0);
    } catch (error: any) {
        console.error('❌ Migration failed:', error.message);
        console.error(error);
        process.exit(1);
    }
}

runMigration();
