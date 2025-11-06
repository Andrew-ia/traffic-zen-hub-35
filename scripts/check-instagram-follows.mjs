import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

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

async function checkInstagramFollows() {
  try {
    console.log('Verificando dados de Seguidores Instagram...\\n');

    // Check if instagram_follows data exists in v_campaign_kpi
    const { rows } = await pool.query(`
      SELECT
        c.name as campaign_name,
        c.objective,
        kpi.metric_date,
        kpi.instagram_follows,
        kpi.result_label,
        kpi.result_value
      FROM v_campaign_kpi kpi
      JOIN campaigns c ON c.id = kpi.campaign_id
      WHERE kpi.instagram_follows > 0
        AND kpi.metric_date >= current_date - 7
      ORDER BY kpi.metric_date DESC, kpi.instagram_follows DESC
      LIMIT 20
    `);

    if (rows.length === 0) {
      console.log('❌ Nenhum dado de seguidores Instagram encontrado nos últimos 7 dias');
      console.log('\\nVerificando se há dados em performance_metrics...');

      const { rows: rawRows } = await pool.query(`
        SELECT
          c.name as campaign_name,
          pm.metric_date,
          pm.extra_metrics
        FROM performance_metrics pm
        JOIN campaigns c ON c.id = pm.campaign_id
        WHERE pm.metric_date >= current_date - 7
          AND pm.extra_metrics IS NOT NULL
        LIMIT 5
      `);

      console.log('\\nAmostra de extra_metrics:');
      rawRows.forEach((row, idx) => {
        console.log(`\\n${idx + 1}. ${row.campaign_name} (${row.metric_date})`);
        if (row.extra_metrics?.derived_metrics?.counts) {
          console.log('   Derived metrics:', JSON.stringify(row.extra_metrics.derived_metrics.counts, null, 2));
        } else {
          console.log('   Sem derived_metrics');
        }
      });
    } else {
      console.log(`✅ ${rows.length} registros com seguidores Instagram encontrados:\\n`);

      rows.forEach(row => {
        console.log(`Campanha: ${row.campaign_name}`);
        console.log(`Data: ${row.metric_date}`);
        console.log(`Seguidores Instagram: ${row.instagram_follows}`);
        console.log(`${row.result_label}: ${row.result_value}`);
        console.log('---');
      });

      // Summary
      const totalFollows = rows.reduce((sum, row) => sum + (parseInt(row.instagram_follows) || 0), 0);
      console.log(`\\n📊 Total de seguidores Instagram (últimos 7 dias): ${totalFollows}`);
    }

    await pool.end();
  } catch (err) {
    console.error('Error:', err.message);
    await pool.end();
    process.exit(1);
  }
}

checkInstagramFollows();
