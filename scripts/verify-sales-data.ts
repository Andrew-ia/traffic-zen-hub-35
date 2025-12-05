#!/usr/bin/env tsx
import { Client } from 'pg';
import dotenv from 'dotenv';
import dns from 'node:dns';

dotenv.config({ path: '.env.local' });

function parseDatabaseConfig(databaseUrl: string) {
    const normalized = databaseUrl.replace(/^postgres(ql)?:\/\//, 'http://');
    const parsed = new URL(normalized);
    return {
        host: parsed.hostname,
        port: parsed.port ? Number(parsed.port) : 5432,
        user: decodeURIComponent(parsed.username),
        password: decodeURIComponent(parsed.password),
        database: parsed.pathname.replace(/^\//, ''),
    };
}

async function main() {
    const databaseUrl = process.env.SUPABASE_DATABASE_URL!;
    const workspaceId = process.env.META_WORKSPACE_ID!;

    const needsSsl = /supabase\.co/.test(databaseUrl);
    const dbConfig = parseDatabaseConfig(databaseUrl);
    const client = new Client({
        ...dbConfig,
        ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
        lookup: (hostname: any, options: any, callback: any) => dns.lookup(hostname, { ...options, family: 4 }, callback),
    });

    await client.connect();

    try {
        const since = new Date();
        since.setDate(since.getDate() - 30);
        const sinceStr = since.toISOString().slice(0, 10);

        console.log('\n=== ANÁLISE DE DADOS DE VENDAS (ÚLTIMOS 30 DIAS) ===\n');
        console.log(`Período: ${sinceStr} até hoje\n`);

        // 1. Buscar campanhas de vendas
        console.log('1. CAMPANHAS DE VENDAS:\n');
        const campaigns = await client.query(`
      SELECT id, name, objective
      FROM campaigns
      WHERE workspace_id = $1
        AND objective IN ('OUTCOME_SALES', 'SALES', 'CONVERSIONS', 'PURCHASE')
      ORDER BY name
    `, [workspaceId]);
        console.table(campaigns.rows);

        // 2. Buscar métricas APENAS campaign-level (igual à query do hook)
        console.log('\n2. MÉTRICAS CAMPAIGN-LEVEL (filtro usado pelo dashboard):\n');
        const metrics = await client.query(`
      SELECT 
        pm.metric_date,
        c.name as campaign_name,
        c.objective,
        pm.spend,
        pm.extra_metrics->'actions' as actions,
        pm.synced_at
      FROM performance_metrics pm
      JOIN campaigns c ON pm.campaign_id = c.id
      WHERE pm.workspace_id = $1
        AND pm.metric_date >= $2
        AND pm.granularity = 'day'
        AND c.objective IN ('OUTCOME_SALES', 'SALES', 'CONVERSIONS', 'PURCHASE')
        AND pm.campaign_id IS NOT NULL
        AND pm.ad_set_id IS NULL
        AND pm.ad_id IS NULL
      ORDER BY pm.metric_date DESC, c.name
    `, [workspaceId, sinceStr]);

        console.log(`Total de linhas: ${metrics.rows.length}\n`);
        console.table(metrics.rows);

        // 3. Processar ações para extrair conversationsStarted
        console.log('\n3. CONVERSAS INICIADAS POR DATA:\n');

        let totalConversations = 0;
        let totalSpend = 0;
        const conversationsByDate: Record<string, { conversations: number; spend: number; campaigns: string[] }> = {};

        for (const row of metrics.rows) {
            const date = row.metric_date.toISOString().split('T')[0];
            const spend = parseFloat(row.spend || 0);
            const actions = row.actions || [];

            let conversationsStarted = 0;

            // Buscar ação de conversa iniciada
            for (const action of actions) {
                if (action?.action_type === 'onsite_conversion.messaging_conversation_started_7d') {
                    conversationsStarted = parseInt(action.value || 0);
                    break;
                }
            }

            if (!conversationsByDate[date]) {
                conversationsByDate[date] = { conversations: 0, spend: 0, campaigns: [] };
            }

            conversationsByDate[date].conversations += conversationsStarted;
            conversationsByDate[date].spend += spend;
            conversationsByDate[date].campaigns.push(row.campaign_name);

            totalConversations += conversationsStarted;
            totalSpend += spend;
        }

        const summary = Object.entries(conversationsByDate).map(([date, data]) => ({
            date,
            conversations: data.conversations,
            spend: data.spend.toFixed(2),
            campaigns: data.campaigns.join(', ')
        }));

        console.table(summary);

        console.log('\n4. TOTAIS (CAMPAIGN-LEVEL APENAS):\n');
        console.log(`Total de Conversas Iniciadas: ${totalConversations}`);
        console.log(`Total de Gasto: R$ ${totalSpend.toFixed(2)}\n`);

        // 5. Verificar se há duplicação (mesma data, mesma campanha)
        console.log('\n5. VERIFICAÇÃO DE DUPLICAÇÃO:\n');
        const duplicates = await client.query(`
      SELECT 
        pm.metric_date,
        c.name as campaign_name,
        COUNT(*) as count,
        array_agg(pm.synced_at ORDER BY pm.synced_at DESC) as sync_times
      FROM performance_metrics pm
      JOIN campaigns c ON pm.campaign_id = c.id
      WHERE pm.workspace_id = $1
        AND pm.metric_date >= $2
        AND pm.granularity = 'day'
        AND c.objective IN ('OUTCOME_SALES', 'SALES', 'CONVERSIONS', 'PURCHASE')
        AND pm.campaign_id IS NOT NULL
        AND pm.ad_set_id IS NULL
        AND pm.ad_id IS NULL
      GROUP BY pm.metric_date, c.name
      HAVING COUNT(*) > 1
    `, [workspaceId, sinceStr]);

        if (duplicates.rows.length > 0) {
            console.log('⚠️ DUPLICAÇÕES ENCONTRADAS:\n');
            console.table(duplicates.rows);
        } else {
            console.log('✅ Sem duplicações encontradas\n');
        }

        // 6. Comparar com todos os níveis (para ver se há dados em outros níveis)
        console.log('\n6. COMPARAÇÃO COM OUTROS NÍVEIS:\n');
        const allLevels = await client.query(`
      SELECT 
        CASE 
          WHEN pm.campaign_id IS NULL THEN 'account'
          WHEN pm.ad_set_id IS NULL AND pm.ad_id IS NULL THEN 'campaign'
          WHEN pm.ad_id IS NULL THEN 'adset'
          ELSE 'ad'
        END as level,
        COUNT(*) as count,
        SUM(pm.spend) as total_spend
      FROM performance_metrics pm
      JOIN campaigns c ON pm.campaign_id = c.id
      WHERE pm.workspace_id = $1
        AND pm.metric_date >= $2
        AND pm.granularity = 'day'
        AND c.objective IN ('OUTCOME_SALES', 'SALES', 'CONVERSIONS', 'PURCHASE')
      GROUP BY level
      ORDER BY total_spend DESC
    `, [workspaceId, sinceStr]);

        console.table(allLevels.rows);

    } finally {
        await client.end();
    }
}

main().catch(console.error);
