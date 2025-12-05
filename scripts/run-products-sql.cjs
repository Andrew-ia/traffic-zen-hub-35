const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Carregar variáveis de ambiente
require('dotenv').config({ path: '.env.local' });

async function runProductsSQL() {
    const pool = new Pool({
        connectionString: process.env.SUPABASE_DATABASE_URL,
    });

    try {
        console.log('🔗 Conectando ao banco de dados...');
        
        // Ler o arquivo SQL
        const sqlPath = path.join(__dirname, 'create-products-table.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        
        console.log('📝 Executando script de criação da tabela products...');
        
        // Executar o SQL
        await pool.query(sql);
        
        console.log('✅ Tabela products criada com sucesso!');
        
        // Verificar se a tabela foi criada
        const result = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('products', 'product_publications')
        `);
        
        console.log('📊 Tabelas criadas:', result.rows.map(r => r.table_name));
        
    } catch (error) {
        console.error('❌ Erro ao executar SQL:', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

runProductsSQL();