#!/usr/bin/env node
/**
 * Script to apply v_campaign_kpi view to the database via Supabase API
 * Usage: node scripts/apply-kpi-view.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_KEY;
const PROJECT_ID = process.env.SUPABASE_PROJECT_ID;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Error: Missing Supabase credentials');
  console.error('');
  console.error('Required in .env.local:');
  console.error('- SUPABASE_URL');
  console.error('- SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

async function applyView() {
  try {
    // Read the SQL file
    const sqlPath = path.join(__dirname, '..', 'supabase', 'sql', '02_views.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('📄 Reading SQL from supabase/sql/02_views.sql...');
    console.log(`   File size: ${(sql.length / 1024).toFixed(2)} KB`);
    console.log('');

    // Use Supabase REST API to execute SQL
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({ sql }),
    });

    if (!response.ok) {
      // RPC might not be available, provide manual instructions
      console.log('⚠️  Cannot execute SQL via API (this is normal)');
      console.log('');
      console.log('📋 Please apply the view manually:');
      console.log('');
      console.log('Option 1: Supabase Dashboard');
      console.log('  1. Go to: https://supabase.com/dashboard/project/' + PROJECT_ID + '/sql/new');
      console.log('  2. Paste the contents of: supabase/sql/02_views.sql');
      console.log('  3. Click "Run"');
      console.log('');
      console.log('Option 2: Supabase CLI');
      console.log('  npx supabase db push');
      console.log('');
      console.log('After applying, refresh your browser to see KPI data! 🎯');
      return;
    }

    const data = await response.json();
    console.log('✅ View v_campaign_kpi created/updated successfully!');
    console.log('');
    console.log('🔄 Now refresh your browser to see the KPI data.');

  } catch (error) {
    console.error('⚠️  Error:', error.message);
    console.error('');
    console.error('📋 Please apply the view manually:');
    console.error('');
    console.error('1. Go to Supabase Dashboard > SQL Editor');
    console.error('   URL: https://supabase.com/dashboard/project/' + PROJECT_ID + '/sql/new');
    console.error('2. Paste contents of supabase/sql/02_views.sql');
    console.error('3. Click "Run"');
    console.error('');
    console.error('After applying, refresh your browser! 🎯');
  }
}

applyView();
