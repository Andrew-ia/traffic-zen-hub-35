#!/usr/bin/env node
import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const { Client } = pg

async function fixInstagramDatabase() {
  const connStr = process.env.SUPABASE_DATABASE_URL
  if (!connStr) {
    console.error('❌ SUPABASE_DATABASE_URL não encontrada')
    process.exit(1)
  }

  console.log('🔧 Corrigindo problemas do banco de dados Instagram...')
  const client = new Client({ 
    connectionString: connStr, 
    ssl: { rejectUnauthorized: false } 
  })
  
  try {
    await client.connect()
    console.log('✅ Conectado ao Supabase')

    // 1. Remover a tabela problemática instagram_media_insights_daily
    console.log('\n🗑️  REMOVENDO TABELA PROBLEMÁTICA')
    console.log('=' .repeat(50))
    
    // Drop constraints primeiro
    try {
      await client.query(`
        ALTER TABLE instagram_media_insights_daily 
        DROP CONSTRAINT IF EXISTS instagram_media_insights_daily_workspace_id_fkey CASCADE
      `)
      console.log('✅ Constraint workspace_id removida')
    } catch (err) {
      console.log('⚠️  Constraint workspace_id não encontrada')
    }

    // Drop a tabela
    try {
      await client.query('DROP TABLE IF EXISTS instagram_media_insights_daily CASCADE')
      console.log('✅ Tabela instagram_media_insights_daily removida')
    } catch (err) {
      console.error('❌ Erro removendo tabela:', err.message)
    }

    // 2. Otimizar índices da tabela instagram_profile_snapshots
    console.log('\n🔧 OTIMIZANDO ÍNDICES')
    console.log('=' .repeat(50))
    
    // Recriar índice otimizado
    try {
      await client.query(`
        DROP INDEX IF EXISTS idx_instagram_profile_snapshots_ws
      `)
      await client.query(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_instagram_profile_optimized 
        ON instagram_profile_snapshots (workspace_id, captured_at DESC) 
        WHERE workspace_id IS NOT NULL
      `)
      console.log('✅ Índice otimizado criado para instagram_profile_snapshots')
    } catch (err) {
      console.error('⚠️  Erro criando índice otimizado:', err.message)
    }

    // 3. Limpar dados corruptoss ou problemáticos
    console.log('\n🧹 LIMPANDO DADOS PROBLEMÁTICOS')
    console.log('=' .repeat(50))
    
    // Limpar registros de performance_metrics com extra_metrics vazios
    const cleanupResult = await client.query(`
      DELETE FROM performance_metrics 
      WHERE platform_account_id IN (
        SELECT id FROM platform_accounts WHERE platform_key = 'instagram'
      )
      AND (extra_metrics IS NULL OR extra_metrics = '{}' OR extra_metrics = 'null')
    `)
    console.log(`✅ ${cleanupResult.rowCount} registros problemáticos removidos de performance_metrics`)

    // 4. Otimizar performance_metrics para Instagram
    console.log('\n🔧 OTIMIZANDO performance_metrics')
    console.log('=' .repeat(50))
    
    // Criar índice específico para Instagram
    try {
      await client.query(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_performance_metrics_instagram 
        ON performance_metrics (platform_account_id, metric_date DESC) 
        WHERE platform_account_id IN (
          SELECT id FROM platform_accounts WHERE platform_key = 'instagram'
        )
      `)
      console.log('✅ Índice específico criado para performance_metrics Instagram')
    } catch (err) {
      console.error('⚠️  Erro criando índice específico:', err.message)
    }

    // 5. Vacuum e analyze das tabelas
    console.log('\n🧽 EXECUTANDO VACUUM E ANALYZE')
    console.log('=' .repeat(50))
    
    const instagramTables = [
      'instagram_profile_snapshots', 
      'instagram_media', 
      'instagram_media_comments',
      'performance_metrics'
    ]
    
    for (const table of instagramTables) {
      try {
        await client.query(`VACUUM ANALYZE ${table}`)
        console.log(`✅ VACUUM ANALYZE executado em ${table}`)
      } catch (err) {
        console.error(`⚠️  Erro em VACUUM ANALYZE ${table}:`, err.message)
      }
    }

    // 6. Verificar integridade dos dados após correção
    console.log('\n✅ VERIFICANDO INTEGRIDADE APÓS CORREÇÃO')
    console.log('=' .repeat(50))
    
    const platformAccount = await client.query(`
      SELECT id FROM platform_accounts 
      WHERE platform_key = 'instagram'
      LIMIT 1
    `)
    
    if (platformAccount.rows.length > 0) {
      const metrics = await client.query(`
        SELECT COUNT(*) as total,
               MIN(metric_date) as min_date,
               MAX(metric_date) as max_date
        FROM performance_metrics 
        WHERE platform_account_id = $1
      `, [platformAccount.rows[0].id])
      
      console.log(`📊 Performance metrics Instagram: ${metrics.rows[0].total} registros`)
      console.log(`📊 Período: ${metrics.rows[0].min_date} até ${metrics.rows[0].max_date}`)
    }

    const profiles = await client.query('SELECT COUNT(*) FROM instagram_profile_snapshots')
    console.log(`📊 Profile snapshots: ${profiles.rows[0].count} registros`)

    console.log('\n🎉 CORREÇÕES APLICADAS COM SUCESSO!')
    console.log('=' .repeat(50))
    console.log('✅ Tabela problemática removida')
    console.log('✅ Índices otimizados')  
    console.log('✅ Dados problemáticos limpos')
    console.log('✅ Performance otimizada')
    console.log('✅ Integridade verificada')

  } catch (error) {
    console.error('❌ Erro durante correção:', error.message)
    console.error('Stack:', error.stack)
  } finally {
    await client.end()
    console.log('\n🔧 Correção finalizada.')
  }
}

fixInstagramDatabase().catch(console.error)