import { createDatabaseClient } from '../server/config/database';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function executeSql() {
    console.log('🔧 Executando SQL no Supabase...\n');

    const client = await createDatabaseClient();

    try {
        // Ler arquivo SQL
        const sqlPath = path.join(__dirname, 'create-products-table.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('📄 SQL lido do arquivo...');
        console.log('🚀 Executando...\n');

        // Executar SQL
        await client.query(sql);

        console.log('✅ Tabela "products" criada com sucesso!');
        console.log('✅ Tabela "product_publications" criada!');
        console.log('✅ View "vw_products_summary" criada!');
        console.log('✅ RLS policies aplicadas!');
        console.log('✅ Índices criados!');
        console.log('\n🎉 Banco de dados pronto para uso!');
    } catch (error: any) {
        console.error('❌ Erro ao executar SQL:', error.message);
        throw error;
    } finally {
        await client.end();
    }
}

executeSql()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
