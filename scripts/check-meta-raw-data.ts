import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMetaRawData() {
    console.log('🔍 Verificando dados brutos da Meta para 01/12/2025...\n');

    // Get GRUPO VIP campaign
    const { data: campaign } = await supabase
        .from('campaigns')
        .select('id, name, platform_account_id')
        .ilike('name', '%GRUPO VIP%')
        .limit(1);

    if (!campaign || campaign.length === 0) {
        console.log('❌ Campanha não encontrada');
        return;
    }

    const camp = campaign[0];
    console.log(`📊 Campanha: ${camp.name}\n`);

    // Check platform account
    const { data: account } = await supabase
        .from('platform_accounts')
        .select('*')
        .eq('id', camp.platform_account_id)
        .limit(1);

    if (account && account.length > 0) {
        console.log(`📱 Conta: ${account[0].name}`);
        console.log(`   ID da conta Meta: ${account[0].account_id}\n`);
    }

    // Get ad sets
    const { data: adSets } = await supabase
        .from('ad_sets')
        .select('*')
        .eq('campaign_id', camp.id);

    console.log(`📦 Ad Sets: ${adSets?.length || 0}\n`);

    if (!adSets || adSets.length === 0) return;

    // Get ALL metrics for 2025-12-01 (including all granularities)
    const adSetIds = adSets.map(as => as.id);
    const { data: allMetrics } = await supabase
        .from('performance_metrics')
        .select('*')
        .in('ad_set_id', adSetIds)
        .eq('metric_date', '2025-12-01')
        .order('synced_at', { ascending: false });

    console.log(`📊 Total de métricas para 2025-12-01: ${allMetrics?.length || 0}\n`);

    if (!allMetrics || allMetrics.length === 0) {
        console.log('❌ Nenhuma métrica encontrada');
        return;
    }

    // Show all metrics with details
    console.log('📋 TODAS AS MÉTRICAS (ordenadas por synced_at DESC):\n');

    allMetrics.forEach((m, idx) => {
        const adSet = adSets.find(as => as.id === m.ad_set_id);
        console.log(`[${idx + 1}] ${adSet?.name}`);
        console.log(`    ID: ${m.id}`);
        console.log(`    Granularidade: ${m.granularity}`);
        console.log(`    Gasto: R$ ${Number(m.spend || 0).toFixed(2)}`);
        console.log(`    Impressões: ${m.impressions || 0}`);
        console.log(`    Cliques: ${m.clicks || 0}`);
        console.log(`    Sincronizado em: ${new Date(m.synced_at).toLocaleString('pt-BR')}`);
        console.log('');
    });

    // Apply the same aggregation logic as the hook
    const aggregatedMap = new Map<string, any>();

    for (const row of allMetrics) {
        const key = `${row.metric_date}::${row.ad_set_id}::${row.campaign_id}`;
        const syncedAt = row.synced_at ? Date.parse(row.synced_at) : Number.NEGATIVE_INFINITY;

        const existing = aggregatedMap.get(key);
        if (!existing) {
            aggregatedMap.set(key, {
                ad_set_id: row.ad_set_id,
                spend: Number(row.spend || 0),
                synced_at: syncedAt,
            });
        } else {
            // Keep the most recent one
            if (syncedAt >= existing.synced_at) {
                existing.spend = Number(row.spend || 0);
                existing.synced_at = syncedAt;
            }
        }
    }

    console.log('\n💰 APÓS AGREGAÇÃO (mantendo apenas o mais recente por ad_set):\n');

    let totalAggregated = 0;
    for (const [key, data] of aggregatedMap.entries()) {
        const adSet = adSets.find(as => as.id === data.ad_set_id);
        console.log(`   ${adSet?.name}`);
        console.log(`      Gasto: R$ ${data.spend.toFixed(2)}`);
        totalAggregated += data.spend;
    }

    console.log(`\n   TOTAL AGREGADO: R$ ${totalAggregated.toFixed(2)}`);
    console.log(`   ESPERADO (da imagem): R$ 23,99`);
    console.log(`   DIFERENÇA: R$ ${Math.abs(totalAggregated - 23.99).toFixed(2)}`);

    // Check if there are metrics from other dates that might be included
    console.log('\n\n🔍 Verificando se há métricas de outros períodos...\n');

    const { data: last7Days } = await supabase
        .from('performance_metrics')
        .select('metric_date, spend, granularity')
        .in('ad_set_id', adSetIds)
        .eq('granularity', 'day')
        .gte('metric_date', '2025-11-25')
        .lte('metric_date', '2025-12-02')
        .order('metric_date', { ascending: false });

    if (last7Days && last7Days.length > 0) {
        const byDate = new Map<string, number>();
        last7Days.forEach(m => {
            byDate.set(m.metric_date, (byDate.get(m.metric_date) || 0) + Number(m.spend || 0));
        });

        console.log('📅 Gasto por dia (últimos 7 dias):');
        for (const [date, spend] of Array.from(byDate.entries()).sort().reverse()) {
            console.log(`   ${date}: R$ ${spend.toFixed(2)}`);
        }
    }
}

checkMetaRawData().catch(console.error);
