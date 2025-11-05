#!/usr/bin/env node
import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function getWorkspaceIds() {
  const client = new Client({
    connectionString: process.env.SUPABASE_DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('\n📊 Buscando Workspace IDs...\n');

    // Get workspace IDs from campaign_library
    const campaigns = await client.query(`
      SELECT DISTINCT workspace_id, COUNT(*) as total
      FROM campaign_library
      GROUP BY workspace_id
      ORDER BY total DESC
    `);

    if (campaigns.rows.length > 0) {
      console.log('🎯 Workspace IDs em campaign_library:');
      campaigns.rows.forEach(row => {
        console.log(`   - ${row.workspace_id} (${row.total} campanhas)`);
      });
    } else {
      console.log('⚠️  Nenhuma campanha encontrada ainda');
    }

    // Try to get from other tables
    const tables = ['campaigns', 'ads', 'sync_jobs'];
    for (const table of tables) {
      try {
        const result = await client.query(`
          SELECT DISTINCT workspace_id
          FROM ${table}
          WHERE workspace_id IS NOT NULL
          LIMIT 5
        `);

        if (result.rows.length > 0) {
          console.log(`\n✅ Workspace IDs em ${table}:`);
          result.rows.forEach(row => {
            console.log(`   - ${row.workspace_id}`);
          });
        }
      } catch (err) {
        // Table doesn't exist or doesn't have workspace_id column
      }
    }

    console.log('\n');
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

getWorkspaceIds();
