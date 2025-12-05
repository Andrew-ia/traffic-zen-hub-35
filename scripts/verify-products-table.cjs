const { Pool } = require('pg');

// Carregar variáveis de ambiente
require('dotenv').config({ path: '.env.local' });

async function verifyProductsTable() {
    const pool = new Pool({
        connectionString: process.env.SUPABASE_DATABASE_URL,
    });

    try {
        console.log('🔗 Conectando ao banco de dados...');
        
        // Verificar estrutura da tabela
        const result = await pool.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_name = 'products'
            AND table_schema = 'public'
            ORDER BY ordinal_position
        `);
        
        console.log('📊 Estrutura da tabela products:');
        console.table(result.rows);
        
        // Tentar inserir um produto de teste
        console.log('\n🧪 Testando inserção de produto...');
        
        const testProduct = {
            workspace_id: '00000000-0000-0000-0000-000000000010', // workspace padrão
            title: 'Produto Teste',
            price: 99.99,
            sku: 'TEST-001',
            description: 'Produto de teste',
            condition: 'new',
            ml_listing_type: 'gold_special',
            available_quantity: 10,
            free_shipping: true,
            images: JSON.stringify(['https://example.com/image1.jpg']),
            attributes: JSON.stringify([]),
            currency: 'BRL',
            weight_kg: 1.0,
            width_cm: 20,
            height_cm: 10,
            length_cm: 30,
            status: 'draft'
        };
        
        const insertQuery = `
            INSERT INTO products (
                workspace_id, title, price, sku, description, condition,
                ml_listing_type, available_quantity, free_shipping, images,
                attributes, currency, weight_kg, width_cm, height_cm, length_cm, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
            RETURNING id, title
        `;
        
        const values = [
            testProduct.workspace_id,
            testProduct.title,
            testProduct.price,
            testProduct.sku,
            testProduct.description,
            testProduct.condition,
            testProduct.ml_listing_type,
            testProduct.available_quantity,
            testProduct.free_shipping,
            testProduct.images,
            testProduct.attributes,
            testProduct.currency,
            testProduct.weight_kg,
            testProduct.width_cm,
            testProduct.height_cm,
            testProduct.length_cm,
            testProduct.status
        ];
        
        const insertResult = await pool.query(insertQuery, values);
        console.log('✅ Produto inserido com sucesso:', insertResult.rows[0]);
        
        // Remover produto de teste
        await pool.query('DELETE FROM products WHERE id = $1', [insertResult.rows[0].id]);
        console.log('🗑️ Produto de teste removido');
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
        console.error('Detalhes:', error.detail || error.hint || '');
    } finally {
        await pool.end();
    }
}

verifyProductsTable();