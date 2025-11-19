#!/usr/bin/env node
import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const { Client } = pg

async function analyzeInstagramIssues() {
  const connStr = process.env.SUPABASE_DATABASE_URL
  if (!connStr) {
    console.error('❌ SUPABASE_DATABASE_URL não encontrada')
    process.exit(1)
  }

  console.log('🔍 Analisando problemas específicos do Instagram...')
  const client = new Client({ 
    connectionString: connStr, 
    ssl: { rejectUnauthorized: false } 
  })
  
  try {
    await client.connect()
    console.log('✅ Conectado ao Supabase')

    // 1. Verificar dados problemáticos na tabela instagram_media_insights_daily
    console.log('\n🔍 ANALISANDO: instagram_media_insights_daily')
    console.log('=' .repeat(60))
    
    const insightsCount = await client.query(`
      SELECT COUNT(*) as total,
             COUNT(DISTINCT media_id) as unique_medias,
             MIN(metric_date) as min_date,
             MAX(metric_date) as max_date,
             COUNT(CASE WHEN reach IS NULL THEN 1 END) as null_reach,
             COUNT(CASE WHEN impressions IS NULL THEN 1 END) as null_impressions,
             MAX(reach) as max_reach,
             MAX(impressions) as max_impressions,
             AVG(reach) as avg_reach,
             AVG(impressions) as avg_impressions
      FROM instagram_media_insights_daily
    `)
    
    const insights = insightsCount.rows[0]
    console.log(`📊 Total registros: ${insights.total}`)
    console.log(`📊 Mídias únicas: ${insights.unique_medias}`)
    console.log(`📊 Período: ${insights.min_date} até ${insights.max_date}`)
    console.log(`📊 Reach NULL: ${insights.null_reach}`)
    console.log(`📊 Impressions NULL: ${insights.null_impressions}`)
    console.log(`📊 Max reach: ${insights.max_reach}`)
    console.log(`📊 Max impressions: ${insights.max_impressions}`)
    console.log(`📊 Avg reach: ${Math.round(insights.avg_reach || 0)}`)
    console.log(`📊 Avg impressions: ${Math.round(insights.avg_impressions || 0)}`)

    // 2. Verificar se há valores extremos que podem causar problemas
    console.log('\n🔍 VERIFICANDO VALORES EXTREMOS')
    console.log('=' .repeat(60))
    
    const extremeValues = await client.query(`
      SELECT 
        COUNT(CASE WHEN reach > 1000000 THEN 1 END) as extreme_reach,
        COUNT(CASE WHEN impressions > 10000000 THEN 1 END) as extreme_impressions,
        COUNT(CASE WHEN total_interactions > 100000 THEN 1 END) as extreme_interactions,
        COUNT(CASE WHEN reach < 0 THEN 1 END) as negative_reach,
        COUNT(CASE WHEN impressions < 0 THEN 1 END) as negative_impressions
      FROM instagram_media_insights_daily
    `)
    
    const extreme = extremeValues.rows[0]
    console.log(`⚠️  Reach > 1M: ${extreme.extreme_reach}`)
    console.log(`⚠️  Impressions > 10M: ${extreme.extreme_impressions}`)
    console.log(`⚠️  Interactions > 100K: ${extreme.extreme_interactions}`)
    console.log(`❌ Reach negativo: ${extreme.negative_reach}`)
    console.log(`❌ Impressions negativo: ${extreme.negative_impressions}`)

    // 3. Verificar duplicatas na tabela de insights
    console.log('\n🔍 VERIFICANDO DUPLICATAS')
    console.log('=' .repeat(60))
    
    const duplicates = await client.query(`
      SELECT workspace_id, media_id, metric_date, COUNT(*) as count
      FROM instagram_media_insights_daily
      GROUP BY workspace_id, media_id, metric_date
      HAVING COUNT(*) > 1
      ORDER BY count DESC
      LIMIT 5
    `)
    
    if (duplicates.rows.length > 0) {
      console.log('⚠️  DUPLICATAS ENCONTRADAS:')
      duplicates.rows.forEach(dup => {
        console.log(`  ${dup.media_id} | ${dup.metric_date} | ${dup.count} registros`)
      })
    } else {
      console.log('✅ Nenhuma duplicata encontrada')
    }

    // 4. Verificar performance_metrics do Instagram
    console.log('\n🔍 ANALISANDO: performance_metrics (Instagram)')
    console.log('=' .repeat(60))
    
    const platformAccount = await client.query(`
      SELECT id FROM platform_accounts 
      WHERE platform_key = 'instagram'
      LIMIT 1
    `)
    
    if (platformAccount.rows.length > 0) {
      const platformAccountId = platformAccount.rows[0].id
      
      const perfMetrics = await client.query(`
        SELECT COUNT(*) as total,
               COUNT(DISTINCT metric_date) as unique_dates,
               MIN(metric_date) as min_date,
               MAX(metric_date) as max_date,
               COUNT(CASE WHEN extra_metrics IS NULL THEN 1 END) as null_extra,
               AVG(CASE WHEN extra_metrics::text != 'null' 
                        THEN jsonb_array_length(
                          CASE WHEN jsonb_typeof(extra_metrics) = 'array' 
                               THEN extra_metrics 
                               ELSE '[]'::jsonb END
                        ) 
                        ELSE 0 END) as avg_extra_size
        FROM performance_metrics 
        WHERE platform_account_id = $1
      `, [platformAccountId])
      
      const perf = perfMetrics.rows[0]
      console.log(`📊 Total registros: ${perf.total}`)
      console.log(`📊 Datas únicas: ${perf.unique_dates}`)
      console.log(`📊 Período: ${perf.min_date} até ${perf.max_date}`)
      console.log(`📊 Extra_metrics NULL: ${perf.null_extra}`)
      console.log(`📊 Tamanho médio extra_metrics: ${Math.round(perf.avg_extra_size || 0)}`)

      // Verificar tamanho dos extra_metrics
      const largeExtra = await client.query(`
        SELECT metric_date, 
               LENGTH(extra_metrics::text) as size,
               CASE WHEN extra_metrics IS NOT NULL 
                    THEN jsonb_typeof(extra_metrics) 
                    ELSE 'null' END as type
        FROM performance_metrics 
        WHERE platform_account_id = $1
        ORDER BY LENGTH(extra_metrics::text) DESC
        LIMIT 5
      `, [platformAccountId])
      
      console.log('\n📊 MAIORES extra_metrics:')
      largeExtra.rows.forEach(row => {
        console.log(`  ${row.metric_date} | ${Math.round(row.size/1024)}KB | tipo: ${row.type}`)
      })
    }

    // 5. Verificar constraints problemáticas
    console.log('\n🔍 VERIFICANDO CONSTRAINTS')
    console.log('=' .repeat(60))
    
    const constraints = await client.query(`
      SELECT 
        con.conname as constraint_name,
        t.relname as table_name,
        con.contype as constraint_type,
        pg_get_constraintdef(con.oid) as definition
      FROM pg_constraint con
      JOIN pg_class t ON t.oid = con.conrelid
      WHERE t.relname LIKE '%instagram%'
      ORDER BY t.relname, con.conname
    `)
    
    constraints.rows.forEach(constraint => {
      console.log(`🔒 ${constraint.table_name}.${constraint.constraint_name}`)
      console.log(`   Tipo: ${constraint.constraint_type}`)
      console.log(`   ${constraint.definition}`)
    })

    // 6. Verificar estatísticas das tabelas
    console.log('\n🔍 ESTATÍSTICAS DAS TABELAS')
    console.log('=' .repeat(60))
    
    const stats = await client.query(`
      SELECT 
        schemaname,
        tablename,
        n_tup_ins as inserts,
        n_tup_upd as updates,
        n_tup_del as deletes,
        n_live_tup as live_rows,
        n_dead_tup as dead_rows,
        last_vacuum,
        last_autovacuum,
        last_analyze,
        last_autoanalyze
      FROM pg_stat_user_tables 
      WHERE tablename LIKE '%instagram%'
      ORDER BY tablename
    `)
    
    stats.rows.forEach(stat => {
      console.log(`📊 ${stat.tablename}:`)
      console.log(`   Rows: ${stat.live_rows} live, ${stat.dead_rows} dead`)
      console.log(`   Operations: ${stat.inserts} ins, ${stat.updates} upd, ${stat.deletes} del`)
      console.log(`   Last vacuum: ${stat.last_vacuum || 'never'}`)
      console.log(`   Last analyze: ${stat.last_analyze || 'never'}`)
    })

  } catch (error) {
    console.error('❌ Erro durante análise:', error.message)
    console.error('Stack:', error.stack)
  } finally {
    await client.end()
    console.log('\n🔍 Análise concluída.')
  }
}

analyzeInstagramIssues().catch(console.error)