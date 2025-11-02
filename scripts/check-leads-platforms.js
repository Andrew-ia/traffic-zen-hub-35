import 'dotenv/config';
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.SUPABASE_DATABASE_URL,
});

async function checkLeadsPlatforms() {
  try {
    const workspaceId = process.env.VITE_WORKSPACE_ID;

    console.log('🔍 Verificando plataformas dos ad sets de LEADS\n');

    // Get campaigns with LEADS objective
    const campaignsResult = await pool.query(`
      SELECT id, name, objective
      FROM campaigns
      WHERE workspace_id = $1
        AND (
          objective LIKE '%LEAD%'
          OR objective = 'OUTCOME_LEADS'
        )
    `, [workspaceId]);

    console.log(`Encontradas ${campaignsResult.rows.length} campanhas de LEADS:\n`);

    for (const campaign of campaignsResult.rows) {
      console.log(`\n📊 Campanha: ${campaign.name}`);
      console.log(`   Objetivo: ${campaign.objective}`);
      console.log(`   ID: ${campaign.id}`);

      // Get ad sets for this campaign
      const adSetsResult = await pool.query(`
        SELECT id, name, targeting
        FROM ad_sets
        WHERE campaign_id = $1
      `, [campaign.id]);

      for (const adSet of adSetsResult.rows) {
        console.log(`\n   📱 Ad Set: ${adSet.name}`);

        const publishers = adSet.targeting?.publisher_platforms || [];
        console.log(`      Plataformas: ${publishers.join(', ') || 'Não definido'}`);

        // Check metrics
        const metricsResult = await pool.query(`
          SELECT
            COUNT(*) as metric_count,
            SUM((extra_metrics->'actions')::jsonb @> '[{"action_type":"onsite_conversion.messaging_conversation_started_7d"}]'::jsonb) as has_conversations
          FROM performance_metrics
          WHERE ad_set_id = $1
            AND workspace_id = $2
            AND metric_date >= CURRENT_DATE - INTERVAL '30 days'
        `, [adSet.id, workspaceId]);

        console.log(`      Métricas (últimos 30 dias): ${metricsResult.rows[0]?.metric_count || 0}`);
        console.log(`      Tem conversas: ${metricsResult.rows[0]?.has_conversations || 0}`);
      }
    }

  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await pool.end();
  }
}

checkLeadsPlatforms();
