import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugGrupoVipCampaign() {
    console.log('🔍 Analisando campanha "GRUPO VIP VERMEZZO"...\n');

    // Find the campaign
    const { data: campaigns } = await supabase
        .from('campaigns')
        .select('*')
        .ilike('name', '%GRUPO VIP%')
        .limit(1);

    if (!campaigns || campaigns.length === 0) {
        console.log('❌ Campanha não encontrada');
        return;
    }

    const campaign = campaigns[0];
    console.log('📊 Campanha encontrada:');
    console.log(`   Nome: ${campaign.name}`);
    console.log(`   ID: ${campaign.id}`);
    console.log(`   Objetivo: ${campaign.objective}`);
    console.log(`   Status: ${campaign.status}`);
    console.log(`   Workspace ID: ${campaign.workspace_id}`);
    console.log(`   Criada em: ${new Date(campaign.created_at).toLocaleString('pt-BR')}`);

    // Get ad sets
    const { data: adSets } = await supabase
        .from('ad_sets')
        .select('*')
        .eq('campaign_id', campaign.id);

    console.log(`\n📦 Ad Sets: ${adSets?.length || 0}`);

    if (adSets && adSets.length > 0) {
        for (const adSet of adSets) {
            console.log(`\n  Ad Set: ${adSet.name}`);
            console.log(`    ID: ${adSet.id}`);
            console.log(`    Status: ${adSet.status}`);
            console.log(`    Targeting: ${JSON.stringify(adSet.targeting, null, 2)}`);
            console.log(`    Destination Type: ${adSet.destination_type}`);

            // Get metrics for this ad set
            const { data: metrics } = await supabase
                .from('performance_metrics')
                .select('*')
                .eq('ad_set_id', adSet.id)
                .order('metric_date', { ascending: false });

            console.log(`\n    📊 Métricas: ${metrics?.length || 0} registros`);

            if (metrics && metrics.length > 0) {
                console.log('\n    Últimos 10 dias:');
                metrics.slice(0, 10).forEach(m => {
                    const actions = (m.extra_metrics as any)?.actions || [];
                    const actionValues = (m.extra_metrics as any)?.action_values || [];

                    console.log(`\n      📅 ${m.metric_date}`);
                    console.log(`         Gasto: R$ ${Number(m.spend || 0).toFixed(2)}`);
                    console.log(`         Impressões: ${m.impressions || 0}`);
                    console.log(`         Cliques: ${m.clicks || 0}`);
                    console.log(`         Alcance: ${m.reach || 0}`);

                    // Check for purchase actions
                    const purchaseActions = actions.filter((a: any) =>
                        a.action_type?.toLowerCase().includes('purchase')
                    );

                    if (purchaseActions.length > 0) {
                        console.log(`         ✅ Ações de compra encontradas:`);
                        purchaseActions.forEach((a: any) => {
                            console.log(`            - ${a.action_type}: ${a.value}`);
                        });
                    } else {
                        console.log(`         ⚠️  Nenhuma ação de compra encontrada`);
                    }

                    // Check for purchase values
                    const purchaseValues = actionValues.filter((a: any) =>
                        a.action_type?.toLowerCase().includes('purchase')
                    );

                    if (purchaseValues.length > 0) {
                        console.log(`         💰 Valores de compra:`);
                        purchaseValues.forEach((a: any) => {
                            console.log(`            - ${a.action_type}: R$ ${Number(a.value || 0).toFixed(2)}`);
                        });
                    }

                    // Show all actions for debugging
                    if (actions.length > 0) {
                        console.log(`         📋 Todas as ações (${actions.length}):`);
                        actions.forEach((a: any) => {
                            console.log(`            - ${a.action_type}: ${a.value}`);
                        });
                    }
                });

                // Calculate totals
                const totalSpend = metrics.reduce((sum, m) => sum + Number(m.spend || 0), 0);
                const totalImpressions = metrics.reduce((sum, m) => sum + Number(m.impressions || 0), 0);
                const totalClicks = metrics.reduce((sum, m) => sum + Number(m.clicks || 0), 0);

                console.log(`\n    📊 TOTAIS:`);
                console.log(`       Gasto total: R$ ${totalSpend.toFixed(2)}`);
                console.log(`       Impressões totais: ${totalImpressions}`);
                console.log(`       Cliques totais: ${totalClicks}`);
            }
        }
    }

    // Check if this campaign should appear in the dashboard
    console.log('\n\n🔍 VERIFICAÇÃO DO DASHBOARD:');
    console.log('   ✅ Objetivo mapeado: OUTCOME_SALES → SALES');
    console.log(`   ${adSets && adSets.length > 0 ? '✅' : '❌'} Tem ad sets: ${adSets?.length || 0}`);

    const hasMetrics = adSets && adSets.length > 0 && await (async () => {
        for (const adSet of adSets) {
            const { data: m } = await supabase
                .from('performance_metrics')
                .select('id')
                .eq('ad_set_id', adSet.id)
                .limit(1);
            if (m && m.length > 0) return true;
        }
        return false;
    })();

    console.log(`   ${hasMetrics ? '✅' : '❌'} Tem métricas`);
    console.log(`   ${campaign.status === 'active' ? '✅' : '⚠️'} Status: ${campaign.status}`);

    if (!hasMetrics) {
        console.log('\n⚠️  PROBLEMA: A campanha não tem métricas coletadas!');
        console.log('   Possíveis causas:');
        console.log('   1. A sincronização de métricas não está funcionando');
        console.log('   2. A campanha foi criada mas nunca teve impressões');
        console.log('   3. Os ad sets não estão ativos');
    }
}

debugGrupoVipCampaign().catch(console.error);
