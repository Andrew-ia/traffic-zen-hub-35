import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function cleanDuplicates() {
    console.log('🧹 Limpando métricas duplicadas...\n');

    try {
        // 1. Contar duplicados antes
        const { data: beforeCount, error: beforeError } = await supabase
            .rpc('count_duplicates_before');

        if (beforeError) {
            console.log('⚠️  Não foi possível contar duplicados (função RPC não existe)');
            console.log('   Continuando com a limpeza manual...\n');
        }

        // 2. Buscar todos os registros duplicados
        const { data: allMetrics, error: fetchError } = await supabase
            .from('performance_metrics')
            .select('id, ad_set_id, metric_date, granularity, synced_at, spend')
            .eq('granularity', 'day')
            .order('ad_set_id')
            .order('metric_date')
            .order('synced_at', { ascending: false });

        if (fetchError) {
            console.error('❌ Erro ao buscar métricas:', fetchError);
            return;
        }

        console.log(`📊 Total de métricas com granularidade 'day': ${allMetrics?.length || 0}\n`);

        if (!allMetrics || allMetrics.length === 0) {
            console.log('✅ Nenhuma métrica encontrada');
            return;
        }

        // 3. Identificar duplicados
        const seen = new Map<string, any>();
        const toDelete: string[] = [];

        for (const metric of allMetrics) {
            const key = `${metric.ad_set_id}::${metric.metric_date}::${metric.granularity}`;

            if (!seen.has(key)) {
                // Primeiro registro (mais recente) - manter
                seen.set(key, metric);
            } else {
                // Duplicado - marcar para deletar
                toDelete.push(metric.id);
            }
        }

        console.log(`📋 Registros únicos: ${seen.size}`);
        console.log(`🗑️  Duplicados a remover: ${toDelete.length}\n`);

        if (toDelete.length === 0) {
            console.log('✅ Não há duplicados para remover!');
            return;
        }

        // 4. Mostrar alguns exemplos de duplicados
        console.log('📝 Exemplos de duplicados que serão removidos:\n');
        const examples = toDelete.slice(0, 5);
        for (const id of examples) {
            const metric = allMetrics.find(m => m.id === id);
            if (metric) {
                console.log(`   ID: ${id}`);
                console.log(`   Data: ${metric.metric_date}`);
                console.log(`   Gasto: R$ ${Number(metric.spend || 0).toFixed(2)}`);
                console.log(`   Sincronizado: ${new Date(metric.synced_at).toLocaleString('pt-BR')}`);
                console.log('');
            }
        }

        // 5. Deletar em lotes de 100
        console.log('🗑️  Removendo duplicados...\n');

        const batchSize = 100;
        let deleted = 0;

        for (let i = 0; i < toDelete.length; i += batchSize) {
            const batch = toDelete.slice(i, i + batchSize);

            const { error: deleteError } = await supabase
                .from('performance_metrics')
                .delete()
                .in('id', batch);

            if (deleteError) {
                console.error(`❌ Erro ao deletar lote ${i / batchSize + 1}:`, deleteError);
                break;
            }

            deleted += batch.length;
            console.log(`   Removidos: ${deleted}/${toDelete.length}`);
        }

        console.log(`\n✅ Limpeza concluída! Removidos ${deleted} duplicados.\n`);

        // 6. Verificar resultado
        const { data: afterMetrics } = await supabase
            .from('performance_metrics')
            .select('metric_date, spend')
            .eq('granularity', 'day')
            .gte('metric_date', '2025-11-25')
            .lte('metric_date', '2025-12-02');

        if (afterMetrics) {
            const byDate = new Map<string, number>();
            afterMetrics.forEach(m => {
                byDate.set(m.metric_date, (byDate.get(m.metric_date) || 0) + Number(m.spend || 0));
            });

            console.log('📅 Gasto por dia (após limpeza):');
            for (const [date, spend] of Array.from(byDate.entries()).sort().reverse()) {
                console.log(`   ${date}: R$ ${spend.toFixed(2)}`);
            }
        }

    } catch (error) {
        console.error('❌ Erro:', error);
    }
}

cleanDuplicates().catch(console.error);
