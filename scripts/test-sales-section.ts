import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSalesSection() {
    console.log('🧪 Testando se a seção de vendas aparecerá no dashboard...\n');

    // Get Vermezzo workspace
    const { data: workspaces } = await supabase
        .from('workspaces')
        .select('id, name')
        .ilike('name', '%vermezzo%')
        .limit(1);

    if (!workspaces || workspaces.length === 0) {
        console.log('❌ Workspace Vermezzo não encontrado');
        return;
    }

    const workspace = workspaces[0];
    console.log(`📁 Workspace: ${workspace.name} (${workspace.id})\n`);

    // Simulate the logic from useObjectivePerformanceSummary
    const days = 30;
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    const start = new Date(end);
    start.setDate(start.getDate() - (days - 1 + 7)); // DATA_LAG_SAFETY_DAYS = 7

    const fromIso = start.toISOString().slice(0, 10);
    const toIso = end.toISOString().slice(0, 10);

    console.log(`📅 Período: ${fromIso} até ${toIso}\n`);

    // Get campaigns with SALES objective
    const { data: campaigns } = await supabase
        .from('campaigns')
        .select('id, name, objective, status')
        .eq('workspace_id', workspace.id)
        .in('objective', ['OUTCOME_SALES', 'SALES', 'CONVERSIONS', 'PURCHASE']);

    console.log(`📊 Campanhas de vendas: ${campaigns?.length || 0}`);

    if (!campaigns || campaigns.length === 0) {
        console.log('❌ Nenhuma campanha de vendas encontrada');
        return;
    }

    // Get ad sets for these campaigns
    const campaignIds = campaigns.map(c => c.id);
    const { data: adSets } = await supabase
        .from('ad_sets')
        .select('id, campaign_id')
        .in('campaign_id', campaignIds);

    console.log(`📦 Ad Sets: ${adSets?.length || 0}`);

    if (!adSets || adSets.length === 0) {
        console.log('❌ Nenhum ad set encontrado');
        return;
    }

    // Get metrics for these ad sets
    const adSetIds = adSets.map(as => as.id);
    const { data: metrics } = await supabase
        .from('performance_metrics')
        .select('ad_set_id, metric_date, spend, extra_metrics')
        .in('ad_set_id', adSetIds)
        .gte('metric_date', fromIso)
        .lte('metric_date', toIso);

    console.log(`📈 Métricas encontradas: ${metrics?.length || 0}\n`);

    if (!metrics || metrics.length === 0) {
        console.log('❌ Nenhuma métrica encontrada no período');
        return;
    }

    // Calculate totals
    let totalSpend = 0;
    let totalPurchases = 0;
    let totalValue = 0;

    for (const metric of metrics) {
        totalSpend += Number(metric.spend || 0);

        const actions = (metric.extra_metrics as any)?.actions || [];
        const purchaseAction = actions.find((a: any) =>
            a.action_type?.toLowerCase().includes('purchase')
        );
        if (purchaseAction) {
            totalPurchases += Number(purchaseAction.value || 0);
        }

        const actionValues = (metric.extra_metrics as any)?.action_values || [];
        const purchaseValue = actionValues.find((a: any) =>
            a.action_type?.toLowerCase().includes('purchase')
        );
        if (purchaseValue) {
            totalValue += Number(purchaseValue.value || 0);
        }
    }

    console.log('💰 TOTAIS:');
    console.log(`   Gasto: R$ ${totalSpend.toFixed(2)}`);
    console.log(`   Compras: ${totalPurchases}`);
    console.log(`   Valor: R$ ${totalValue.toFixed(2)}`);
    console.log(`   ROAS: ${totalSpend > 0 ? (totalValue / totalSpend).toFixed(2) : '0.00'}\n`);

    // Check if sales section will be shown
    const hasSales = totalPurchases > 0 || totalValue > 0 || totalSpend > 0;

    console.log('🎯 VERIFICAÇÃO DA LÓGICA DO DASHBOARD:');
    console.log(`   purchases > 0: ${totalPurchases > 0 ? '✅' : '❌'} (${totalPurchases})`);
    console.log(`   value > 0: ${totalValue > 0 ? '✅' : '❌'} (R$ ${totalValue.toFixed(2)})`);
    console.log(`   spend > 0: ${totalSpend > 0 ? '✅' : '❌'} (R$ ${totalSpend.toFixed(2)})`);
    console.log(`\n   ${hasSales ? '✅ A SEÇÃO DE VENDAS SERÁ EXIBIDA!' : '❌ A seção de vendas NÃO será exibida'}`);

    if (hasSales && totalPurchases === 0) {
        console.log('\n⚠️  ATENÇÃO:');
        console.log('   A seção será exibida porque há GASTO em campanhas de vendas,');
        console.log('   mas ainda não há COMPRAS registradas.');
        console.log('\n💡 RECOMENDAÇÕES:');
        console.log('   1. Verificar se o Pixel do Facebook está instalado corretamente');
        console.log('   2. Verificar se o evento de "Purchase" está sendo disparado');
        console.log('   3. Aguardar mais tempo para que as conversões aconteçam');
    }
}

testSalesSection().catch(console.error);
