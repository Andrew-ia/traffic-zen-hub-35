#!/usr/bin/env node
/**
 * Script to apply v_campaign_kpi view to the database
 * Usage: node scripts/apply-kpi-view.js
 */

const fs = require('fs');
const path = require('path');

// Read environment variables
require('dotenv').config({ path: '.env.local' });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ Error: DATABASE_URL not found in .env.local');
  console.error('');
  console.error('Please add DATABASE_URL to your .env.local file:');
  console.error('DATABASE_URL=postgresql://user:password@host:port/database');
  process.exit(1);
}

// We'll use pg library if available, otherwise provide instructions
async function applyView() {
  try {
    const { Client } = require('pg');

    const client = new Client({
      connectionString: DATABASE_URL,
    });

    console.log('🔌 Connecting to database...');
    await client.connect();

    // Read the SQL file
    const sqlPath = path.join(__dirname, '..', 'supabase', 'sql', '02_views.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('📄 Executing SQL from supabase/sql/02_views.sql...');
    console.log('');

    await client.query(sql);

    console.log('✅ View v_campaign_kpi created/updated successfully!');
    console.log('');
    console.log('🔄 Now refresh your browser to see the KPI data.');

    await client.end();
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND' && error.message.includes('pg')) {
      console.error('❌ Error: pg module not found');
      console.error('');
      console.error('Install it with: npm install pg');
      console.error('');
      console.error('Or apply the SQL manually:');
      console.error('1. Go to Supabase Dashboard > SQL Editor');
      console.error('2. Paste contents of supabase/sql/02_views.sql');
      console.error('3. Click "Run"');
      process.exit(1);
    }

    console.error('❌ Error applying view:', error.message);
    console.error('');
    console.error('Please apply manually via Supabase Dashboard:');
    console.error('1. Go to SQL Editor');
    console.error('2. Paste contents of supabase/sql/02_views.sql');
    console.error('3. Click "Run"');
    process.exit(1);
  }
}

applyView();
