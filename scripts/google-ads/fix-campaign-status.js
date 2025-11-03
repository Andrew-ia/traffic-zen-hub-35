#!/usr/bin/env node
import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const db = new Client({ connectionString: process.env.SUPABASE_DATABASE_URL });

async function main() {
  try {
    await db.connect();
    console.log('✅ Conectado ao banco de dados\n');

    // Update status to 'active' for campaigns that have recent metrics
    const updateResult = await db.query(`
      UPDATE campaigns c
      SET status = 'active'
      WHERE c.id IN (
        SELECT DISTINCT pm.campaign_id
        FROM performance_metrics pm
        WHERE pm.metric_date >= CURRENT_DATE - INTERVAL '30 days'
        AND pm.impressions > 0
      )
      AND c.platform_account_id IN (
        SELECT id FROM platform_accounts WHERE platform_key = 'google_ads'
      )
      AND c.status = 'draft'
      RETURNING id, name, status
    `);

    console.log(`✅ ${updateResult.rowCount} campanhas atualizadas para status "active"\n`);

    if (updateResult.rows.length > 0) {
      console.log('📋 Campanhas atualizadas:');
      updateResult.rows.forEach(row => {
        console.log(`   - ${row.name}`);
      });
    }

    // Show campaigns that still have draft status (probably paused or no recent data)
    const draftCampaigns = await db.query(`
      SELECT c.id, c.name, c.status
      FROM campaigns c
      WHERE c.platform_account_id IN (
        SELECT id FROM platform_accounts WHERE platform_key = 'google_ads'
      )
      AND c.status = 'draft'
    `);

    if (draftCampaigns.rows.length > 0) {
      console.log(`\n📌 ${draftCampaigns.rowCount} campanhas ainda com status "draft" (sem métricas recentes):`);
      draftCampaigns.rows.forEach(row => {
        console.log(`   - ${row.name}`);
      });
      console.log('\n💡 Estas campanhas provavelmente estão pausadas ou sem dados recentes.');
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
    throw error;
  } finally {
    await db.end();
  }
}

main();
