
import { getPool } from '../server/config/database';

async function analyzeDuplicateSpend() {
    const pool = getPool();
    const workspaceId = '00000000-0000-0000-0000-000000000010';
    const days = 30;

    console.log(`Analyzing spend for last ${days} days...`);

    // 1. Raw sum (without deduplication logic) to see potential magnitude of duplication
    const rawQuery = `
    SELECT count(*) as total_rows, sum(spend) as total_spend
    FROM performance_metrics pm
    WHERE pm.workspace_id = $1
      AND pm.metric_date >= current_date - $2::int
      AND pm.metric_date < current_date
      AND pm.granularity = 'day'
      AND pm.ad_set_id IS NULL
      AND pm.ad_id IS NULL
      AND pm.campaign_id IS NOT NULL 
  `;
    const rawRes = await pool.query(rawQuery, [workspaceId, days]);
    console.log("Raw (all rows) Campaign Spend:", rawRes.rows[0]);

    // 2. Breakdown by campaign to spot the culprit
    const campaignQuery = `
    SELECT 
        c.name as campaign_name,
        pm.campaign_id,
        count(*) as entries_count,
        sum(pm.spend) as raw_spend,
        
        -- Deduplicated Spend Logic
        (
            SELECT sum(distinct_spend)
            FROM (
                SELECT DISTINCT ON (inner_pm.metric_date) inner_pm.spend as distinct_spend
                FROM performance_metrics inner_pm
                WHERE inner_pm.campaign_id = pm.campaign_id
                  AND inner_pm.workspace_id = $1
                  AND inner_pm.metric_date >= current_date - $2::int
                  AND inner_pm.metric_date < current_date
                  AND inner_pm.granularity = 'day'
                  AND inner_pm.ad_set_id IS NULL 
                  AND inner_pm.ad_id IS NULL
                ORDER BY inner_pm.metric_date, inner_pm.synced_at DESC
            ) t
        ) as dedup_spend
        
    FROM performance_metrics pm
    LEFT JOIN campaigns c ON c.id = pm.campaign_id
    WHERE pm.workspace_id = $1
      AND pm.metric_date >= current_date - $2::int
      AND pm.metric_date < current_date
      AND pm.granularity = 'day'
      AND pm.ad_set_id IS NULL
      AND pm.ad_id IS NULL
      AND pm.campaign_id IS NOT NULL
    GROUP BY c.name, pm.campaign_id
    ORDER BY raw_spend DESC;
  `;

    const campRes = await pool.query(campaignQuery, [workspaceId, days]);
    console.table(campRes.rows);

}

analyzeDuplicateSpend().then(() => process.exit(0));
