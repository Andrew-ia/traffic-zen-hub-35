import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSalesCampaigns() {
  console.log('🔍 Verificando campanhas de vendas...\n');

  // Get workspace
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('id, name')
    .limit(1);

  if (!workspaces || workspaces.length === 0) {
    console.log('❌ Nenhum workspace encontrado');
    return;
  }

  const workspace = workspaces[0];
  console.log(`📁 Workspace: ${workspace.name} (${workspace.id})\n`);

  // Get campaigns with SALES objective
  const { data: campaigns, error: campaignsError } = await supabase
    .from('campaigns')
    .select('id, name, objective, status')
    .eq('workspace_id', workspace.id)
    .order('created_at', { ascending: false });

  if (campaignsError) {
    console.error('❌ Erro ao buscar campanhas:', campaignsError);
    return;
  }

  console.log(`📊 Total de campanhas: ${campaigns?.length || 0}\n`);

  // Group by objective
  const byObjective = new Map<string, any[]>();
  campaigns?.forEach(campaign => {
    const obj = campaign.objective || 'NULL';
    if (!byObjective.has(obj)) {
      byObjective.set(obj, []);
    }
    byObjective.get(obj)!.push(campaign);
  });

  console.log('📈 Campanhas por objetivo:\n');
  for (const [objective, camps] of byObjective.entries()) {
    console.log(`  ${objective}: ${camps.length} campanha(s)`);
    camps.forEach(c => {
      console.log(`    - ${c.name} (${c.status})`);
    });
    console.log('');
  }

  // Check for sales campaigns specifically
  const salesObjectives = ['OUTCOME_SALES', 'SALES', 'CONVERSIONS', 'PURCHASE'];
  const salesCampaigns = campaigns?.filter(c => 
    salesObjectives.includes(c.objective?.toUpperCase() || '')
  ) || [];

  console.log(`\n💰 Campanhas de VENDAS encontradas: ${salesCampaigns.length}`);
  
  if (salesCampaigns.length > 0) {
    console.log('\n🔍 Verificando métricas para campanhas de vendas...\n');
    
    for (const campaign of salesCampaigns) {
      console.log(`\n📊 Campanha: ${campaign.name}`);
      console.log(`   ID: ${campaign.id}`);
      console.log(`   Objetivo: ${campaign.objective}`);
      console.log(`   Status: ${campaign.status}`);

      // Get ad sets for this campaign
      const { data: adSets } = await supabase
        .from('ad_sets')
        .select('id, name')
        .eq('campaign_id', campaign.id);

      console.log(`   Ad Sets: ${adSets?.length || 0}`);

      if (adSets && adSets.length > 0) {
        // Get metrics for these ad sets
        const adSetIds = adSets.map(as => as.id);
        const { data: metrics } = await supabase
          .from('performance_metrics')
          .select('ad_set_id, metric_date, spend, extra_metrics')
          .in('ad_set_id', adSetIds)
          .order('metric_date', { ascending: false })
          .limit(10);

        console.log(`   Métricas encontradas: ${metrics?.length || 0}`);
        
        if (metrics && metrics.length > 0) {
          console.log('\n   📅 Últimas métricas:');
          metrics.forEach(m => {
            const actions = (m.extra_metrics as any)?.actions || [];
            const purchases = actions.find((a: any) => 
              a.action_type?.includes('purchase')
            );
            console.log(`     - ${m.metric_date}: Gasto R$ ${m.spend || 0}, Compras: ${purchases?.value || 0}`);
          });
        } else {
          console.log('   ⚠️  Nenhuma métrica encontrada para os ad sets desta campanha');
        }
      } else {
        console.log('   ⚠️  Nenhum ad set encontrado para esta campanha');
      }
    }
  } else {
    console.log('\n⚠️  Nenhuma campanha de vendas encontrada no banco de dados');
    console.log('\nObjetivos disponíveis no mapeamento:');
    console.log('  - OUTCOME_SALES');
    console.log('  - SALES');
    console.log('  - CONVERSIONS');
    console.log('  - PURCHASE');
  }
}

checkSalesCampaigns().catch(console.error);
