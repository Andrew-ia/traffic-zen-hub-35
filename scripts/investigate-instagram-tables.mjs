#!/usr/bin/env node
import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const { Client } = pg

async function investigateInstagramTables() {
  const connStr = process.env.SUPABASE_DATABASE_URL
  if (!connStr) {
    console.error('❌ SUPABASE_DATABASE_URL não encontrada')
    process.exit(1)
  }

  console.log('🔍 Conectando ao banco de dados...')
  const client = new Client({ 
    connectionString: connStr, 
    ssl: { rejectUnauthorized: false } 
  })
  
  try {
    await client.connect()
    console.log('✅ Conectado ao Supabase')

    // 1. Verificar quais tabelas Instagram existem
    console.log('\n📊 TABELAS INSTAGRAM EXISTENTES:')
    console.log('=' .repeat(50))
    const tablesResult = await client.query(`
      SELECT table_name, table_type 
      FROM information_schema.tables 
      WHERE table_name LIKE '%instagram%' 
      AND table_schema = 'public'
      ORDER BY table_name
    `)
    
    if (tablesResult.rows.length === 0) {
      console.log('❌ Nenhuma tabela Instagram encontrada!')
      return
    }

    tablesResult.rows.forEach(row => {
      console.log(`📋 ${row.table_name} (${row.table_type})`)
    })

    // 2. Verificar estrutura da tabela instagram_profile_snapshots
    if (tablesResult.rows.some(r => r.table_name === 'instagram_profile_snapshots')) {
      console.log('\n🔍 ESTRUTURA: instagram_profile_snapshots')
      console.log('=' .repeat(50))
      const profileStructure = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default,
               character_maximum_length, numeric_precision
        FROM information_schema.columns 
        WHERE table_name = 'instagram_profile_snapshots'
        ORDER BY ordinal_position
      `)
      
      profileStructure.rows.forEach(col => {
        console.log(`  ${col.column_name}: ${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''}${col.numeric_precision ? `(${col.numeric_precision})` : ''} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'} ${col.column_default || ''}`)
      })

      // Verificar dados
      const profileCount = await client.query('SELECT COUNT(*) FROM instagram_profile_snapshots')
      console.log(`📊 Registros: ${profileCount.rows[0].count}`)
    }

    // 3. Verificar estrutura da tabela performance_metrics (para Instagram)
    console.log('\n🔍 PERFORMANCE_METRICS (Instagram)')
    console.log('=' .repeat(50))
    const platformAccounts = await client.query(`
      SELECT id, platform_key, created_at
      FROM platform_accounts 
      WHERE platform_key = 'instagram'
      ORDER BY created_at
    `)
    
    if (platformAccounts.rows.length > 0) {
      console.log(`📋 Platform Accounts Instagram: ${platformAccounts.rows.length}`)
      platformAccounts.rows.forEach(acc => {
        console.log(`  ID: ${acc.id} | Criado: ${acc.created_at}`)
      })

      // Verificar métricas do Instagram
      const instagramMetrics = await client.query(`
        SELECT COUNT(*) as total,
               MIN(metric_date) as min_date,
               MAX(metric_date) as max_date,
               COUNT(DISTINCT metric_date) as unique_dates
        FROM performance_metrics 
        WHERE platform_account_id = $1
      `, [platformAccounts.rows[0].id])
      
      const metrics = instagramMetrics.rows[0]
      console.log(`📊 Métricas Instagram:`)
      console.log(`  Total registros: ${metrics.total}`)
      console.log(`  Período: ${metrics.min_date} até ${metrics.max_date}`)
      console.log(`  Dias únicos: ${metrics.unique_dates}`)
    } else {
      console.log('❌ Nenhuma platform_account Instagram encontrada')
    }

    // 4. Verificar índices problemáticos
    console.log('\n🔍 ÍNDICES DAS TABELAS INSTAGRAM')
    console.log('=' .repeat(50))
    const indexes = await client.query(`
      SELECT 
        i.relname as index_name,
        t.relname as table_name,
        ix.indisunique as is_unique,
        ix.indisprimary as is_primary,
        pg_get_indexdef(i.oid) as definition
      FROM pg_index ix
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN pg_class t ON t.oid = ix.indrelid
      WHERE t.relname LIKE '%instagram%'
      ORDER BY t.relname, i.relname
    `)
    
    indexes.rows.forEach(idx => {
      console.log(`📇 ${idx.table_name}.${idx.index_name}`)
      console.log(`   ${idx.is_unique ? 'UNIQUE' : 'NORMAL'} ${idx.is_primary ? 'PRIMARY' : ''}`)
      console.log(`   ${idx.definition}`)
    })

    // 5. Verificar locks ativos
    console.log('\n🔍 LOCKS ATIVOS (Instagram)')
    console.log('=' .repeat(50))
    const locks = await client.query(`
      SELECT 
        l.locktype,
        l.database,
        l.relation::regclass as table_name,
        l.mode,
        l.granted,
        a.query
      FROM pg_locks l
      LEFT JOIN pg_stat_activity a ON a.pid = l.pid
      WHERE l.relation::regclass::text LIKE '%instagram%'
         OR a.query LIKE '%instagram%'
    `)
    
    if (locks.rows.length > 0) {
      console.log('⚠️  LOCKS ENCONTRADOS:')
      locks.rows.forEach(lock => {
        console.log(`🔒 ${lock.table_name || 'N/A'} - ${lock.mode} (${lock.granted ? 'GRANTED' : 'WAITING'})`)
        if (lock.query) console.log(`   Query: ${lock.query.substring(0, 100)}...`)
      })
    } else {
      console.log('✅ Nenhum lock ativo encontrado')
    }

    // 6. Verificar queries lentas relacionadas ao Instagram
    console.log('\n🔍 QUERIES LENTAS (Instagram - últimas 24h)')
    console.log('=' .repeat(50))
    const slowQueries = await client.query(`
      SELECT 
        query,
        calls,
        total_time,
        mean_time,
        max_time
      FROM pg_stat_statements 
      WHERE query ILIKE '%instagram%'
         OR query ILIKE '%performance_metrics%'
      ORDER BY total_time DESC
      LIMIT 10
    `).catch(err => {
      if (err.message.includes('relation "pg_stat_statements" does not exist')) {
        console.log('📊 pg_stat_statements não disponível (extensão não instalada)')
        return { rows: [] }
      }
      throw err
    })
    
    if (slowQueries.rows && slowQueries.rows.length > 0) {
      slowQueries.rows.forEach(query => {
        console.log(`🐌 ${query.calls} calls | ${Math.round(query.mean_time)}ms avg | ${Math.round(query.max_time)}ms max`)
        console.log(`   ${query.query.substring(0, 100)}...`)
      })
    } else {
      console.log('✅ Nenhuma query lenta relacionada ao Instagram encontrada')
    }

  } catch (error) {
    console.error('❌ Erro durante investigação:', error.message)
  } finally {
    await client.end()
    console.log('\n🔍 Investigação concluída.')
  }
}

investigateInstagramTables().catch(console.error)