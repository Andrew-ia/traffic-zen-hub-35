import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Carregar variáveis de ambiente
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const workspaceId = process.env.VITE_WORKSPACE_ID;

if (!supabaseUrl || !supabaseKey || !workspaceId) {
    console.error('Variáveis de ambiente não encontradas.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkGoogleAdsData() {
    console.log('Verificando dados do Google Ads no Supabase...');
    console.log(`Workspace ID: ${workspaceId}`);

    // 1. Verificar se existem credenciais salvas
    const { data: credentials, error: credError } = await supabase
        .from('platform_accounts')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('platform_key', 'google_ads');

    if (credError) {
        console.error('Erro ao buscar credenciais:', credError);
    } else {
        console.log(`Contas Google Ads encontradas: ${credentials?.length || 0}`);
        credentials?.forEach(cred => {
            console.log(`- ID: ${cred.id}, Nome: ${cred.name}, Status: ${cred.status}`);
        });
    }

    // 2. Verificar dados na tabela ads_spend_google
    const { data: spendData, error: spendError } = await supabase
        .from('ads_spend_google')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('metric_date', { ascending: false })
        .limit(5);

    if (spendError) {
        console.error('Erro ao buscar dados de ads_spend_google:', spendError);
    } else {
        console.log(`\nRegistros recentes em ads_spend_google: ${spendData?.length || 0}`);
        if (spendData && spendData.length > 0) {
            spendData.forEach(row => {
                console.log(`- Data: ${row.metric_date}, Campanha: ${row.campaign_name}, Custo: ${row.cost_micros}, Impr: ${row.impressions}`);
            });
        } else {
            console.log('Nenhum dado encontrado na tabela ads_spend_google.');
        }
    }

    // 3. Verificar dados na tabela performance_metrics (onde o Google Ads também pode estar)
    const { data: perfData, error: perfError } = await supabase
        .from('performance_metrics')
        .select('metric_date, spend, impressions, platform_account_id, platform_accounts(platform_key)')
        .eq('workspace_id', workspaceId)
        .order('metric_date', { ascending: false })
        .limit(10);

    if (perfError) {
        console.error('Erro ao buscar dados de performance_metrics:', perfError);
    } else {
        console.log(`\nRegistros recentes em performance_metrics:`);
        const googleMetrics = perfData?.filter((m: any) => m.platform_accounts?.platform_key === 'google_ads');
        if (googleMetrics && googleMetrics.length > 0) {
            console.log(`Encontrados ${googleMetrics.length} registros de Google Ads em performance_metrics.`);
            googleMetrics.forEach((m: any) => {
                console.log(`- Data: ${m.metric_date}, Spend: ${m.spend}, Impr: ${m.impressions}`);
            });
        } else {
            console.log('Nenhum registro de Google Ads encontrado em performance_metrics (nos últimos 10 registros gerais).');
        }
    }
}

checkGoogleAdsData();
