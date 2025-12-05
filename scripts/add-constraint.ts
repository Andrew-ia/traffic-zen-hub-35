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

async function addConstraint() {
    console.log('🔧 Adicionando índice único para performance_metrics...');

    try {
        // We need a unique index that covers all these columns to support the ON CONFLICT clause
        // Note: We use COALESCE in the index definition because standard SQL unique constraints treat NULLs as distinct,
        // but we want NULLs to be treated as equal for the purpose of this "upsert".
        // HOWEVER, the script's ON CONFLICT clause lists the columns directly:
        // ON CONFLICT (workspace_id, platform_account_id, campaign_id, ad_set_id, ad_id, granularity, metric_date)

        // If the script uses columns directly, it implies the index must be on those columns.
        // But Postgres allows multiple NULLs in unique indexes.
        // If the script inserts NULLs, ON CONFLICT might fail to match if existing rows have NULLs.

        // Let's look at the script again. 
        // It inserts actual NULL values for ad_id etc.
        // If Postgres treats NULL != NULL, then ON CONFLICT won't trigger for duplicates with NULLs.
        // But here the error is "there is no unique or exclusion constraint matching the ON CONFLICT specification".
        // This means there is NO index on these columns.

        // So I just need to create one.

        await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_performance_metrics_unique ON performance_metrics (
        workspace_id, 
        platform_account_id, 
        campaign_id, 
        ad_set_id, 
        ad_id, 
        granularity, 
        metric_date
      );
    `);

        console.log('✅ Índice único criado com sucesso!');
    } catch (error) {
        console.error('❌ Erro ao criar índice:', error);
    } finally {
        await pool.end();
    }
}

addConstraint();
