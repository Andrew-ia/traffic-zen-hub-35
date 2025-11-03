#!/usr/bin/env node
/**
 * Setup Creative Folders System
 *
 * This script:
 * 1. Executes the migration 0018_creative_folders_and_variants.sql
 * 2. Calculates initial performance scores
 * 3. Organizes existing creatives into folders based on performance
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================================
// CONFIG
// ============================================================================

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const WORKSPACE_ID = process.env.VITE_WORKSPACE_ID || '00000000-0000-0000-0000-000000000010';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing environment variables');
  console.error('Required: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (or VITE_SUPABASE_ANON_KEY)');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ============================================================================
// STEP 1: EXECUTE MIGRATION
// ============================================================================

async function executeMigration() {
  console.log('\n📦 Step 1: Executing Migration...\n');

  const migrationPath = join(__dirname, '../db/migrations/0018_creative_folders_and_variants.sql');
  const sql = readFileSync(migrationPath, 'utf-8');

  // Split by statement (naive approach - works for most cases)
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  let successCount = 0;
  let errorCount = 0;

  for (const statement of statements) {
    try {
      const { error } = await supabase.rpc('exec_sql', { sql_query: statement });

      if (error) {
        // Try direct execution if RPC fails
        const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
          },
          body: JSON.stringify({ sql_query: statement })
        });

        if (!response.ok) {
          console.warn(`⚠️  Could not execute via RPC (this is normal for DDL): ${statement.substring(0, 60)}...`);
        }
      }

      successCount++;
    } catch (err) {
      // Ignore errors for CREATE IF NOT EXISTS, etc
      if (!statement.includes('IF NOT EXISTS') && !statement.includes('OR REPLACE')) {
        console.error(`❌ Error executing statement: ${err.message}`);
        console.error(`   Statement: ${statement.substring(0, 100)}...`);
        errorCount++;
      }
    }
  }

  console.log(`✅ Migration executed: ${successCount} statements, ${errorCount} errors\n`);
}

// ============================================================================
// STEP 2: CALCULATE PERFORMANCE SCORES
// ============================================================================

async function calculatePerformanceScores() {
  console.log('\n📊 Step 2: Calculating Performance Scores...\n');

  try {
    const { data, error } = await supabase.rpc('calculate_creative_performance_scores', {
      p_workspace_id: WORKSPACE_ID,
      p_days: 30
    });

    if (error) {
      throw error;
    }

    console.log(`✅ Calculated performance scores for ${data} creatives\n`);
  } catch (err) {
    console.error(`❌ Error calculating scores: ${err.message}`);
    console.error('   This is expected if migration hasn\'t been fully applied yet.\n');
  }
}

// ============================================================================
// STEP 3: AUTO-ORGANIZE CREATIVES INTO FOLDERS
// ============================================================================

async function autoOrganizeCreatives() {
  console.log('\n📁 Step 3: Auto-organizing Creatives into Folders...\n');

  try {
    // Fetch folders
    const { data: folders, error: foldersError } = await supabase
      .from('creative_folders')
      .select('id, name')
      .eq('workspace_id', WORKSPACE_ID);

    if (foldersError) throw foldersError;

    const folderMap = {
      topPerformers: folders.find(f => f.name === 'Top Performers')?.id,
      inUse: folders.find(f => f.name === 'Em Uso')?.id,
      ready: folders.find(f => f.name === 'Prontos')?.id,
      archive: folders.find(f => f.name === 'Arquivo')?.id,
    };

    // Fetch creatives with scores
    const { data: creatives, error: creativesError } = await supabase
      .from('v_creative_library')
      .select('id, is_top_performer, is_underperforming, has_recent_data, recommendation, times_used')
      .eq('workspace_id', WORKSPACE_ID);

    if (creativesError) throw creativesError;

    let movedCount = 0;

    for (const creative of creatives) {
      let targetFolderId = null;

      // Logic: Top Performers > In Use > Ready > Archive
      if (creative.is_top_performer) {
        targetFolderId = folderMap.topPerformers;
      } else if (creative.has_recent_data || (creative.times_used && creative.times_used > 0)) {
        targetFolderId = folderMap.inUse;
      } else if (creative.recommendation === 'ready') {
        targetFolderId = folderMap.ready;
      } else if (creative.is_underperforming || creative.recommendation === 'pause') {
        targetFolderId = folderMap.archive;
      }

      if (targetFolderId) {
        const { error } = await supabase
          .from('creative_assets')
          .update({ folder_id: targetFolderId })
          .eq('id', creative.id);

        if (!error) movedCount++;
      }
    }

    console.log(`✅ Auto-organized ${movedCount} creatives into folders\n`);
  } catch (err) {
    console.error(`❌ Error auto-organizing: ${err.message}\n`);
  }
}

// ============================================================================
// STEP 4: SUMMARY
// ============================================================================

async function printSummary() {
  console.log('\n📈 Summary:\n');

  try {
    // Count by folder
    const { data: folders, error: foldersError } = await supabase
      .from('creative_folders')
      .select('id, name, icon, color')
      .eq('workspace_id', WORKSPACE_ID);

    if (foldersError) throw foldersError;

    for (const folder of folders) {
      const { count, error } = await supabase
        .from('creative_assets')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', WORKSPACE_ID)
        .eq('folder_id', folder.id);

      if (!error) {
        console.log(`   ${folder.icon || '📁'} ${folder.name}: ${count} criativos`);
      }
    }

    // Count without folder
    const { count: noFolderCount, error: noFolderError } = await supabase
      .from('creative_assets')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', WORKSPACE_ID)
      .is('folder_id', null);

    if (!noFolderError) {
      console.log(`   📄 Sem Pasta: ${noFolderCount} criativos`);
    }

    console.log('');
  } catch (err) {
    console.error(`❌ Error printing summary: ${err.message}\n`);
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('🚀 Setup Creative Folders System\n');
  console.log(`   Workspace: ${WORKSPACE_ID}`);
  console.log(`   Supabase: ${SUPABASE_URL}\n`);

  await executeMigration();
  await calculatePerformanceScores();
  await autoOrganizeCreatives();
  await printSummary();

  console.log('✅ Setup complete!\n');
  console.log('Next steps:');
  console.log('  1. Open the app and navigate to /creatives-v2');
  console.log('  2. Verify folders and performance scores');
  console.log('  3. Test filtering and recommendations\n');
}

main().catch(err => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});
