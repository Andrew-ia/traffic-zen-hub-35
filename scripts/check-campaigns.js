#!/usr/bin/env node
import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const db = new Client({ connectionString: process.env.SUPABASE_DATABASE_URL });

async function main() {
  try {
    await db.connect();

    const result = await db.query(`
      SELECT c.id, c.name, c.status, c.external_id, pa.platform_key
      FROM campaigns c
      JOIN platform_accounts pa ON c.platform_account_id = pa.id
      WHERE pa.platform_key = 'google_ads'
      ORDER BY c.updated_at DESC
      LIMIT 10
    `);

    console.log('\n📊 Campanhas do Google Ads no banco:\n');
    result.rows.forEach(row => {
      console.log(`ID: ${row.id}`);
      console.log(`Nome: ${row.name}`);
      console.log(`Status: ${row.status}`);
      console.log(`External ID: ${row.external_id}`);
      console.log('---');
    });

  } catch (error) {
    console.error('Erro:', error.message);
  } finally {
    await db.end();
  }
}

main();
