import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const db = new Client({ connectionString: process.env.SUPABASE_DATABASE_URL });

(async () => {
  await db.connect();

  console.log('=== Criativos da campanha WhatsApp com Performance ===\n');

  const query = `
    SELECT
      ca.id,
      ca.name,
      ca.type,
      ca.storage_url,
      ca.thumbnail_url,
      ca.text_content,
      ca.aspect_ratio,
      ca.duration_seconds,
      ca.metadata->>'body' as body,
      ca.metadata->'asset_feed_spec'->'titles'->0->>'text' as title,
      ca.metadata->'asset_feed_spec'->'descriptions'->0->>'text' as description,
      a.name as ad_name,
      pm.impressions,
      pm.clicks,
      pm.spend,
      CASE WHEN pm.impressions > 0 THEN (pm.clicks::float / pm.impressions) * 100 ELSE 0 END as ctr
    FROM creative_assets ca
    JOIN ads a ON ca.id = a.creative_asset_id
    LEFT JOIN ad_sets ads ON a.ad_set_id = ads.id
    LEFT JOIN (
      SELECT
        ad_id,
        SUM(impressions) as impressions,
        SUM(clicks) as clicks,
        SUM(spend) as spend
      FROM performance_metrics
      WHERE granularity = 'day'
      GROUP BY ad_id
    ) pm ON a.id = pm.ad_id
    WHERE ads.campaign_id = '23494cca-5c35-4b53-843e-8e81e1c7a917'
    LIMIT 5
  `;

  const result = await db.query(query);

  console.log(`Total de criativos: ${result.rows.length}\n`);

  result.rows.forEach((c, i) => {
    console.log(`${i + 1}. ${c.name || c.ad_name}`);
    console.log(`   Tipo: ${c.type}`);
    console.log(`   Título: ${c.title || 'N/A'}`);
    const copyText = (c.text_content || c.body || 'N/A');
    console.log(`   Copy: ${copyText.substring(0, 100)}...`);
    console.log(`   Aspect Ratio: ${c.aspect_ratio || 'N/A'}`);
    console.log(`   Duração: ${c.duration_seconds || 'N/A'}s`);
    console.log(`   Performance:`);
    console.log(`     - Impressões: ${parseInt(c.impressions || 0).toLocaleString()}`);
    console.log(`     - Cliques: ${parseInt(c.clicks || 0).toLocaleString()}`);
    console.log(`     - Gasto: R$ ${parseFloat(c.spend || 0).toFixed(2)}`);
    console.log(`     - CTR: ${parseFloat(c.ctr || 0).toFixed(2)}%`);
    console.log(`   Thumbnail: ${c.thumbnail_url ? 'Disponível' : 'N/A'}`);
    console.log('---\n');
  });

  await db.end();
})();
