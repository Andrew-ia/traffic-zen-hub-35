const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Carregar variáveis de ambiente
require('dotenv').config({ path: '.env.local' });

async function runSyncMigration() {
    const pool = new Pool({
        connectionString: process.env.SUPABASE_DATABASE_URL,
    });

    try {
        console.log('🔗 Conectando ao banco de dados...');
        
        // Ler o arquivo SQL
        const sqlPath = path.join(__dirname, 'add-sync-fields.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        
        console.log('📝 Executando migração de sincronização...');
        
        // Executar o SQL
        await pool.query(sql);
        
        console.log('✅ Migração de sincronização concluída!');
        
        // Verificar se os campos foram adicionados
        const result = await pool.query(`
            SELECT column_name, data_type, column_default
            FROM information_schema.columns
            WHERE table_name = 'products'
            AND column_name IN ('last_synced_at', 'source_of_truth', 'sync_status', 'ml_last_modified')
            ORDER BY column_name
        `);
        
        console.log('📊 Novos campos adicionados:');
        console.table(result.rows);
        
        // Verificar tabelas criadas
        const tables = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('sync_logs', 'workspace_sync_settings')
        `);
        
        console.log('🗃️ Novas tabelas criadas:', tables.rows.map(r => r.table_name));
        
        // Verificar produtos existentes
        const products = await pool.query(`
            SELECT COUNT(*) as total,
                   COUNT(CASE WHEN sync_status = 'synced' THEN 1 END) as synced,
                   COUNT(CASE WHEN sync_status = 'pending' THEN 1 END) as pending
            FROM products
        `);
        
        console.log('📦 Status dos produtos:');
        console.table(products.rows);
        
    } catch (error) {
        console.error('❌ Erro na migração:', error.message);
        console.error(error.detail || error.hint || '');
        process.exit(1);
    } finally {
        await pool.end();
    }
}

runSyncMigration();