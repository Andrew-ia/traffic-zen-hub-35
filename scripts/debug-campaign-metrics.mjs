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

async function debugMetrics() {
  try {
    console.log('Debugging Campaign Metrics...\n');

    // Get campaign info
    const { rows: campaigns } = await pool.query(`
      SELECT id, name, objective
      FROM campaigns
      WHERE name ILIKE '%leads 23/10 whatsapp%'
    `);

    if (campaigns.length === 0) {
      console.log('Campaign not found');
      await pool.end();
      return;
    }

    const campaign = campaigns[0];
    console.log('Campaign Info:');
    console.log(`  ID: ${campaign.id}`);
    console.log(`  Name: ${campaign.name}`);
    console.log(`  Objective: ${campaign.objective}\n`);

    // Check the raw metrics data
    const { rows: rawMetrics } = await pool.query(`
      SELECT
        leads,
        conversations,
        conversations_started_derived,
        conversions,
        spend
      FROM metrics_with_actions
      WHERE campaign_id = $1
      LIMIT 5
    `, [campaign.id]);

    console.log('Raw Metrics (first 5 rows):');
    rawMetrics.forEach((row, idx) => {
      console.log(`Row ${idx + 1}:`);
      console.log(`  leads: ${row.leads}`);
      console.log(`  conversations: ${row.conversations}`);
      console.log(`  conversations_started_derived: ${row.conversations_started_derived}`);
      console.log(`  conversions: ${row.conversions}`);
      console.log(`  spend: ${row.spend}`);
    });

    // Check what the view is calculating
    const { rows: viewMetrics } = await pool.query(`
      SELECT
        result_label,
        result_value,
        spend
      FROM v_campaign_kpi
      WHERE campaign_id = $1
      LIMIT 5
    `, [campaign.id]);

    console.log('\nView Output (first 5 rows):');
    viewMetrics.forEach((row, idx) => {
      console.log(`Row ${idx + 1}:`);
      console.log(`  result_label: ${row.result_label}`);
      console.log(`  result_value: ${row.result_value}`);
      console.log(`  spend: ${row.spend}`);
    });

    await pool.end();
  } catch (err) {
    console.error('Error:', err.message);
    await pool.end();
    process.exit(1);
  }
}

debugMetrics();
