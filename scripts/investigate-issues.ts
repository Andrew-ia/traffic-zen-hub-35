import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function investigateIssues() {
    console.log('🔍 Investigando os problemas identificados...\n');

    // Get Vermezzo workspace
    const { data: workspaces } = await supabase
        .from('workspaces')
        .select('id, name')
        .ilike('name', '%vermezzo%')
        .limit(1);

    const workspace = workspaces![0];
    console.log(`📁 Workspace: ${workspace.name}\n`);

    // PROBLEMA 1: Campanha "Lançamento Produto X" fantasma
    console.log('='.repeat(60));
    console.log('PROBLEMA 1: Campanha "Lançamento Produto X"');
    console.log('='.repeat(60));

    const { data: lancamentoCampaign } = await supabase
        .from('campaigns')
        .select('*')
        .ilike('name', '%Lançamento Produto X%')
        .limit(1);

    if (lancamentoCampaign && lancamentoCampaign.length > 0) {
        const camp = lancamentoCampaign[0];
        console.log(`\n❌ Campanha encontrada no banco:`);
        console.log(`   Nome: ${camp.name}`);
        console.log(`   ID: ${camp.id}`);
        console.log(`   Workspace ID: ${camp.workspace_id}`);
        console.log(`   Objetivo: ${camp.objective}`);
        console.log(`   Status: ${camp.status}`);
        console.log(`   Criada em: ${new Date(camp.created_at).toLocaleString('pt-BR')}`);
        console.log(`   Platform Account ID: ${camp.platform_account_id}`);

        // Check if it belongs to Vermezzo workspace
        if (camp.workspace_id === workspace.id) {
            console.log(`\n⚠️  Esta campanha ESTÁ no workspace Vermezzo`);
            console.log(`   Mas você disse que ela não existe na sua conta Meta.`);
            console.log(`   Isso sugere que é uma campanha de TESTE ou DEMO.`);
        } else {
            console.log(`\n✅ Esta campanha NÃO está no workspace Vermezzo`);
            console.log(`   Ela pertence a outro workspace: ${camp.workspace_id}`);
        }

        // Check platform account
        const { data: platformAccount } = await supabase
            .from('platform_accounts')
            .select('*')
            .eq('id', camp.platform_account_id)
            .limit(1);

        if (platformAccount && platformAccount.length > 0) {
            const account = platformAccount[0];
            console.log(`\n📱 Conta de plataforma:`);
            console.log(`   Nome: ${account.name}`);
            console.log(`   ID: ${account.id}`);
            console.log(`   Workspace ID: ${account.workspace_id}`);

            if (account.name?.toLowerCase().includes('demo') || account.name?.toLowerCase().includes('test')) {
                console.log(`\n🎯 SOLUÇÃO: Esta é uma conta DEMO/TEST!`);
                console.log(`   Devemos filtrar contas com "demo" ou "test" no nome.`);
            }
        }
    } else {
        console.log(`\n✅ Campanha "Lançamento Produto X" NÃO encontrada no banco`);
    }

    // PROBLEMA 2: Métricas duplicadas do GRUPO VIP
    console.log('\n\n' + '='.repeat(60));
    console.log('PROBLEMA 2: Métricas duplicadas - GRUPO VIP VERMEZZO');
    console.log('='.repeat(60));

    const { data: grupoVip } = await supabase
        .from('campaigns')
        .select('id, name')
        .ilike('name', '%GRUPO VIP%')
        .eq('workspace_id', workspace.id)
        .limit(1);

    if (grupoVip && grupoVip.length > 0) {
        const campaign = grupoVip[0];

        const { data: adSets } = await supabase
            .from('ad_sets')
            .select('id, name')
            .eq('campaign_id', campaign.id);

        const adSetIds = adSets!.map(as => as.id);

        // Get metrics for 2025-12-01 only (the day shown in the image)
        const { data: metrics } = await supabase
            .from('performance_metrics')
            .select('*')
            .in('ad_set_id', adSetIds)
            .eq('metric_date', '2025-12-01')
            .order('synced_at', { ascending: false });

        console.log(`\n📊 Métricas para 2025-12-01:`);
        console.log(`   Total de registros: ${metrics?.length || 0}\n`);

        if (metrics && metrics.length > 0) {
            // Group by ad_set_id
            const byAdSet = new Map<string, any[]>();
            metrics.forEach(m => {
                if (!byAdSet.has(m.ad_set_id)) {
                    byAdSet.set(m.ad_set_id, []);
                }
                byAdSet.get(m.ad_set_id)!.push(m);
            });

            for (const [adSetId, items] of byAdSet.entries()) {
                const adSet = adSets!.find(as => as.id === adSetId);
                console.log(`   Ad Set: ${adSet?.name}`);
                console.log(`   Registros: ${items.length}`);

                if (items.length > 1) {
                    console.log(`   ⚠️  DUPLICADOS ENCONTRADOS!`);
                    items.forEach((m, idx) => {
                        console.log(`      [${idx + 1}] Gasto: R$ ${Number(m.spend || 0).toFixed(2)}, Sincronizado em: ${new Date(m.synced_at).toLocaleString('pt-BR')}`);
                    });

                    // Show which one should be kept
                    const latest = items[0]; // Already sorted by synced_at DESC
                    console.log(`   ✅ Deveria manter apenas o mais recente: R$ ${Number(latest.spend || 0).toFixed(2)}`);
                } else {
                    console.log(`   ✅ Sem duplicados`);
                    console.log(`      Gasto: R$ ${Number(items[0].spend || 0).toFixed(2)}`);
                }
                console.log('');
            }

            // Calculate correct total
            const correctTotal = Array.from(byAdSet.values())
                .map(items => Number(items[0].spend || 0)) // Take only the first (most recent) of each ad set
                .reduce((sum, spend) => sum + spend, 0);

            const currentTotal = metrics.reduce((sum, m) => sum + Number(m.spend || 0), 0);

            console.log(`\n💰 TOTAIS para 2025-12-01:`);
            console.log(`   Total atual (com duplicados): R$ ${currentTotal.toFixed(2)}`);
            console.log(`   Total correto (sem duplicados): R$ ${correctTotal.toFixed(2)}`);
            console.log(`   Valor esperado (da imagem): R$ 23,99`);
            console.log(`   Diferença: R$ ${Math.abs(correctTotal - 23.99).toFixed(2)}`);
        }
    }

    console.log('\n\n' + '='.repeat(60));
    console.log('SOLUÇÕES NECESSÁRIAS');
    console.log('='.repeat(60));
    console.log('\n1. Filtrar contas DEMO/TEST no dashboard');
    console.log('2. Evitar duplicação de métricas na sincronização');
    console.log('3. Usar apenas a métrica mais recente por (ad_set_id, metric_date)');
}

investigateIssues().catch(console.error);
