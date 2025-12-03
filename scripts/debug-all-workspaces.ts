import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAllWorkspaces() {
    console.log('🔍 Verificando todos os workspaces e campanhas...\n');

    // Get all workspaces
    const { data: workspaces } = await supabase
        .from('workspaces')
        .select('id, name');

    if (!workspaces || workspaces.length === 0) {
        console.log('❌ Nenhum workspace encontrado');
        return;
    }

    console.log(`📁 Total de workspaces: ${workspaces.length}\n`);

    for (const workspace of workspaces) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`📁 Workspace: ${workspace.name} (${workspace.id})`);
        console.log('='.repeat(60));

        // Get campaigns for this workspace
        const { data: campaigns } = await supabase
            .from('campaigns')
            .select('id, name, objective, status, created_at')
            .eq('workspace_id', workspace.id)
            .order('created_at', { ascending: false });

        console.log(`\n📊 Total de campanhas: ${campaigns?.length || 0}`);

        if (campaigns && campaigns.length > 0) {
            // Group by objective
            const byObjective = new Map<string, any[]>();
            campaigns.forEach(campaign => {
                const obj = campaign.objective || 'NULL';
                if (!byObjective.has(obj)) {
                    byObjective.set(obj, []);
                }
                byObjective.get(obj)!.push(campaign);
            });

            console.log('\n📈 Campanhas por objetivo:');
            for (const [objective, camps] of byObjective.entries()) {
                console.log(`\n  ${objective}: ${camps.length} campanha(s)`);
                camps.forEach(c => {
                    const date = new Date(c.created_at).toLocaleDateString('pt-BR');
                    console.log(`    - ${c.name}`);
                    console.log(`      Status: ${c.status} | Criada em: ${date}`);
                });
            }

            // Check for sales campaigns
            const salesObjectives = ['OUTCOME_SALES', 'SALES', 'CONVERSIONS', 'PURCHASE'];
            const salesCampaigns = campaigns.filter(c =>
                salesObjectives.includes(c.objective?.toUpperCase() || '')
            );

            if (salesCampaigns.length > 0) {
                console.log(`\n\n💰 CAMPANHAS DE VENDAS: ${salesCampaigns.length}`);

                for (const campaign of salesCampaigns) {
                    console.log(`\n  📊 ${campaign.name}`);
                    console.log(`     Objetivo: ${campaign.objective}`);
                    console.log(`     Status: ${campaign.status}`);

                    // Get ad sets
                    const { data: adSets } = await supabase
                        .from('ad_sets')
                        .select('id, name')
                        .eq('campaign_id', campaign.id);

                    console.log(`     Ad Sets: ${adSets?.length || 0}`);

                    if (adSets && adSets.length > 0) {
                        // Check for metrics
                        const adSetIds = adSets.map(as => as.id);
                        const { data: metrics, error: metricsError } = await supabase
                            .from('performance_metrics')
                            .select('ad_set_id, metric_date, spend, extra_metrics')
                            .in('ad_set_id', adSetIds)
                            .order('metric_date', { ascending: false })
                            .limit(5);

                        if (metricsError) {
                            console.log(`     ❌ Erro ao buscar métricas: ${metricsError.message}`);
                        } else {
                            console.log(`     Métricas: ${metrics?.length || 0} registros`);

                            if (metrics && metrics.length > 0) {
                                console.log(`\n     📅 Últimas métricas:`);
                                metrics.forEach(m => {
                                    const actions = (m.extra_metrics as any)?.actions || [];
                                    const purchases = actions.find((a: any) =>
                                        a.action_type?.toLowerCase().includes('purchase')
                                    );
                                    console.log(`       ${m.metric_date}: Gasto R$ ${Number(m.spend || 0).toFixed(2)}, Compras: ${purchases?.value || 0}`);
                                });
                            } else {
                                console.log(`     ⚠️  Nenhuma métrica encontrada`);
                            }
                        }
                    } else {
                        console.log(`     ⚠️  Nenhum ad set encontrado`);
                    }
                }
            }
        }
    }

    console.log('\n\n' + '='.repeat(60));
    console.log('🔍 RESUMO GERAL');
    console.log('='.repeat(60));

    // Get all campaigns across all workspaces
    const { data: allCampaigns } = await supabase
        .from('campaigns')
        .select('objective')
        .not('objective', 'is', null);

    if (allCampaigns) {
        const objectiveCounts = new Map<string, number>();
        allCampaigns.forEach(c => {
            const obj = c.objective || 'NULL';
            objectiveCounts.set(obj, (objectiveCounts.get(obj) || 0) + 1);
        });

        console.log('\nTodos os objetivos encontrados no sistema:');
        for (const [obj, count] of Array.from(objectiveCounts.entries()).sort((a, b) => b[1] - a[1])) {
            console.log(`  ${obj}: ${count}`);
        }
    }
}

checkAllWorkspaces().catch(console.error);
