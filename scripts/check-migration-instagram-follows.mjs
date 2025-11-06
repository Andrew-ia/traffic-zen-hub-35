import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

const { Pool } = pg;

const databaseUrl = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('Missing SUPABASE_DATABASE_URL or DATABASE_URL environment variable');
  process.exit(1);
}

const pool = new Pool({
  connectionString: databaseUrl
});

async function checkAndApplyMigration() {
  try {
    console.log('Verificando se a coluna instagram_follows existe na view v_campaign_kpi...\\n');

    // Check if column exists
    const { rows } = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'v_campaign_kpi'
        AND column_name = 'instagram_follows'
    `);

    if (rows.length === 0) {
      console.log('❌ Coluna instagram_follows NÃO encontrada na view');
      console.log('\\n📝 Aplicando migration 0017_fix_kpi_view_campaign_level_only.sql...\\n');

      const migrationPath = join(__dirname, '..', 'db', 'migrations', '0017_fix_kpi_view_campaign_level_only.sql');
      const migrationSQL = readFileSync(migrationPath, 'utf8');

      await pool.query(migrationSQL);

      console.log('✅ Migration aplicada com sucesso!\\n');

      // Verify again
      const { rows: verifyRows } = await pool.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'v_campaign_kpi'
          AND column_name = 'instagram_follows'
      `);

      if (verifyRows.length > 0) {
        console.log('✅ Verificação: Coluna instagram_follows agora existe na view!');
      } else {
        console.log('❌ Verificação: Falhou - coluna ainda não existe');
      }
    } else {
      console.log('✅ Coluna instagram_follows JÁ existe na view v_campaign_kpi');

      // Test query
      const { rows: testRows } = await pool.query(`
        SELECT
          c.name,
          SUM(kpi.instagram_follows)::int as total_follows
        FROM v_campaign_kpi kpi
        JOIN campaigns c ON c.id = kpi.campaign_id
        WHERE kpi.metric_date >= current_date - 7
        GROUP BY c.name
        HAVING SUM(kpi.instagram_follows) > 0
        ORDER BY total_follows DESC
        LIMIT 5
      `);

      if (testRows.length > 0) {
        console.log('\\n📊 Campanhas com seguidores Instagram (últimos 7 dias):\\n');
        testRows.forEach(row => {
          console.log(`  ${row.name}: ${row.total_follows} seguidores`);
        });
      } else {
        console.log('\\n📊 Nenhuma campanha teve seguidores Instagram nos últimos 7 dias');
        console.log('   (Isso é normal se as campanhas não são de crescimento de seguidores)');
      }
    }

    await pool.end();
  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err.stack);
    await pool.end();
    process.exit(1);
  }
}

checkAndApplyMigration();
