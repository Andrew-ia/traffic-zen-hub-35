#!/usr/bin/env node

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const { Client } = pg;

async function checkData() {
  const client = new Client({
    connectionString: process.env.SUPABASE_DATABASE_URL,
  });

  try {
    await client.connect();

    console.log('📊 Instagram Performance Metrics:\n');

    const result = await client.query(`
      SELECT
        metric_date,
        impressions,
        clicks,
        spend,
        extra_metrics
      FROM performance_metrics
      WHERE platform_account_id IN (
        SELECT id FROM platform_accounts WHERE platform_key = 'instagram'
      )
      ORDER BY metric_date DESC
      LIMIT 10
    `);

    for (const row of result.rows) {
      console.log(`Date: ${row.metric_date}`);
      console.log(`  Impressions: ${row.impressions}`);
      console.log(`  Clicks: ${row.clicks}`);
      console.log(`  Spend: ${row.spend}`);
      console.log(`  Extra metrics:`, JSON.stringify(row.extra_metrics, null, 2));
      console.log('');
    }

    console.log(`Total records: ${result.rows.length}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

checkData();
