#!/usr/bin/env node
import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const db = new Client({ connectionString: process.env.SUPABASE_DATABASE_URL });

async function main() {
  try {
    await db.connect();

    console.log('\n🔍 Buscando campanhas com "whatsapp" no nome...\n');

    const whatsappCampaigns = await db.query(`
      SELECT c.id, c.name, c.status, c.objective, c.created_at
      FROM campaigns c
      WHERE c.workspace_id = '00000000-0000-0000-0000-000000000010'
        AND c.name ILIKE '%whatsapp%'
      ORDER BY c.created_at DESC
      LIMIT 10
    `);

    if (whatsappCampaigns.rows.length === 0) {
      console.log('❌ Nenhuma campanha encontrada com "whatsapp" no nome.');
      console.log('\n📊 Buscando todas as campanhas do workspace...\n');

      const allCampaigns = await db.query(`
        SELECT c.id, c.name, c.status, c.objective
        FROM campaigns c
        WHERE c.workspace_id = '00000000-0000-0000-0000-000000000010'
        ORDER BY c.created_at DESC
        LIMIT 20
      `);

      console.log(`Total de campanhas: ${allCampaigns.rows.length}\n`);
      allCampaigns.rows.forEach((c, i) => {
        console.log(`${i + 1}. ${c.name}`);
        console.log(`   ID: ${c.id}`);
        console.log(`   Status: ${c.status}`);
        console.log(`   Objetivo: ${c.objective}\n`);
      });
    } else {
      console.log(`✅ Encontradas ${whatsappCampaigns.rows.length} campanhas:\n`);
      whatsappCampaigns.rows.forEach((c, i) => {
        console.log(`${i + 1}. ${c.name}`);
        console.log(`   ID: ${c.id}`);
        console.log(`   Status: ${c.status}`);
        console.log(`   Objetivo: ${c.objective}`);
        console.log(`   Criada em: ${c.created_at}\n`);
      });
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await db.end();
  }
}

main();
