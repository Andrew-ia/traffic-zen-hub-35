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

async function fixIndex() {
    console.log('🔧 Recriando índice único compatível com o script de backfill...');

    try {
        // 1. Remover índices antigos que podem conflitar
        await pool.query('DROP INDEX IF EXISTS idx_performance_metrics_unique;');
        await pool.query('DROP INDEX IF EXISTS idx_performance_metrics_unique_day;');
        await pool.query('ALTER TABLE performance_metrics DROP CONSTRAINT IF EXISTS unique_metric_per_day;');

        // 2. Criar o índice EXATAMENTE como o ON CONFLICT do script espera
        // O script usa: COALESCE(campaign_id, '00000000-0000-0000-0000-000000000000'::uuid)
        await pool.query(`
      CREATE UNIQUE INDEX idx_performance_metrics_backfill_compat ON performance_metrics (
        workspace_id, 
        platform_account_id, 
        (COALESCE(campaign_id, '00000000-0000-0000-0000-000000000000'::uuid)), 
        (COALESCE(ad_set_id, '00000000-0000-0000-0000-000000000000'::uuid)), 
        (COALESCE(ad_id, '00000000-0000-0000-0000-000000000000'::uuid)), 
        granularity, 
        metric_date
      );
    `);

        console.log('✅ Índice compatível criado com sucesso!');
    } catch (error) {
        console.error('❌ Erro ao criar índice:', error);
    } finally {
        await pool.end();
    }
}

fixIndex();
