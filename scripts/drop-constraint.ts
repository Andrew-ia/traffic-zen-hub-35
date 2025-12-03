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
    ssl: { rejectUnauthorized: false } // Required for Supabase
});

async function dropConstraint() {
    console.log('🔧 Removendo constraint unique_metric_per_day...');

    try {
        await pool.query('ALTER TABLE performance_metrics DROP CONSTRAINT IF EXISTS unique_metric_per_day;');
        console.log('✅ Constraint removida com sucesso!');
    } catch (error) {
        console.error('❌ Erro ao remover constraint:', error);
    } finally {
        await pool.end();
    }
}

dropConstraint();
