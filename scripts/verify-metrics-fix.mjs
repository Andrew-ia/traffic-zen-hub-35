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

async function verifyFix() {
  try {
    console.log('Checking Campaign KPI metrics after fix...\n');

    const { rows } = await pool.query(`
      SELECT
        c.name as campaign_name,
        c.objective,
        kpi.result_label,
        SUM(kpi.result_value)::int as total_result_value,
        SUM(kpi.spend)::numeric(10,2) as total_spend
      FROM v_campaign_kpi kpi
      JOIN campaigns c ON c.id = kpi.campaign_id
      WHERE c.name ILIKE '%leads 23/10 whatsapp%'
      GROUP BY c.name, c.objective, kpi.result_label
    `);

    if (rows.length === 0) {
      console.log('No results found for "Leads 23/10 Whatsapp" campaign');
    } else {
      console.log('Results:');
      rows.forEach(row => {
        console.log(`Campaign: ${row.campaign_name}`);
        console.log(`Objective: ${row.objective}`);
        console.log(`Result Label: ${row.result_label}`);
        console.log(`Total Results: ${row.total_result_value}`);
        console.log(`Total Spend: R$ ${row.total_spend}`);
        console.log('---');
      });

      const resultValue = rows[0]?.total_result_value;
      if (resultValue === 48) {
        console.log('✓ SUCCESS: Result value is now 48, matching Meta Ads Manager!');
      } else if (resultValue === 83) {
        console.log('✗ ISSUE: Result value is still 83, fix did not work');
      } else {
        console.log(`? Result value is ${resultValue}, expected 48`);
      }
    }

    await pool.end();
  } catch (err) {
    console.error('Error:', err.message);
    await pool.end();
    process.exit(1);
  }
}

verifyFix();
