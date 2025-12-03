import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugSalesSpend() {
    console.log('🔍 Investigando o gasto incorreto na seção de vendas...\n');

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

    // Get the GRUPO VIP campaign specifically
    const { data: grupoVipCampaign } = await supabase
        .from('campaigns')
        .select('*')
        .ilike('name', '%GRUPO VIP%')
        .eq('workspace_id', workspace.id)
        .limit(1);

    if (!grupoVipCampaign || grupoVipCampaign.length === 0) {
        console.log('❌ Campanha GRUPO VIP não encontrada');
        return;
    }

    const campaign = grupoVipCampaign[0];
    console.log(`📊 Campanha: ${campaign.name}`);
    console.log(`   ID: ${campaign.id}`);
    console.log(`   Objetivo: ${campaign.objective}\n`);

    // Get ad sets for this campaign
    const { data: adSets } = await supabase
        .from('ad_sets')
        .select('id, name')
        .eq('campaign_id', campaign.id);

    console.log(`📦 Ad Sets: ${adSets?.length || 0}\n`);

    if (!adSets || adSets.length === 0) {
        console.log('❌ Nenhum ad set encontrado');
        return;
    }

    // Get metrics for these ad sets
    const adSetIds = adSets.map(as => as.id);

    // Get last 30 days
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    const start = new Date(end);
    start.setDate(start.getDate() - 30);

    const fromIso = start.toISOString().slice(0, 10);
    const toIso = end.toISOString().slice(0, 10);

    console.log(`📅 Período: ${fromIso} até ${toIso}\n`);

    const { data: metrics } = await supabase
        .from('performance_metrics')
        .select('ad_set_id, metric_date, spend, granularity')
        .in('ad_set_id', adSetIds)
        .gte('metric_date', fromIso)
        .lte('metric_date', toIso)
        .order('metric_date', { ascending: false });

    console.log(`📈 Total de registros de métricas: ${metrics?.length || 0}\n`);

    if (!metrics || metrics.length === 0) {
        console.log('❌ Nenhuma métrica encontrada');
        return;
    }

    // Group by granularity
    const byGranularity = new Map<string, any[]>();
    metrics.forEach(m => {
        const gran = m.granularity || 'unknown';
        if (!byGranularity.has(gran)) {
            byGranularity.set(gran, []);
        }
        byGranularity.get(gran)!.push(m);
    });

    console.log('📊 Métricas por granularidade:');
    for (const [gran, items] of byGranularity.entries()) {
        const totalSpend = items.reduce((sum, m) => sum + Number(m.spend || 0), 0);
        console.log(`   ${gran}: ${items.length} registros, Gasto total: R$ ${totalSpend.toFixed(2)}`);
    }

    // Show detailed breakdown by date
    console.log('\n📅 Detalhamento por data (últimos 10 dias):');

    const byDate = new Map<string, any[]>();
    metrics.forEach(m => {
        if (!byDate.has(m.metric_date)) {
            byDate.set(m.metric_date, []);
        }
        byDate.get(m.metric_date)!.push(m);
    });

    const sortedDates = Array.from(byDate.keys()).sort().reverse().slice(0, 10);

    for (const date of sortedDates) {
        const items = byDate.get(date)!;
        console.log(`\n   ${date}:`);

        items.forEach(m => {
            const adSet = adSets.find(as => as.id === m.ad_set_id);
            console.log(`      - ${adSet?.name || m.ad_set_id}`);
            console.log(`        Granularidade: ${m.granularity}`);
            console.log(`        Gasto: R$ ${Number(m.spend || 0).toFixed(2)}`);
        });

        const dateTotal = items.reduce((sum, m) => sum + Number(m.spend || 0), 0);
        console.log(`      TOTAL DO DIA: R$ ${dateTotal.toFixed(2)}`);
    }

    // Calculate total spend (only 'day' granularity to avoid duplicates)
    const dayMetrics = metrics.filter(m => m.granularity === 'day');
    const totalSpend = dayMetrics.reduce((sum, m) => sum + Number(m.spend || 0), 0);

    console.log('\n\n💰 RESUMO:');
    console.log(`   Total de métricas com granularidade 'day': ${dayMetrics.length}`);
    console.log(`   Gasto total (apenas 'day'): R$ ${totalSpend.toFixed(2)}`);
    console.log(`   Gasto esperado (da imagem): R$ 23,99`);
    console.log(`   Diferença: R$ ${Math.abs(totalSpend - 23.99).toFixed(2)}`);

    if (Math.abs(totalSpend - 23.99) > 1) {
        console.log('\n⚠️  PROBLEMA IDENTIFICADO:');
        console.log('   O gasto calculado não bate com o valor real da Meta.');
        console.log('\n   Possíveis causas:');
        console.log('   1. Métricas duplicadas no banco de dados');
        console.log('   2. Granularidades diferentes sendo somadas');
        console.log('   3. Dados de outras campanhas sendo incluídos');
        console.log('   4. Sincronização incorreta dos dados');
    } else {
        console.log('\n✅ O gasto está correto quando consideramos apenas granularidade "day"');
    }

    // Check ALL sales campaigns
    console.log('\n\n🔍 Verificando TODAS as campanhas de vendas...\n');

    const { data: allSalesCampaigns } = await supabase
        .from('campaigns')
        .select('id, name, objective, status')
        .eq('workspace_id', workspace.id)
        .in('objective', ['OUTCOME_SALES', 'SALES']);

    console.log(`📊 Total de campanhas de vendas: ${allSalesCampaigns?.length || 0}\n`);

    if (allSalesCampaigns && allSalesCampaigns.length > 0) {
        for (const camp of allSalesCampaigns) {
            const { data: campAdSets } = await supabase
                .from('ad_sets')
                .select('id')
                .eq('campaign_id', camp.id);

            if (campAdSets && campAdSets.length > 0) {
                const campAdSetIds = campAdSets.map(as => as.id);

                const { data: campMetrics } = await supabase
                    .from('performance_metrics')
                    .select('spend, granularity')
                    .in('ad_set_id', campAdSetIds)
                    .eq('granularity', 'day')
                    .gte('metric_date', fromIso)
                    .lte('metric_date', toIso);

                const campSpend = campMetrics?.reduce((sum, m) => sum + Number(m.spend || 0), 0) || 0;

                if (campSpend > 0) {
                    console.log(`   ${camp.name} (${camp.status})`);
                    console.log(`      Gasto: R$ ${campSpend.toFixed(2)}\n`);
                }
            }
        }
    }
}

debugSalesSpend().catch(console.error);
