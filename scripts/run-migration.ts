import 'dotenv/config';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const { Pool } = pg;

async function runMigration() {
    const connectionString = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;

    if (!connectionString) {
        console.error('❌ DATABASE_URL not found in environment');
        process.exit(1);
    }

    console.log('🔌 Connecting to database...');
    const pool = new Pool({ connectionString });

    try {
        const migrationPath = join(__dirname, '../db/migrations/0039_enhance_leads_table.sql');
        const sql = readFileSync(migrationPath, 'utf-8');

        console.log('📝 Running migration: 0039_enhance_leads_table.sql');
        await pool.query(sql);

        console.log('✅ Migration completed successfully!');

        // Verify columns were added
        const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'leads' 
      AND column_name IN ('email', 'origem', 'campanha', 'observacoes', 'ultima_atualizacao', 'announces_online', 'traffic_investment')
      ORDER BY column_name
    `);

        console.log('\n📊 New columns added:');
        result.rows.forEach(row => {
            console.log(`  ✓ ${row.column_name} (${row.data_type})`);
        });

        // Verify indexes
        const indexes = await pool.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'leads' 
      AND indexname LIKE 'idx_leads_%'
      ORDER BY indexname
    `);

        console.log('\n🔍 Indexes created:');
        indexes.rows.forEach(row => {
            console.log(`  ✓ ${row.indexname}`);
        });

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

runMigration();
