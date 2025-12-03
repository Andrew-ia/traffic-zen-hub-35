import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixDatabase() {
    console.log('🔧 Corrigindo banco de dados...\n');

    try {
        // Drop the constraint using a raw query via RPC or just try to insert duplicate to verify?
        // Supabase JS client doesn't support DDL directly unless via RPC.
        // But I can use the `postgres` npm package if available, or just use the `clean-duplicates.sql` logic via a migration if I could run it.

        // Since I can't run DDL directly from JS client without a specific RPC, 
        // I will try to use the `pg` library if installed, or just assume the constraint is there and I need to remove it.

        // Let's try to use a SQL function if one exists for running SQL, but usually it's restricted.
        // However, I can use the `run_command` tool to run `npx supabase db reset` or similar, but that's destructive.

        // Wait, I can use the `run_command` to run a node script that uses `pg`?
        // Let's check if `pg` is in package.json.

        console.log('⚠️  Tentando remover constraint via RPC (se existir)...');

        const { error } = await supabase.rpc('exec_sql', {
            sql: 'ALTER TABLE performance_metrics DROP CONSTRAINT IF EXISTS unique_metric_per_day;'
        });

        if (error) {
            console.log('❌ Falha ao executar RPC (provavelmente não existe):', error.message);
            console.log('   Vou tentar conectar diretamente com pg...');
        } else {
            console.log('✅ Constraint removida com sucesso via RPC!');
            return;
        }

    } catch (error) {
        console.error('❌ Erro:', error);
    }
}

fixDatabase().catch(console.error);
