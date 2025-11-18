const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function checkInstagramTables() {
  console.log('🔍 Analisando estrutura do Instagram no banco...');
  
  const client = new Client({
    connectionString: process.env.SUPABASE_POOLER_URL || process.env.SUPABASE_DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    
    // Verificar tabelas Instagram
    console.log('\n📋 Tabelas relacionadas ao Instagram:');
    const tables = await client.query(`
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name LIKE '%instagram%' 
      ORDER BY table_name, ordinal_position
    `);
    
    if (tables.rows.length === 0) {
      console.log('❌ Nenhuma tabela Instagram encontrada!');
    } else {
      const tableMap = {};
      tables.rows.forEach(row => {
        if (!tableMap[row.table_name]) tableMap[row.table_name] = [];
        tableMap[row.table_name].push(`${row.column_name} (${row.data_type})`);
      });
      
      Object.keys(tableMap).forEach(table => {
        console.log(`\n📊 ${table}:`);
        tableMap[table].forEach(col => console.log(`   - ${col}`));
      });
    }
    
    // Verificar credenciais Instagram
    console.log('\n🔐 Verificando credenciais Instagram:');
    const creds = await client.query(`
      SELECT platform_key, created_at, updated_at 
      FROM integration_credentials 
      WHERE platform_key = 'instagram' 
      AND workspace_id = $1
    `, [process.env.WORKSPACE_ID]);
    
    if (creds.rows.length === 0) {
      console.log('❌ Credenciais Instagram não encontradas!');
    } else {
      console.log(`✅ Credenciais encontradas: ${creds.rows[0].created_at}`);
    }
    
    // Verificar platform_accounts Instagram
    console.log('\n📱 Verificando platform_accounts Instagram:');
    
    // First check what columns exist
    const colCheck = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'platform_accounts'
    `);
    console.log('Colunas disponíveis:', colCheck.rows.map(r => r.column_name));
    
    const accounts = await client.query(`
      SELECT external_id, name, status, created_at 
      FROM platform_accounts 
      WHERE platform_key = 'instagram' 
      AND workspace_id = $1
    `, [process.env.WORKSPACE_ID]);
    
    if (accounts.rows.length === 0) {
      console.log('❌ Platform account Instagram não encontrado!');
    } else {
      accounts.rows.forEach(acc => {
        console.log(`✅ Account: ${acc.external_id} (${acc.name}) - Status: ${acc.status}`);
      });
    }
    
    // Verificar dados existentes
    console.log('\n📈 Verificando dados Instagram existentes:');
    
    // Check if instagram_media table exists first
    const hasInstagramMedia = tables.rows.some(row => row.table_name === 'instagram_media');
    
    if (hasInstagramMedia) {
      const mediaCount = await client.query(`
        SELECT COUNT(*) as count, 
               MIN(posted_at) as oldest, 
               MAX(posted_at) as newest 
        FROM instagram_media 
        WHERE workspace_id = $1
      `, [process.env.WORKSPACE_ID]);
      
      const count = mediaCount.rows[0];
      if (count.count > 0) {
        const oldest = count.oldest ? new Date(count.oldest).toLocaleDateString() : 'N/A';
        const newest = count.newest ? new Date(count.newest).toLocaleDateString() : 'N/A';
        console.log(`📸 Media posts: ${count.count} (de ${oldest} até ${newest})`);
      } else {
        console.log('📸 Media posts: 0');
      }
    }
    
    const hasInstagramInsights = tables.rows.some(row => row.table_name === 'instagram_insights');
    
    if (hasInstagramInsights) {
      const insightsCount = await client.query(`
        SELECT COUNT(*) as count, 
               MIN(date) as oldest, 
               MAX(date) as newest 
        FROM instagram_insights 
        WHERE workspace_id = $1
      `, [process.env.WORKSPACE_ID]);
      
      const count = insightsCount.rows[0];
      if (count.count > 0) {
        console.log(`📊 Insights: ${count.count} (de ${count.oldest} até ${count.newest})`);
      } else {
        console.log('📊 Insights: 0');
      }
    }
    
    const hasPerformanceMetrics = tables.rows.some(row => row.table_name === 'performance_metrics');
    
    if (hasPerformanceMetrics) {
      const perfCount = await client.query(`
        SELECT COUNT(*) as count, 
               MIN(metric_date) as oldest, 
               MAX(metric_date) as newest 
        FROM performance_metrics pm
        JOIN platform_accounts pa ON pm.platform_account_id = pa.id
        WHERE pa.platform_key = 'instagram' 
        AND pm.workspace_id = $1
      `, [process.env.WORKSPACE_ID]);
      
      const count = perfCount.rows[0];
      if (count.count > 0) {
        console.log(`⚡ Performance metrics: ${count.count} (de ${count.oldest} até ${count.newest})`);
      } else {
        console.log('⚡ Performance metrics: 0');
      }
    }
    
    console.log('\n🔍 Análise concluída!');
    
  } catch (error) {
    console.error('❌ Erro na análise:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

checkInstagramTables().catch(console.error);