import pg from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const { Pool } = pg;

const connectionString = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;

if (!connectionString) {
    console.error('❌ DATABASE_URL não encontrada no .env.local');
    process.exit(1);
}

const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

async function dropIndex() {
    console.log('🔧 Removendo índice redundante...');
    try {
        await pool.query('DROP INDEX IF EXISTS idx_performance_metrics_unique;');
        console.log('✅ Índice removido!');
    } catch (error) {
        console.error('❌ Erro:', error);
    } finally {
        await pool.end();
    }
}

dropIndex();
