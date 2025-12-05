#!/usr/bin/env node
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const { META_WORKSPACE_ID } = process.env;
const API_BASE = 'http://localhost:3001';

async function main() {
    try {
        console.log('\n=== Testando endpoint /api/metrics/aggregate ===\n');

        const tests = [
            { platform: 'meta', days: 7, label: '7 dias, sem filtros' },
            { platform: 'meta', days: 30, label: '30 dias, sem filtros' },
            { platform: 'meta', days: 7, status: 'active', label: '7 dias, apenas ativas' },
            { platform: 'meta', days: 7, status: 'all', label: '7 dias, todas' },
        ];

        for (const test of tests) {
            const params = new URLSearchParams({
                platform: test.platform,
                days: test.days.toString(),
                workspaceId: META_WORKSPACE_ID!,
            });

            if (test.status) {
                params.append('status', test.status);
            }

            const url = `${API_BASE}/api/metrics/aggregate?${params.toString()}`;
            console.log(`\n📊 Teste: ${test.label}`);
            console.log(`   URL: ${url}`);

            const response = await fetch(url);
            if (!response.ok) {
                console.error(`   ❌ Erro: ${response.status} ${response.statusText}`);
                const text = await response.text();
                console.error(`   ${text}`);
                continue;
            }

            const data = await response.json();
            console.log(`   ✅ Resposta:`);
            console.log(`      - Investimento: R$ ${Number(data.totalSpend || 0).toFixed(2)}`);
            console.log(`      - Impressões: ${Number(data.impressions || 0).toLocaleString('pt-BR')}`);
            console.log(`      - Cliques: ${Number(data.clicks || 0).toLocaleString('pt-BR')}`);
            console.log(`      - Alcance: ${Number(data.reach || 0).toLocaleString('pt-BR')}`);
            console.log(`      - CTR: ${Number(data.ctr || 0).toFixed(2)}%`);
            console.log(`      - CPC: R$ ${Number(data.cpc || 0).toFixed(2)}`);
            console.log(`      - CPM: R$ ${Number(data.cpm || 0).toFixed(2)}`);
            console.log(`      - Campanhas ativas: ${data.activeCampaigns}`);
            console.log(`      - Total campanhas: ${data.totalCampaigns}`);
            console.log(`      - Conversas iniciadas: ${data.conversationsStarted || 0}`);
            console.log(`      - Engajamentos: ${data.engagements || 0}`);
            console.log(`      - Compras: ${data.purchases || 0}`);
        }

    } catch (error: any) {
        console.error('❌ Erro:', error.message);
    }
}

main();
